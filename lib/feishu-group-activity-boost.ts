import fs from "fs";
import path from "path";
import { resolveAgentSessionsDir } from "@/lib/agent-runtime-paths";
import { OPENCLAW_HOME } from "@/lib/openclaw-paths";

/** 与 gateway-agent-activity-hint 一致：兼容秒/毫秒时间戳 */
export function coerceToActivityMs(v: unknown): number {
  if (typeof v === "string" && v.trim()) {
    const parsed = Date.parse(v.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return 0;
  if (v > 1e12 && v < 4e12) return v;
  if (v > 1e9 && v < 2e10) return v * 1000;
  return 0;
}

const AGENT_PREFIX = /^agent:([^:]+):/;

/** 从任意 session key 中截取飞书群 open_chat_id（兼容 feishu / lark 等通道名） */
export function extractFeishuGroupIdFromSessionKey(key: string): string | null {
  const markers = [":feishu:group:", ":lark:group:", ":Feishu:group:", ":Lark:group:"];
  for (const mk of markers) {
    const i = key.indexOf(mk);
    if (i >= 0) {
      const rest = key.slice(i + mk.length).trim();
      if (rest) return rest.split(":")[0] || rest;
    }
  }
  return null;
}

/**
 * 从 openclaw.json 的 binding.match 中尽量解析飞书群 open_chat_id（如 oc_xxxx）。
 * 不同 OpenClaw 版本字段名可能不同，多路径尝试。
 */
export function extractFeishuGroupIdFromMatch(match: unknown): string | null {
  if (!match || typeof match !== "object") return null;
  const m = match as Record<string, unknown>;
  const ch = m.channel;
  const chStr = typeof ch === "string" ? ch.toLowerCase() : "";
  if (chStr && chStr !== "feishu" && chStr !== "lark") return null;

  for (const k of ["groupId", "chatId", "openChatId", "peerId"] as const) {
    const v = m[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  const peer = m.peer;
  if (peer && typeof peer === "object") {
    const p = peer as Record<string, unknown>;
    for (const k of ["id", "openChatId", "chatId"] as const) {
      const v = p[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }

  if (typeof m.peerKey === "string") {
    const pk = m.peerKey.trim();
    const g1 = pk.match(/(?:^|:)group:([^:]+)$/i);
    if (g1?.[1]) return g1[1].trim();
    if (/^oc_[a-f0-9]+$/i.test(pk)) return pk;
  }

  return null;
}

function mergeSessionsJsonFeishuGroups(sessionsJsonPath: string, out: Map<string, number>): void {
  try {
    const raw = fs.readFileSync(sessionsJsonPath, "utf-8");
    const obj = JSON.parse(raw) as Record<string, unknown>;
    for (const [key, val] of Object.entries(obj)) {
      const gid = extractFeishuGroupIdFromSessionKey(key);
      if (!gid) continue;
      const u = coerceToActivityMs((val as { updatedAt?: unknown })?.updatedAt);
      const prev = out.get(gid) || 0;
      if (u > prev) out.set(gid, u);
    }
  } catch {
    /* missing or invalid */
  }
}

function mergeSessionsJsonFeishuOwners(sessionsJsonPath: string, out: Map<string, number>): void {
  try {
    const raw = fs.readFileSync(sessionsJsonPath, "utf-8");
    const obj = JSON.parse(raw) as Record<string, unknown>;
    for (const [key, val] of Object.entries(obj)) {
      if (!extractFeishuGroupIdFromSessionKey(key)) continue;
      const om = key.match(AGENT_PREFIX);
      if (!om?.[1]) continue;
      const owner = om[1].trim();
      const u = coerceToActivityMs((val as { updatedAt?: unknown })?.updatedAt);
      const prev = out.get(owner) || 0;
      if (u > prev) out.set(owner, u);
    }
  } catch {
    /* missing or invalid */
  }
}

function mergeJsonlFeishuOwnerActivity(sessionsDir: string, out: Map<string, number>): void {
  const now = Date.now();
  let files: { name: string; mtime: number }[];
  try {
    files = fs
      .readdirSync(sessionsDir)
      .filter((f) => f.endsWith(".jsonl") && !f.includes(".deleted."))
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 8);
  } catch {
    return;
  }

  for (const file of files) {
    if (now - file.mtime > 24 * 60 * 60 * 1000) continue;
    try {
      const content = fs.readFileSync(path.join(sessionsDir, file.name), "utf-8");
      const lines = content.trim().split("\n");
      const scanFrom = Math.max(0, lines.length - 120);
      for (let i = lines.length - 1; i >= scanFrom; i--) {
        try {
          const entry = JSON.parse(lines[i]) as {
            type?: string;
            timestamp?: string;
            sessionKey?: string;
          };
          if (entry.type !== "message" || !entry.timestamp) continue;
          const sk = entry.sessionKey;
          if (typeof sk !== "string" || !extractFeishuGroupIdFromSessionKey(sk)) continue;
          const om = sk.match(AGENT_PREFIX);
          if (!om?.[1]) continue;
          const owner = om[1].trim();
          const ts = new Date(entry.timestamp).getTime();
          if (!Number.isFinite(ts)) continue;
          const prev = out.get(owner) || 0;
          if (ts > prev) out.set(owner, ts);
        } catch {
          /* skip line */
        }
      }
    } catch {
      /* skip file */
    }
  }
}

function mergeJsonlFeishuGroupActivity(sessionsDir: string, out: Map<string, number>): void {
  const now = Date.now();
  let files: { name: string; mtime: number }[];
  try {
    files = fs
      .readdirSync(sessionsDir)
      .filter((f) => f.endsWith(".jsonl") && !f.includes(".deleted."))
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 8);
  } catch {
    return;
  }

  for (const file of files) {
    if (now - file.mtime > 24 * 60 * 60 * 1000) continue;
    try {
      const content = fs.readFileSync(path.join(sessionsDir, file.name), "utf-8");
      const lines = content.trim().split("\n");
      const scanFrom = Math.max(0, lines.length - 120);
      for (let i = lines.length - 1; i >= scanFrom; i--) {
        try {
          const entry = JSON.parse(lines[i]) as {
            type?: string;
            timestamp?: string;
            sessionKey?: string;
          };
          if (entry.type !== "message" || !entry.timestamp) continue;
          const sk = entry.sessionKey;
          if (typeof sk !== "string") continue;
          const gid = extractFeishuGroupIdFromSessionKey(sk);
          if (!gid) continue;
          const ts = new Date(entry.timestamp).getTime();
          if (!Number.isFinite(ts)) continue;
          const prev = out.get(gid) || 0;
          if (ts > prev) out.set(gid, ts);
        } catch {
          /* skip line */
        }
      }
    } catch {
      /* skip file */
    }
  }
}

/** 合并扫描：各 agent 会话目录 + 常见的 main 落盘目录（多专家时消息常只在 main 下）。 */
function collectSessionDirsForFeishuScan(agentIds: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const pushDir = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    let canon: string;
    try {
      canon = fs.realpathSync(dir);
    } catch {
      canon = path.resolve(dir);
    }
    if (seen.has(canon)) return;
    seen.add(canon);
    out.push(dir);
  };
  for (const id of agentIds) pushDir(resolveAgentSessionsDir(id));
  pushDir(path.join(OPENCLAW_HOME, "agents", "main", "sessions"));
  pushDir(path.join(OPENCLAW_HOME, "agents", "main", "agent", "sessions"));
  return out;
}

/**
 * 汇总「每个飞书群 open_chat_id → 最后活动时间 ms」。
 * 扫描各 agent 目录 + agents/main/sessions（总指挥目录）。
 */
export function aggregateFeishuGroupActivityMsByGroup(agentIds: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const dir of collectSessionDirsForFeishuScan(agentIds)) {
    mergeSessionsJsonFeishuGroups(path.join(dir, "sessions.json"), out);
    mergeJsonlFeishuGroupActivity(dir, out);
  }
  return out;
}

/**
 * session key 形如 agent:<owner>:feishu:group:... 时，把该会话的 updatedAt 归到 <owner>（常为 main）。
 */
export function aggregateFeishuSessionOwnerActivityMs(agentIds: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const dir of collectSessionDirsForFeishuScan(agentIds)) {
    mergeSessionsJsonFeishuOwners(path.join(dir, "sessions.json"), out);
    mergeJsonlFeishuOwnerActivity(dir, out);
  }
  return out;
}

export function maxAllFeishuGroupActivity(groupActivity: Map<string, number>): number {
  let m = 0;
  for (const t of groupActivity.values()) {
    if (t > m) m = t;
  }
  return m;
}

function feishuGroupIdsFromBindings(agentId: string, bindings: unknown[]): string[] {
  if (!Array.isArray(bindings)) return [];
  const ids: string[] = [];
  for (const b of bindings) {
    if (!b || typeof b !== "object") continue;
    const row = b as { agentId?: string; agentID?: string; agent_id?: string; match?: unknown };
    const aid = row.agentId ?? row.agentID ?? row.agent_id;
    if (aid !== agentId) continue;
    const gid = extractFeishuGroupIdFromMatch(row.match);
    if (gid) ids.push(gid);
  }
  return ids;
}

/** 可选：在 agents.list 单条上写 feishuOpenChatId / feishuGroupId（或 identity.feishuOpenChatId）绑定 OC 群，无需 bindings 里带群 id。 */
function feishuGroupIdsFromAgentEntry(agent: Record<string, unknown>): string[] {
  const ids: string[] = [];
  const pick = (v: unknown) => {
    if (typeof v === "string" && v.trim()) ids.push(v.trim());
  };
  pick(agent.feishuOpenChatId);
  pick(agent.feishuGroupId);
  const idObj = agent.identity;
  if (idObj && typeof idObj === "object") {
    pick((idObj as { feishuOpenChatId?: unknown }).feishuOpenChatId);
    pick((idObj as { feishuGroupId?: unknown }).feishuGroupId);
  }
  return ids;
}

/**
 * 取该 Agent 绑定的飞书群 ID 列表（bindings + 可选 agents.list 自定义字段）。
 */
export function collectFeishuGroupIdsForAgent(
  agentId: string,
  agentEntry: Record<string, unknown> | undefined,
  bindings: unknown[],
): string[] {
  const fromBind = feishuGroupIdsFromBindings(agentId, bindings);
  const fromEntry = agentEntry ? feishuGroupIdsFromAgentEntry(agentEntry) : [];
  return Array.from(new Set([...fromBind, ...fromEntry]));
}

export function maxFeishuGroupActivityForAgent(
  groupActivity: Map<string, number>,
  groupIds: string[],
): number {
  let max = 0;
  for (const g of groupIds) {
    const t = groupActivity.get(g) || 0;
    if (t > max) max = t;
  }
  return max;
}
