import { callOpenclawGateway } from "@/lib/openclaw-cli";

/** 单次 gateway call 超时；多种方法串行调用，避免长时间阻塞告警检查 */
const PER_CALL_TIMEOUT_MS = 9000;

const GATEWAY_METHOD_CANDIDATES = [
  "sessions.usage",
  "sessions.list",
  "node.list",
  "sessions.status",
  "status",
] as const;

function coerceToMs(v: unknown): number {
  if (typeof v === "string" && v.trim()) {
    const parsed = Date.parse(v.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  if (v > 1e12 && v < 4e12) return v;
  if (v > 1e9 && v < 2e10) return v * 1000;
  return 0;
}

function pickNumericActivityMs(o: Record<string, unknown>): number {
  const keys = [
    "lastActive",
    "lastActivityAt",
    "updatedAt",
    "lastSeenAt",
    "lastMessageAt",
    "lastRunAtMs",
    "lastRunAt",
    "activeAt",
    "lastUsedAt",
    "touchedAt",
    "mtimeMs",
    "mtime",
    "ts",
    "time",
    "at",
  ];
  let best = 0;
  for (const k of keys) {
    const t = coerceToMs(o[k]);
    if (t > best) best = t;
  }
  return best;
}

function mergeMax(m: Map<string, number>, id: string, t: number): void {
  if (!id || t <= 0) return;
  const prev = m.get(id) ?? 0;
  if (t > prev) m.set(id, t);
}

function mergeMaps(target: Map<string, number>, source: Map<string, number>): void {
  for (const [id, t] of source) mergeMax(target, id, t);
}

/** 从 OpenClaw sessionKey 提取 agentId，如 agent:agent-1one:feishu:group:... */
function agentIdFromSessionKey(key: string): string | null {
  const m = key.match(/^agent:([^:]+):/);
  return m && m[1] ? m[1].trim() : null;
}

const AGENT_ID_KEY_RE = /^agent-[a-z0-9_-]+$/i;

function unwrapGatewayPayload(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const p = parsed as Record<string, unknown>;
  if (p.rpc && typeof p.rpc === "object") {
    const rpc = p.rpc as Record<string, unknown>;
    if (rpc.ok === false) return null;
    const inner =
      rpc.result ?? rpc.data ?? rpc.payload ?? rpc.body ?? rpc.value;
    if (inner !== undefined) return inner;
  }
  return p.result ?? p.data ?? p.payload ?? p.body ?? parsed;
}

/**
 * 深度遍历 Gateway 返回 JSON，收集 agentId → 最近活动时间戳（毫秒）。
 */
export function collectAgentActivityFromGatewayPayload(raw: unknown): Map<string, number> {
  const out = new Map<string, number>();

  const visit = (node: unknown, depth: number) => {
    if (depth > 22 || node == null) return;
    if (Array.isArray(node)) {
      for (const x of node) visit(x, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    const o = node as Record<string, unknown>;

    const idRaw =
      (typeof o.agentId === "string" && o.agentId.trim()) ||
      (typeof o.agent === "string" && o.agent.trim()) ||
      (typeof o.id === "string" && (o.id.startsWith("agent-") || o.id === "main") ? o.id : "");
    if (idRaw) {
      const t = pickNumericActivityMs(o);
      if (t > 0) mergeMax(out, idRaw, t);
    }

    const sk = o.sessionKey ?? o.key ?? o.session;
    if (typeof sk === "string" && sk.startsWith("agent:")) {
      const aid = agentIdFromSessionKey(sk);
      if (aid) {
        const t = pickNumericActivityMs(o);
        if (t > 0) mergeMax(out, aid, t);
      }
    }

    for (const [k, v] of Object.entries(o)) {
      if ((AGENT_ID_KEY_RE.test(k) || k === "main") && v && typeof v === "object" && !Array.isArray(v)) {
        const t = pickNumericActivityMs(v as Record<string, unknown>);
        if (t > 0) mergeMax(out, k, t);
      }
    }

    for (const v of Object.values(o)) visit(v, depth + 1);
  };

  visit(raw, 0);
  return out;
}

async function tryOneGatewayMethod(method: string): Promise<Map<string, number>> {
  try {
    const parsed = await callOpenclawGateway(method, {}, PER_CALL_TIMEOUT_MS);
    const payload = unwrapGatewayPayload(parsed);
    if (payload == null) return new Map();
    return collectAgentActivityFromGatewayPayload(payload);
  } catch {
    return new Map();
  }
}

/**
 * 串行调用多种 Gateway RPC 并合并 agent 活动时间。
 * 曾用 Promise.allSettled 并行 6 路：每路都会 exec 一个 openclaw/node 子进程；再叠加上层 withTimeout
 * 提前返回时后台仍跑满 6 路，任务管理器里会出现上百个 Node。此处任意时刻最多 1 个子进程。
 */
export async function fetchGatewayAgentActivityMap(opts?: { signal?: AbortSignal }): Promise<Map<string, number>> {
  const signal = opts?.signal;
  const merged = new Map<string, number>();
  for (const method of GATEWAY_METHOD_CANDIDATES) {
    if (signal?.aborted) break;
    const m = await tryOneGatewayMethod(method);
    mergeMaps(merged, m);
  }
  return merged;
}
