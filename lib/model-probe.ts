import fs from "fs";
import path from "path";
import { exec, execFile } from "child_process";
import { promisify } from "util";
import { readJsonFileSync } from "@/lib/json";
import { OPENCLAW_CONFIG_PATH, OPENCLAW_HOME } from "@/lib/openclaw-paths";
import { getProbePresetById, mapProbeProtocolToApi } from "@/lib/model-probe-presets";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

export const DEFAULT_MODEL_PROBE_TIMEOUT_MS = 15000;

type ProviderApiType = "anthropic-messages" | "openai-completions" | string;

interface ProviderConfig {
  baseUrl?: string;
  apiKey?: string;
  api?: ProviderApiType;
  authHeader?: boolean | string;
  headers?: Record<string, string>;
}

interface ProbeResult {
  provider?: string;
  model?: string;
  mode?: "api_key" | "oauth" | string;
  status?: "ok" | "error" | "unknown" | string;
  error?: string;
  latencyMs?: number;
}

interface DirectProbeResult {
  ok: boolean;
  elapsed: number;
  status: string;
  error?: string;
  mode: "api_key";
  source: "direct_model_probe";
  precision: "model";
  text?: string;
}

export interface ModelProbeOutcome {
  ok: boolean;
  elapsed: number;
  model: string;
  mode: "api_key" | "oauth" | "unknown" | string;
  status: string;
  error?: string;
  text?: string;
  source: "direct_model_probe" | "openclaw_provider_probe";
  precision: "model" | "provider";
}

interface ProbeModelParams {
  /** openclaw 中的 provider；与 probePresetId / customHttp 至少其一（测试时） */
  providerId?: string;
  modelId: string;
  timeoutMs?: number;
  /** 合并读取 agents/<id>/agent/models.json 与 main，再与 openclaw.json 合并 */
  agentId?: string;
  /** 仅本次直连探测使用，不写入配置；用于内网联调或覆盖占位符密钥 */
  overrideApiKey?: string;
  /** 使用 model-probe-presets.json / openclaw.json 内嵌预设的 baseUrl+协议+key，与当前行模型 ID 组合探测 */
  probePresetId?: string;
  /** 自建/厂家 HTTP 网关：baseUrl + protocol（anthropic|openai），Key 用 overrideApiKey */
  customHttp?: { baseUrl: string; protocol: string };
}

interface DirectProbeExecuteOpts {
  modelId: string;
  timeoutMs: number;
  temperature: number;
}

function quoteShellArg(arg: string): string {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

async function execOpenclaw(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const env = { ...process.env, FORCE_COLOR: "0" };

  if (process.platform !== "win32") {
    return execFileAsync("openclaw", args, {
      maxBuffer: 10 * 1024 * 1024,
      env,
    });
  }

  const command = `openclaw ${args.map(quoteShellArg).join(" ")}`;
  return execAsync(command, {
    maxBuffer: 10 * 1024 * 1024,
    env,
    shell: "cmd.exe",
  });
}

function parseJsonFromMixedOutput(output: string): any {
  for (let i = 0; i < output.length; i++) {
    if (output[i] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let j = i; j < output.length; j++) {
      const ch = output[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === "\"") inString = false;
        continue;
      }
      if (ch === "\"") {
        inString = true;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = output.slice(i, j + 1).trim();
          try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === "object") return parsed;
          } catch {}
          break;
        }
      }
    }
  }
  throw new Error("Failed to parse JSON output from openclaw models status --probe --json");
}

/** 占位：全大写蛇形，通常表示读环境变量，如 LITELLM_API_KEY */
function looksLikeEnvPlaceholder(key: string): boolean {
  return /^[A-Z][A-Z0-9_]+$/.test(key.trim());
}

function resolveApiKeyValue(raw?: string): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  if (looksLikeEnvPlaceholder(t)) {
    const v = process.env[t];
    if (v && v.trim()) return v.trim();
    return undefined;
  }
  return t;
}

