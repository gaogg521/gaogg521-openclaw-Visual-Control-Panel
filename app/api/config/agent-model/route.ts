import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { clearConfigCache } from "@/lib/config-cache";
import { callOpenclawGateway, resolveConfigSnapshotHash } from "@/lib/openclaw-cli";
import { syncOpenclawToMysql } from "@/lib/db-sync";
import { enforceLocalRequest } from "@/lib/api-local-guard";
import { detectAndFixOpenclawHome, getResolvedConfigPath, getResolvedOpenclawHome } from "@/lib/openclaw-home-detect";

const GATEWAY_CALL_TIMEOUT_MS = 15000;
const GATEWAY_RECOVERY_TIMEOUT_MS = 45000;
const GATEWAY_RECOVERY_POLL_MS = 1000;

type ConfigSnapshot = {
  valid?: boolean;
  hash?: string;
  raw?: string | null;
  config?: any;
};

const SESSION_MODEL_FIELDS_TO_CLEAR = [
  "providerOverride",
  "modelOverride",
  "authProfileOverride",
  "authProfileOverrideSource",
  "authProfileOverrideCompactionCount",
  "fallbackNoticeSelectedModel",
  "fallbackNoticeActiveModel",
  "fallbackNoticeReason",
  "claudeCliSessionId",
  "modelProvider",
  "model",
] as const;

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapGatewayResult<T>(payload: any): T {
  if (isPlainObject(payload) && "result" in payload) {
    return payload.result as T;
  }
  return payload as T;
}

function normalizeErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "Unknown error";
}

