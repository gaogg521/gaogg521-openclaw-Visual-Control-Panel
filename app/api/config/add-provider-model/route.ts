import { NextResponse } from "next/server";
import path from "path";
import { clearConfigCache } from "@/lib/config-cache";
import { callOpenclawGateway, resolveConfigSnapshotHash } from "@/lib/openclaw-cli";
import { syncOpenclawToMysql } from "@/lib/db-sync";
import { DEFAULT_MODEL_PROBE_TIMEOUT_MS, humanizeModelProbeError, probeModel } from "@/lib/model-probe";
import { OPENCLAW_CONFIG_PATH, OPENCLAW_HOME } from "@/lib/openclaw-paths";

const GATEWAY_TIMEOUT_MS = 20_000;

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapGatewayResult<T>(payload: any): T {
  if (isPlainObject(payload) && "result" in payload) {
    return payload.result as T;
  }
  return payload as T;
}

type ConfigSnapshot = {
  valid?: boolean;
  hash?: string;
  raw?: string | null;
  config?: any;
};

async function getConfigSnapshot(): Promise<ConfigSnapshot> {
  return unwrapGatewayResult<ConfigSnapshot>(
    await callOpenclawGateway("config.get", {}, GATEWAY_TIMEOUT_MS),
  );
}

function normalizeErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "Unknown error";
}

/** 与常见 openclaw.json、各 agent 目录下 models.json 中每条 model 的 cost 形状一致 */
const DEFAULT_MODEL_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
} as const;

function normalizeModelCost(value: unknown): Record<string, number> {
  if (!isPlainObject(value)) return { ...DEFAULT_MODEL_COST };
  const c = value as Record<string, unknown>;
  return {
    input: typeof c.input === "number" && Number.isFinite(c.input) ? c.input : 0,
    output: typeof c.output === "number" && Number.isFinite(c.output) ? c.output : 0,
    cacheRead: typeof c.cacheRead === "number" && Number.isFinite(c.cacheRead) ? c.cacheRead : 0,
    cacheWrite: typeof c.cacheWrite === "number" && Number.isFinite(c.cacheWrite) ? c.cacheWrite : 0,
  };
}

/**
 * 将 provider/modelId 追加到 agents.defaults.model.fallbacks（与主模型 primary 去重）。
 * 支持 defaults.model 为字符串（视为 primary）或 { primary, fallbacks }。
 */
function mergeDefaultsModelFallback(existing: unknown, ref: string): Record<string, unknown> {
  if (typeof existing === "string") {
    const primary = existing.trim();
    if (!primary) return { fallbacks: [ref] };
    const fallbacks: string[] = [];
    if (ref !== primary) fallbacks.push(ref);
    return { primary, fallbacks };
  }
  if (isPlainObject(existing)) {
    const m = { ...existing };
    const primaryRaw = m.primary ?? m.default;
    const primary = typeof primaryRaw === "string" ? primaryRaw.trim() : "";
    let fallbacks = Array.isArray(m.fallbacks) ? m.fallbacks.map((x: unknown) => String(x)) : [];
    if (ref && ref !== primary && !fallbacks.includes(ref)) {
      fallbacks = [...fallbacks, ref];
    }
    return { ...m, fallbacks };
  }
  return { fallbacks: [ref] };
}

/**
 * 合并 agents.defaults.models 中单条别名，键为 provider/modelId，值为 { alias }。
 * 若该键已存在且已有非空 alias，则不覆盖（保留用户手改）。
 */
function mergeDefaultsModelsAlias(
  existing: unknown,
  modelRef: string,
  alias: string,
): Record<string, unknown> {
  const prev = isPlainObject(existing) ? { ...existing } : {};
  const safeAlias = typeof alias === "string" && alias.trim() ? alias.trim() : modelRef.split("/").pop() || modelRef;
  const cur = prev[modelRef];
  if (isPlainObject(cur)) {
    const existingAlias = typeof cur.alias === "string" ? cur.alias.trim() : "";
    prev[modelRef] = {
      ...cur,
      ...(!existingAlias ? { alias: safeAlias } : {}),
    };
  } else {
    prev[modelRef] = { alias: safeAlias };
  }
  return prev;
}

/** 确保发给 Gateway 的 patch 是合法 JSON 字符串（避免静默生成非法语法） */
function serializeConfigPatchRaw(patch: unknown): string {
  let raw: string;
  try {
    raw = JSON.stringify(patch);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`配置补丁无法序列化为 JSON：${msg}`);
  }
  try {
    JSON.parse(raw);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`配置补丁序列化结果不是合法 JSON：${msg}`);
  }
  return raw;
}

function statusForError(message: string): number {
  const lower = message.toLowerCase();
  if (lower.includes("config changed since last load")) return 409;
  if (lower.includes("missing") || lower.includes("invalid") || lower.includes("not found") || lower.includes("must")) {
    return 400;
  }
  if (
    lower.includes("gateway closed") ||
    lower.includes("timeout") ||
    lower.includes("econn") ||
    lower.includes("not running") ||
    lower.includes("abnormal closure")
  ) {
    return 503;
  }
  return 500;
}