function pickProviderFromMap(providers: unknown, providerId: string): ProviderConfig | null {
  if (!providers || typeof providers !== "object") return null;
  const map = providers as Record<string, unknown>;
  const exact = map[providerId];
  if (exact && typeof exact === "object") return { ...(exact as ProviderConfig) };
  const normalizedTarget = providerId.toLowerCase();
  for (const [key, value] of Object.entries(map)) {
    if (key.toLowerCase() === normalizedTarget && value && typeof value === "object") {
      return { ...(value as ProviderConfig) };
    }
  }
  return null;
}

function readProviderFromAgentModelsJson(providerId: string, agentFolder: string): ProviderConfig | null {
  const p = path.join(OPENCLAW_HOME, "agents", agentFolder, "agent", "models.json");
  try {
    const parsed = readJsonFileSync<any>(p);
    return pickProviderFromMap(parsed?.providers, providerId);
  } catch {
    return null;
  }
}

/** main 与指定 Agent 的 models.json 合并（后者覆盖前者），用于读取 baseUrl/apiKey 等 */
function mergeModelsJsonLayers(providerId: string, agentId?: string): ProviderConfig | null {
  const mainMj = readProviderFromAgentModelsJson(providerId, "main");
  const aid = agentId?.trim();
  const agentMj = aid && aid !== "main" ? readProviderFromAgentModelsJson(providerId, aid) : null;
  if (!mainMj && !agentMj) return null;
  return {
    ...(mainMj || {}),
    ...(agentMj || {}),
    headers: { ...(mainMj?.headers || {}), ...(agentMj?.headers || {}) },
  };
}

function readProviderFromOpenclawJson(providerId: string): ProviderConfig | null {
  try {
    if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) return null;
    const cfg = readJsonFileSync<any>(OPENCLAW_CONFIG_PATH);
    return pickProviderFromMap(cfg?.models?.providers, providerId);
  } catch {
    return null;
  }
}

/**
 * 合并 agents/<agentId>/agent/models.json（及 main）与 openclaw.json → models.providers。
 * 真实密钥往往在 openclaw.json；models.json 常见为 baseUrl + 占位 apiKey（如 LITELLM_API_KEY），
 * 仅读 models.json 会导致网关返回 invalid key。
 */
function loadProviderConfig(providerId: string, agentId?: string): ProviderConfig | null {
  const mj = mergeModelsJsonLayers(providerId, agentId);
  const oc = readProviderFromOpenclawJson(providerId);
  if (!mj && !oc) return null;

  const merged: ProviderConfig = {
    ...(mj || {}),
    ...(oc || {}),
    headers: { ...(mj?.headers || {}), ...(oc?.headers || {}) },
  }

  const tryKeys = [oc?.apiKey, mj?.apiKey, merged.apiKey]
  let resolved: string | undefined
  for (const k of tryKeys) {
    resolved = resolveApiKeyValue(k)
    if (resolved) break
  }
  if (resolved) merged.apiKey = resolved
  else {
    const r = typeof merged.apiKey === "string" ? merged.apiKey.trim() : ""
    if (r && looksLikeEnvPlaceholder(r)) delete merged.apiKey
  }

  if (!merged.baseUrl) merged.baseUrl = oc?.baseUrl || mj?.baseUrl
  if (!merged.api) merged.api = oc?.api || mj?.api

  return merged
}

/** 将上游简短英文错误扩展为可操作的说明（仪表盘用） */
export function humanizeModelProbeError(error: string | undefined): string | undefined {
  if (!error || typeof error !== "string") return undefined;
  const e = error.toLowerCase()
  if (e.includes("invalid") && (e.includes("key") || e.includes("api"))) {
    return "这通常表示 API Key 无效或未传到 LiteLLM：请确认 openclaw.json 里 models.providers 的 apiKey 为真实密钥；若 agents/main/agent/models.json 使用占位符（如 LITELLM_API_KEY），请在系统环境变量中设置同名变量。模型名称错误时有时也会报类似错误，请核对 LiteLLM 上该 model 的精确 id。"
  }
  if (e.includes("401") || e.includes("403") || e.includes("unauthorized")) {
    return "鉴权失败：请检查 apiKey、网关是否要求额外 Header，以及该 Key 在 LiteLLM/上游是否仍有效。"
  }
  if (
    e.includes("max_tokens") &&
    (e.includes("not support") || e.includes("unsupported parameter"))
  ) {
    return "上游（如 Azure / 新版 GPT 路由）不接受 max_tokens。面板探测已自动改用 max_completion_tokens 或无长度参数重试；若仍失败，请在 LiteLLM 侧核对该 deployment 的 OpenAI 兼容参数。"
  }
  return undefined
}