function statusForError(message: string): number {
  const lower = message.toLowerCase();
  if (lower.includes("config changed since last load")) return 409;
  if (lower.includes("missing") || lower.includes("invalid") || lower.includes("not found") || lower.includes("must")) return 400;
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

/** 判断是否为「连不上 Gateway」类错误，可降级为直接写 openclaw.json */
function isLikelyGatewayUnreachable(err: unknown): boolean {
  const msg = normalizeErrorMessage(err).toLowerCase();
  return (
    msg.includes("gateway closed") ||
    msg.includes("gateway call failed") ||
    msg.includes("abnormal closure") ||
    msg.includes("normal closure") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("timeout") ||
    msg.includes("not running") ||
    msg.includes("connect failed") ||
    msg.includes("websocket") ||
    msg.includes("failed to connect") ||
    msg.includes("socket hang up") ||
    msg.includes("network error")
  );
}

function writeOpenclawJsonAtomic(configPath: string, config: unknown): void {
  const payload = `${JSON.stringify(config, null, 2)}\n`;
  const tmpPath = `${configPath}.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, payload, "utf8");
  fs.renameSync(tmpPath, configPath);
}

function findAgentConfigEntry(config: any, agentId: string): Record<string, any> | null {
  const agentList = Array.isArray(config?.agents?.list) ? config.agents.list : null;
  if (!agentList) return null;
  const entry = agentList.find((agent: any) => agent && agent.id === agentId);
  return isPlainObject(entry) ? entry : null;
}

function addModelRef(set: Set<string>, value: unknown): void {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (!trimmed || !trimmed.includes("/")) return;
  set.add(trimmed);
}

function collectKnownModels(config: any): Set<string> {
  const models = new Set<string>();

  const providers = isPlainObject(config?.models?.providers) ? config.models.providers : {};
  for (const [providerId, provider] of Object.entries(providers)) {
    const providerModels = Array.isArray((provider as any)?.models) ? (provider as any).models : [];
    for (const model of providerModels) {
      addModelRef(models, `${providerId}/${model?.id ?? ""}`);
    }
  }

  const defaultsModel = config?.agents?.defaults?.model;
  if (typeof defaultsModel === "string") {
    addModelRef(models, defaultsModel);
  } else if (isPlainObject(defaultsModel)) {
    addModelRef(models, defaultsModel.primary);
    const fallbacks = Array.isArray(defaultsModel.fallbacks) ? defaultsModel.fallbacks : [];
    for (const fallback of fallbacks) addModelRef(models, fallback);
  }

  const defaultsModels = isPlainObject(config?.agents?.defaults?.models) ? config.agents.defaults.models : {};
  for (const modelKey of Object.keys(defaultsModels)) {
    addModelRef(models, modelKey);
  }

  const agentList = Array.isArray(config?.agents?.list) ? config.agents.list : [];
  for (const agent of agentList) {
    if (!agent) continue;
    addModelRef(models, agent.model);
    if (isPlainObject(agent.model)) {
      addModelRef(models, agent.model.primary);
      addModelRef(models, agent.model.default);
    }
  }

  return models;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getConfigSnapshot(): Promise<ConfigSnapshot> {
  return unwrapGatewayResult<ConfigSnapshot>(
    await callOpenclawGateway("config.get", {}, GATEWAY_CALL_TIMEOUT_MS),
  );
}

async function waitForPatchedModel(agentId: string, model: string): Promise<void> {
  const deadline = Date.now() + GATEWAY_RECOVERY_TIMEOUT_MS;
  let lastError = "";

  while (Date.now() < deadline) {
    await sleep(GATEWAY_RECOVERY_POLL_MS);
    try {
      const snapshot = await getConfigSnapshot();
      const config = snapshot?.config;
      const agentEntry = findAgentConfigEntry(config, agentId);
      if (agentEntry && typeof agentEntry.model === "string" && agentEntry.model.trim() === model) {
        return;
      }
    } catch (err) {
      lastError = normalizeErrorMessage(err);
    }
  }

  throw new Error(lastError || "Timed out waiting for Gateway to apply the new model");
}

function clearAgentSessionModelState(agentId: string): void {
  const home = getResolvedOpenclawHome();
  const sessionsPath = path.join(home, "agents", agentId, "sessions", "sessions.json");
  if (!fs.existsSync(sessionsPath)) return;

  const raw = fs.readFileSync(sessionsPath, "utf8");
  const sessions = JSON.parse(raw);
  if (!isPlainObject(sessions)) return;

  let changed = false;
  for (const value of Object.values(sessions)) {
    if (!isPlainObject(value)) continue;
    for (const field of SESSION_MODEL_FIELDS_TO_CLEAR) {
      if (Object.prototype.hasOwnProperty.call(value, field)) {
        delete value[field];
        changed = true;
      }
    }
  }

  if (!changed) return;

  const tmpPath = `${sessionsPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(sessions, null, 2), "utf8");
  fs.renameSync(tmpPath, sessionsPath);
}

export async function PATCH(request: Request) {
  const guard = enforceLocalRequest(request, "Agent model API");
  if (guard) return guard;
  try {
    const body = await request.json().catch(() => null);
    const agentId = String(body?.agentId || "").trim();
    const model = String(body?.model || "").trim();

    if (!agentId || !model) {
      return NextResponse.json({ ok: false, error: "Missing agentId or model" }, { status: 400 });
    }

    let snapshot: ConfigSnapshot;
    let appliedViaFile = false;

    try {
      snapshot = await getConfigSnapshot();
    } catch (gwErr) {
      if (!isLikelyGatewayUnreachable(gwErr)) {
        const error = normalizeErrorMessage(gwErr);
        return NextResponse.json({ ok: false, error }, { status: statusForError(error) });
      }
      try {
        detectAndFixOpenclawHome();
        const configPath = getResolvedConfigPath();
        const raw = fs.readFileSync(configPath, "utf8");
        const diskConfig = JSON.parse(raw);
        if (!isPlainObject(diskConfig)) {
          throw new Error("openclaw.json is not a JSON object");
        }
        snapshot = { valid: true, config: diskConfig, raw };
        appliedViaFile = true;
      } catch (fileErr) {
        const gw = normalizeErrorMessage(gwErr);
        const fe = normalizeErrorMessage(fileErr);
        const error = `网关不可用（${gw}），且无法读取本地配置（${fe}）。请先启动 OpenClaw 网关后再试，或检查 openclaw.json 是否可读。`;
        return NextResponse.json({ ok: false, error }, { status: 503 });
      }
    }

    if (snapshot?.valid === false || !isPlainObject(snapshot?.config)) {
      return NextResponse.json({ ok: false, error: "Gateway config is invalid or unavailable" }, { status: 400 });
    }

    const config = snapshot.config;
    const agentEntry = findAgentConfigEntry(config, agentId);
    if (!agentEntry) {
      return NextResponse.json({ ok: false, error: `Agent not found in agents.list: ${agentId}` }, { status: 404 });
    }

    const knownModels = collectKnownModels(config);
    if (!knownModels.has(model)) {
      return NextResponse.json({ ok: false, error: `Unknown model: ${model}` }, { status: 400 });
    }

    if (appliedViaFile) {
      agentEntry.model = model;
      detectAndFixOpenclawHome();
      writeOpenclawJsonAtomic(getResolvedConfigPath(), config);
      clearConfigCache();
      clearAgentSessionModelState(agentId);
      clearConfigCache();
      await syncOpenclawToMysql("api:config-agent-model");

      return NextResponse.json({
        ok: true,
        agentId,
        model,
        applied: true,
        resetSessions: true,
        appliedViaFile: true,
      });
    }

    const baseHash = resolveConfigSnapshotHash(snapshot);
    if (!baseHash) {
      return NextResponse.json({ ok: false, error: "Missing baseHash from config snapshot" }, { status: 500 });
    }

    const patch = {
      agents: {
        list: [
          {
            id: agentId,
            model,
          },
        ],
      },
    };

    await callOpenclawGateway(
      "config.patch",
      {
        raw: JSON.stringify(patch),
        baseHash,
        note: `Dashboard updated ${agentId} model to ${model}`,
      },
      GATEWAY_CALL_TIMEOUT_MS,
    );

    clearConfigCache();
    await waitForPatchedModel(agentId, model);
    clearAgentSessionModelState(agentId);
    clearConfigCache();
    await syncOpenclawToMysql("api:config-agent-model");

    return NextResponse.json({
      ok: true,
      agentId,
      model,
      applied: true,
      resetSessions: true,
    });
  } catch (err) {
    const error = normalizeErrorMessage(err);
    return NextResponse.json({ ok: false, error }, { status: statusForError(error) });
  }
}