/**
 * 将新模型写入 **openclaw.json**（经本机 Gateway `config.patch` 落盘）：
 * - `models.providers.<id>.models[]` 追加条目；
 * - 默认将 `provider/modelId` 追加到 `agents.defaults.model.fallbacks`（请求体 `skipFallbackAppend: true` 可跳过）。
 * - 请求体 `targetAgentId` 非空时：在 `agents.list` 中找到对应 `id`，将该条目的 `model` 设为 `provider/modelId`；
 *   并在 `agents.defaults.models` 下写入/合并 `{ "<ref>": { "alias": "…" } }`（与常见 openclaw.json 形状一致，合法 JSON）。
 * - 未传 `targetAgentId`（或空字符串）时：不写 `agents.list` / `agents.defaults.models`，仅按上面规则处理 fallbacks（及 providers）。
 * 不会修改各 Agent 目录下的 agent/models.json（仅由 OpenClaw 合并读取，供探测时合并上下文）。
 * 服务端会先对 provider/model 做一次 probe，失败则绝不写入。
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const providerId = String(body?.providerId || "").trim();
    const modelPayload = body?.model;

    if (!providerId || !isPlainObject(modelPayload)) {
      return NextResponse.json({ ok: false, error: "缺少 providerId 或 model 对象" }, { status: 400 });
    }

    const modelId = String(modelPayload.id || "").trim();
    if (!modelId) {
      return NextResponse.json({ ok: false, error: "模型 ID 不能为空" }, { status: 400 });
    }

    const overrideApiKey =
      typeof body?.overrideApiKey === "string" && body.overrideApiKey.trim()
        ? body.overrideApiKey.trim()
        : undefined;

    const skipFallbackAppend = body?.skipFallbackAppend === true;
    const targetAgentId =
      typeof body?.targetAgentId === "string" && body.targetAgentId.trim()
        ? body.targetAgentId.trim()
        : "";

    const probe = await probeModel({
      providerId,
      modelId,
      timeoutMs: DEFAULT_MODEL_PROBE_TIMEOUT_MS,
      ...(overrideApiKey ? { overrideApiKey } : {}),
    });
    if (!probe.ok) {
      const err = probe.error || "模型探测失败，未写入配置";
      return NextResponse.json(
        {
          ok: false,
          error: err,
          errorHint: humanizeModelProbeError(err),
          probe: {
            ok: false,
            status: probe.status,
            elapsed: probe.elapsed,
            source: probe.source,
            precision: probe.precision,
          },
        },
        { status: 400 },
      );
    }

    const snapshot = await getConfigSnapshot();
    if (snapshot?.valid === false || !isPlainObject(snapshot?.config)) {
      return NextResponse.json({ ok: false, error: "无法从 Gateway 读取有效配置" }, { status: 400 });
    }

    const baseHash = resolveConfigSnapshotHash(snapshot);
    if (!baseHash) {
      return NextResponse.json({ ok: false, error: "缺少配置 baseHash" }, { status: 500 });
    }

    const config = snapshot.config;
    if (!isPlainObject(config.models)) config.models = {};
    if (!isPlainObject(config.models.providers)) config.models.providers = {};
    const providers = config.models.providers as Record<string, any>;

    if (!isPlainObject(providers[providerId])) {
      return NextResponse.json(
        {
          ok: false,
          error: `配置中不存在 models.providers.${providerId}。请先在 openclaw.json 中定义该 provider，再添加模型条目。`,
        },
        { status: 400 },
      );
    }

    const providerEntry = providers[providerId];
    const modelsList = Array.isArray(providerEntry.models) ? [...providerEntry.models] : [];

    if (modelsList.some((m: any) => m && String(m.id) === modelId)) {
      return NextResponse.json(
        { ok: false, error: `模型「${modelId}」已存在于该 provider` },
        { status: 409 },
      );
    }

    const newEntry: Record<string, unknown> = {
      id: modelId,
      name:
        typeof modelPayload.name === "string" && modelPayload.name.trim()
          ? modelPayload.name.trim()
          : modelId,
    };

    // 与用户 openclaw.json 中 litellm 等 provider 的既有条目对齐：每条 model 常带与 provider 相同的 api
    const providerApi = typeof providerEntry.api === "string" ? providerEntry.api.trim() : "";
    const payloadApi = typeof modelPayload.api === "string" ? modelPayload.api.trim() : "";
    if (payloadApi) newEntry.api = payloadApi;
    else if (providerApi) newEntry.api = providerApi;

    if (typeof modelPayload.contextWindow === "number" && Number.isFinite(modelPayload.contextWindow) && modelPayload.contextWindow > 0) {
      newEntry.contextWindow = Math.floor(modelPayload.contextWindow);
    }
    if (typeof modelPayload.maxTokens === "number" && Number.isFinite(modelPayload.maxTokens) && modelPayload.maxTokens > 0) {
      newEntry.maxTokens = Math.floor(modelPayload.maxTokens);
    }
    if (typeof modelPayload.reasoning === "boolean") {
      newEntry.reasoning = modelPayload.reasoning;
    }
    if (Array.isArray(modelPayload.input) && modelPayload.input.length > 0) {
      newEntry.input = modelPayload.input.filter((x: unknown) => typeof x === "string");
    }

    newEntry.cost = normalizeModelCost(modelPayload.cost);

    modelsList.push(newEntry);

    const modelRef = `${providerId}/${modelId}`;

    const patch: Record<string, unknown> = {
      models: {
        providers: {
          [providerId]: {
            ...providerEntry,
            models: modelsList,
          },
        },
      },
    };

    let fallbacksAfter: string[] | null = null;
    let agentListModelUpdated = false;

    const needAgentsPatch = !skipFallbackAppend || Boolean(targetAgentId);
    if (needAgentsPatch) {
      const baseAgents = isPlainObject(config.agents) ? { ...config.agents } : {};
      const listArr = Array.isArray(baseAgents.list) ? [...baseAgents.list] : null;
      let nextDefaults = isPlainObject(baseAgents.defaults) ? { ...baseAgents.defaults } : {};

      if (!skipFallbackAppend) {
        const mergedModel = mergeDefaultsModelFallback(nextDefaults.model, modelRef);
        nextDefaults.model = mergedModel;
        if (Array.isArray(mergedModel.fallbacks)) {
          fallbacksAfter = mergedModel.fallbacks.map(String);
        }
      }

      let updatedList: typeof listArr = listArr;
      if (targetAgentId) {
        if (!listArr) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "配置中缺少 agents.list 数组，无法绑定具体 Agent。请先在 openclaw.json 中配置 agents.list，或不要指定 targetAgentId。",
            },
            { status: 400 },
          );
        }
        const idx = listArr.findIndex((a: any) => a && String(a.id) === targetAgentId);
        if (idx < 0) {
          return NextResponse.json(
            {
              ok: false,
              error: `agents.list 中不存在 id 为「${targetAgentId}」的条目。请先在 openclaw.json 中声明该 Agent，或不要指定 targetAgentId（仅追加全局 fallbacks）。`,
            },
            { status: 400 },
          );
        }
        const entry = listArr[idx];
        listArr[idx] = isPlainObject(entry)
          ? { ...entry, model: modelRef }
          : { id: targetAgentId, model: modelRef };
        updatedList = listArr;
        agentListModelUpdated = true;

        const aliasForDefaults =
          typeof newEntry.name === "string" && String(newEntry.name).trim()
            ? String(newEntry.name).trim()
            : modelId;
        const prevModels = isPlainObject(nextDefaults.models) ? nextDefaults.models : {};
        nextDefaults.models = mergeDefaultsModelsAlias(prevModels, modelRef, aliasForDefaults);
      }

      patch.agents = {
        ...baseAgents,
        defaults: nextDefaults,
        ...(updatedList !== null && targetAgentId ? { list: updatedList } : {}),
      };
    }

    const patchRaw = serializeConfigPatchRaw(patch);

    await callOpenclawGateway(
      "config.patch",
      {
        raw: patchRaw,
        baseHash,
        note: `Dashboard: 添加模型 ${providerId}/${modelId}${skipFallbackAppend ? "" : " + defaults.fallbacks"}${targetAgentId ? ` + agent ${targetAgentId}` : ""}`,
      },
      GATEWAY_TIMEOUT_MS,
    );

    clearConfigCache();
    await syncOpenclawToMysql("api:config-add-provider-model");

    return NextResponse.json({
      ok: true,
      providerId,
      model: newEntry,
      modelRef,
      targetAgentId: targetAgentId || undefined,
      agentListModelUpdated,
      appendedToDefaultsFallbacks: !skipFallbackAppend,
      agentsDefaultsFallbacks: fallbacksAfter,
      /** 仪表盘读取列表所用的文件（未设置 OPENCLAW_HOME 时即 %USERPROFILE%\.openclaw\openclaw.json） */
      configPath: OPENCLAW_CONFIG_PATH,
      openclawHome: OPENCLAW_HOME,
      configPathPosix: OPENCLAW_CONFIG_PATH.split(path.sep).join("/"),
      probe: {
        ok: true,
        elapsed: probe.elapsed,
        source: probe.source,
        precision: probe.precision,
      },
    });
  } catch (err) {
    const error = normalizeErrorMessage(err);
    return NextResponse.json(
      {
        ok: false,
        error,
        configPath: OPENCLAW_CONFIG_PATH,
        openclawHome: OPENCLAW_HOME,
        configPathPosix: OPENCLAW_CONFIG_PATH.split(path.sep).join("/"),
      },
      { status: statusForError(error) },
    );
  }
}