function pickAuthHeader(providerCfg: ProviderConfig, apiKey: string): Record<string, string> {
  const out: Record<string, string> = {};
  const authHeader = providerCfg.authHeader;
  const api = providerCfg.api;

  if (typeof authHeader === "string" && authHeader.trim()) {
    out[authHeader.trim()] = apiKey;
    return out;
  }

  if (authHeader === false) {
    out["x-api-key"] = apiKey;
    return out;
  }

  if (api === "anthropic-messages") {
    out["x-api-key"] = apiKey;
    out["Authorization"] = `Bearer ${apiKey}`;
    return out;
  }

  out["Authorization"] = `Bearer ${apiKey}`;
  return out;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

function classifyErrorStatus(httpStatus: number, errorText: string): string {
  const normalized = errorText.toLowerCase();
  if (normalized.includes("timed out")) return "timeout";
  if (normalized.includes("model_not_supported")) return "model_not_supported";
  if (httpStatus === 401 || httpStatus === 403 || normalized.includes("unauthorized")) return "auth";
  if (httpStatus === 429 || normalized.includes("rate limit")) return "rate_limit";
  if (httpStatus === 402 || normalized.includes("billing")) return "billing";
  return "error";
}

function extractErrorMessage(payload: any, fallback: string): string {
  const direct = payload?.error?.message || payload?.message || payload?.error;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return fallback;
}

/** 使用已合并的 ProviderConfig（含 apiKey）发起直连探测 */
async function executeDirectProbe(
  providerCfg: ProviderConfig,
  opts: DirectProbeExecuteOpts,
): Promise<DirectProbeResult | null> {
  const apiKey =
    typeof providerCfg.apiKey === "string" && providerCfg.apiKey.trim()
      ? providerCfg.apiKey.trim()
      : "";
  if (!apiKey || !providerCfg.baseUrl || !providerCfg.api) return null;

  const { modelId, timeoutMs, temperature } = opts;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(providerCfg.headers || {}),
    ...pickAuthHeader(providerCfg, apiKey),
  };

  if (providerCfg.api === "anthropic-messages") {
    if (!headers["anthropic-version"]) headers["anthropic-version"] = "2023-06-01";
    const url = `${providerCfg.baseUrl.replace(/\/+$/, "")}/v1/messages`;
    const msgString = { role: "user" as const, content: "Reply with OK." };
    const msgBlocks = {
      role: "user" as const,
      content: [{ type: "text", text: "Reply with OK." }],
    };
    const anthropicProbeBodies: Array<Record<string, unknown>> = [
      { model: modelId, max_tokens: 8, messages: [msgString], temperature },
      { model: modelId, max_tokens: 8, messages: [msgBlocks], temperature },
      { model: modelId, max_tokens: 8, messages: [msgBlocks] },
    ];

    const start = Date.now();
    let lastError = "HTTP error";
    let lastStatus = "error";

    try {
      for (let i = 0; i < anthropicProbeBodies.length; i++) {
        const body = anthropicProbeBodies[i]!;
        const resp = await fetchWithTimeout(
          url,
          { method: "POST", headers, body: JSON.stringify(body) },
          timeoutMs,
        );
        const elapsed = Date.now() - start;
        if (resp.ok) {
          const note = i > 0 ? ` (probe variant #${i + 1})` : "";
          return {
            ok: true,
            elapsed,
            status: "ok",
            mode: "api_key",
            source: "direct_model_probe",
            precision: "model",
            text: `OK (direct model probe)${note}`,
          };
        }

        let payload: any = null;
        try {
          payload = await resp.json();
        } catch {}
        lastError = extractErrorMessage(payload, `HTTP ${resp.status}`);
        lastStatus = classifyErrorStatus(resp.status, lastError);

        if (resp.status === 401 || resp.status === 403) break;
        if (resp.status === 404) break;
        if (resp.status >= 500) break;
        const errL = lastError.toLowerCase();
        const maybeContentShape =
          errL.includes("content") ||
          errL.includes("invalid") ||
          errL.includes("malformed") ||
          errL.includes("expected");
        if (!maybeContentShape && resp.status === 400 && i === 0) break;
      }

      return {
        ok: false,
        elapsed: Date.now() - start,
        status: lastStatus,
        error: lastError,
        mode: "api_key",
        source: "direct_model_probe",
        precision: "model",
      };
    } catch (err: any) {
      const elapsed = Date.now() - start;
      const isTimeout = err?.name === "AbortError";
      return {
        ok: false,
        elapsed,
        status: isTimeout ? "timeout" : "network",
        error: isTimeout ? "LLM request timed out." : (err?.message || "Network error"),
        mode: "api_key",
        source: "direct_model_probe",
        precision: "model",
      };
    }
  }

  if (providerCfg.api === "openai-completions") {
    const url = `${providerCfg.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const messages = [{ role: "user" as const, content: "Reply with OK." }];
    const start = Date.now();

    const openaiProbeBodies: Array<Record<string, unknown>> = [
      { model: modelId, messages, max_tokens: 8, temperature },
      { model: modelId, messages, max_completion_tokens: 16, temperature },
      { model: modelId, messages, temperature },
      { model: modelId, messages },
    ];

    let lastError = `HTTP error`;
    let lastStatus = "error";

    try {
      for (let i = 0; i < openaiProbeBodies.length; i++) {
        const body = openaiProbeBodies[i]!;
        const resp = await fetchWithTimeout(
          url,
          { method: "POST", headers, body: JSON.stringify(body) },
          timeoutMs,
        );
        const elapsed = Date.now() - start;
        if (resp.ok) {
          const note = i > 0 ? ` (probe variant #${i + 1})` : "";
          return {
            ok: true,
            elapsed,
            status: "ok",
            mode: "api_key",
            source: "direct_model_probe",
            precision: "model",
            text: `OK (direct model probe)${note}`,
          };
        }

        let payload: any = null;
        try {
          payload = await resp.json();
        } catch {}
        lastError = extractErrorMessage(payload, `HTTP ${resp.status}`);
        lastStatus = classifyErrorStatus(resp.status, lastError);

        if (resp.status === 401 || resp.status === 403) break;
        if (resp.status === 404) break;
        const errL = lastError.toLowerCase();
        const paramClash =
          errL.includes("unsupported parameter") ||
          (errL.includes("not supported") &&
            (errL.includes("max_tokens") || errL.includes("max_completion_tokens") || errL.includes("temperature")));
        if (!paramClash && resp.status === 400 && i === 0) break;
      }

      return {
        ok: false,
        elapsed: Date.now() - start,
        status: lastStatus,
        error: lastError,
        mode: "api_key",
        source: "direct_model_probe",
        precision: "model",
      };
    } catch (err: any) {
      const elapsed = Date.now() - start;
      const isTimeout = err?.name === "AbortError";
      return {
        ok: false,
        elapsed,
        status: isTimeout ? "timeout" : "network",
        error: isTimeout ? "LLM request timed out." : (err?.message || "Network error"),
        mode: "api_key",
        source: "direct_model_probe",
        precision: "model",
      };
    }
  }

  return null;
}

async function probeModelDirect(params: ProbeModelParams): Promise<DirectProbeResult | null> {
  const providerId = String(params.providerId || "").trim();
  if (!providerId) return null;

  const providerCfg = loadProviderConfig(providerId, params.agentId);
  if (!providerCfg?.baseUrl || !providerCfg.api) return null;

  const override =
    typeof params.overrideApiKey === "string" && params.overrideApiKey.trim()
      ? params.overrideApiKey.trim()
      : "";
  const configKey =
    typeof providerCfg.apiKey === "string" && providerCfg.apiKey.trim() ? providerCfg.apiKey.trim() : "";
  const apiKey = override || configKey;
  if (!apiKey) return null;

  const timeoutMs = params.timeoutMs ?? DEFAULT_MODEL_PROBE_TIMEOUT_MS;
  const isKimiProvider = providerId === "kimi-coding" || providerId === "moonshot";
  const temperature = isKimiProvider ? 1 : 0;

  const cfg: ProviderConfig = { ...providerCfg, apiKey };
  return executeDirectProbe(cfg, {
    modelId: params.modelId,
    timeoutMs,
    temperature,
  });
}

function modelLabelForProbe(params: ProbeModelParams): string {
  const pid = String(params.providerId || "").trim();
  if (pid) return `${pid}/${params.modelId}`;
  return `preset:${String(params.probePresetId || "").trim()}/${params.modelId}`;
}

async function runProbeWithPreset(params: ProbeModelParams): Promise<ModelProbeOutcome> {
  const presetId = String(params.probePresetId || "").trim();
  const modelLabel = modelLabelForProbe(params);

  const preset = getProbePresetById(presetId);
  if (!preset) {
    return {
      ok: false,
      elapsed: 0,
      model: modelLabel,
      mode: "api_key",
      status: "error",
      error: `未找到探测预设: ${presetId}`,
      source: "direct_model_probe",
      precision: "model",
    };
  }

  const api = mapProbeProtocolToApi(String(preset.protocol || ""));
  if (!api) {
    const proto = String(preset.protocol || "").toLowerCase();
    const isGemini = proto.includes("gemini") || proto === "google";
    return {
      ok: false,
      elapsed: 0,
      model: modelLabel,
      mode: "api_key",
      status: "error",
      error: isGemini
        ? "当前直连探测暂不支持 gemini 协议，请改用 anthropic 或 openai"
        : `不支持的协议: ${preset.protocol}`,
      source: "direct_model_probe",
      precision: "model",
    };
  }

  const override =
    typeof params.overrideApiKey === "string" && params.overrideApiKey.trim()
      ? params.overrideApiKey.trim()
      : "";
  const fromPreset = resolveApiKeyValue(preset.apiKey);
  const apiKey = override || fromPreset;
  if (!apiKey) {
    return {
      ok: false,
      elapsed: 0,
      model: modelLabel,
      mode: "api_key",
      status: "error",
      error:
        "预设中无法解析 apiKey：请在 JSON 中填写 apiKey、配置对应环境变量，或使用页面临时 API Key",
      source: "direct_model_probe",
      precision: "model",
    };
  }

  const cfg: ProviderConfig = {
    baseUrl: preset.baseUrl,
    api,
    apiKey,
    headers: preset.headers,
    authHeader: preset.authHeader,
  };
  const temperature = preset.kimiTemperature ? 1 : 0;
  const timeoutMs = params.timeoutMs ?? DEFAULT_MODEL_PROBE_TIMEOUT_MS;

  const direct = await executeDirectProbe(cfg, {
    modelId: params.modelId,
    timeoutMs,
    temperature,
  });

  if (!direct) {
    return {
      ok: false,
      elapsed: 0,
      model: modelLabel,
      mode: "api_key",
      status: "error",
      error: "直连探测不支持该 API 类型",
      source: "direct_model_probe",
      precision: "model",
    };
  }

  return {
    ...direct,
    model: modelLabel,
  };
}

async function runProbeWithCustomHttp(params: ProbeModelParams): Promise<ModelProbeOutcome> {
  const ch = params.customHttp;
  const baseUrl = String(ch?.baseUrl || "").trim();
  const protocol = String(ch?.protocol || "").trim();
  const modelLabel = params.providerId?.trim()
    ? `${params.providerId!.trim()}/${params.modelId}`
    : `custom/${params.modelId}`;

  const api = mapProbeProtocolToApi(protocol);
  if (!api) {
    const proto = protocol.toLowerCase();
    const isGemini = proto.includes("gemini") || proto === "google";
    return {
      ok: false,
      elapsed: 0,
      model: modelLabel,
      mode: "api_key",
      status: "error",
      error: isGemini
        ? "当前直连探测暂不支持 gemini 协议，请改用 anthropic 或 openai"
        : `不支持的协议: ${protocol}`,
      source: "direct_model_probe",
      precision: "model",
    };
  }

  const apiKey = typeof params.overrideApiKey === "string" ? params.overrideApiKey.trim() : "";
  if (!apiKey) {
    return {
      ok: false,
      elapsed: 0,
      model: modelLabel,
      mode: "api_key",
      status: "error",
      error:
        "自建 HTTP 探测需要 Bearer/API Key：请在面板「临时 API Key」中填写（不会写入 openclaw.json）",
      source: "direct_model_probe",
      precision: "model",
    };
  }

  const cfg: ProviderConfig = {
    baseUrl,
    api,
    apiKey,
  };
  const direct = await executeDirectProbe(cfg, {
    modelId: params.modelId,
    timeoutMs: params.timeoutMs ?? DEFAULT_MODEL_PROBE_TIMEOUT_MS,
    temperature: 0,
  });

  if (!direct) {
    return {
      ok: false,
      elapsed: 0,
      model: modelLabel,
      mode: "api_key",
      status: "error",
      error: "直连探测不支持该 API 类型",
      source: "direct_model_probe",
      precision: "model",
    };
  }

  return {
    ...direct,
    model: modelLabel,
  };
}

async function probeProviderViaOpenclaw(params: ProbeModelParams): Promise<ModelProbeOutcome> {
  const providerId = String(params.providerId || "").trim();
  if (!providerId) {
    return {
      ok: false,
      elapsed: 0,
      model: params.modelId,
      mode: "unknown",
      status: "error",
      error: "缺少 providerId，无法使用 openclaw 探测",
      source: "openclaw_provider_probe",
      precision: "provider",
    };
  }

  const timeoutMs = params.timeoutMs ?? DEFAULT_MODEL_PROBE_TIMEOUT_MS;
  const startedAt = Date.now();
  const { stdout, stderr } = await execOpenclaw([
      "models",
      "status",
      "--probe",
      "--json",
      "--probe-timeout",
      String(timeoutMs),
      "--probe-provider",
      providerId,
    ]);
  const parsed = parseJsonFromMixedOutput(`${stdout}\n${stderr || ""}`);
  const results: ProbeResult[] = parsed?.auth?.probes?.results || [];
  const fullModel = `${providerId}/${params.modelId}`;

  const exact =
    results.find((r) => r.provider === providerId && r.model === fullModel) ||
    results.find((r) => r.provider === providerId && typeof r.model === "string" && r.model.endsWith(`/${params.modelId}`));
  const matched = exact || results.find((r) => r.provider === providerId);

  if (!matched) {
    return {
      ok: false,
      elapsed: Date.now() - startedAt,
      model: fullModel,
      mode: "unknown",
      status: "unknown",
      error: `No probe result for provider ${providerId}`,
      precision: "provider",
      source: "openclaw_provider_probe",
    };
  }

  const ok = matched.status === "ok";
  return {
    ok,
    elapsed: matched.latencyMs ?? (Date.now() - startedAt),
    model: matched.model || fullModel,
    mode: matched.mode || "unknown",
    status: matched.status || "unknown",
    error: ok ? undefined : (matched.error || `Probe status: ${matched.status || "unknown"}`),
    precision: exact ? "model" : "provider",
    source: "openclaw_provider_probe",
    text: ok ? `OK (${exact ? "model-level" : "provider-level"} openclaw probe)` : undefined,
  };
}

export function parseModelRef(modelStr: string): { providerId: string; modelId: string } {
  const [providerId, ...rest] = modelStr.split("/");
  return { providerId: providerId || "", modelId: rest.join("/") || providerId || "" };
}

export async function probeModel(params: ProbeModelParams): Promise<ModelProbeOutcome> {
  const ch = params.customHttp;
  if (
    ch &&
    typeof ch.baseUrl === "string" &&
    ch.baseUrl.trim() &&
    typeof ch.protocol === "string" &&
    ch.protocol.trim()
  ) {
    return runProbeWithCustomHttp(params);
  }

  if (String(params.probePresetId || "").trim()) {
    return runProbeWithPreset(params);
  }

  const providerId = String(params.providerId || "").trim();
  if (!providerId) {
    return {
      ok: false,
      elapsed: 0,
      model: params.modelId,
      mode: "unknown",
      status: "error",
      error: "缺少 provider、探测预设或自建 HTTP 参数",
      source: "direct_model_probe",
      precision: "model",
    };
  }

  const scoped: ProbeModelParams = { ...params, providerId };
  const direct = await probeModelDirect(scoped);
  if (direct) {
    return {
      ...direct,
      model: `${providerId}/${params.modelId}`,
    };
  }
  return probeProviderViaOpenclaw(scoped);
}
