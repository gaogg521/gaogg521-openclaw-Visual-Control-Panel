import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getMysqlPool } from "@/lib/mysql";
import { OPENCLAW_AGENTS_DIR, OPENCLAW_CONFIG_PATH } from "@/lib/openclaw-paths";
import { parseOpenclawConfigText } from "@/lib/openclaw-config-read";

type SyncSummary = {
  configHash: string;
  agents: number;
  channels: number;
  sessions: number;
};

const CONFIG_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS oc_config_snapshots (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  config_hash VARCHAR(64) NOT NULL UNIQUE,
  config_json LONGTEXT NOT NULL,
  source VARCHAR(64) NOT NULL DEFAULT 'openclaw.json',
  captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const RUNS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS oc_sync_runs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  reason VARCHAR(128) NOT NULL,
  status VARCHAR(16) NOT NULL,
  message TEXT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const AGENTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS oc_agents (
  agent_id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  model VARCHAR(255) NOT NULL,
  emoji VARCHAR(32) NULL,
  workspace TEXT NULL,
  raw_json JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const CHANNELS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS oc_channels (
  channel_id VARCHAR(128) PRIMARY KEY,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  raw_json JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const SESSIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS oc_sessions (
  session_key VARCHAR(512) PRIMARY KEY,
  agent_id VARCHAR(128) NOT NULL,
  session_id VARCHAR(128) NULL,
  channel VARCHAR(64) NULL,
  chat_type VARCHAR(32) NULL,
  updated_at_ms BIGINT NULL,
  raw_json JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_oc_sessions_agent_id (agent_id),
  INDEX idx_oc_sessions_channel (channel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

function parseSessionMeta(sessionKey: string): { channel: string | null; chatType: string | null } {
  const m = sessionKey.match(/^agent:[^:]+:([^:]+):(direct|group|channel):/);
  if (!m) return { channel: null, chatType: null };
  return { channel: m[1] || null, chatType: m[2] || null };
}

function readConfig(): { raw: string; config: any } {
  const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf-8");
  return { raw, config: parseOpenclawConfigText(raw) };
}

function buildAgents(config: any): Array<{ id: string; name: string; model: string; emoji: string | null; workspace: string | null; raw: any }> {
  const defaults = config?.agents?.defaults || {};
  const defaultModel =
    typeof defaults.model === "string"
      ? defaults.model
      : defaults.model?.primary || "unknown";
  const list = Array.isArray(config?.agents?.list) ? config.agents.list : [];
  return list.map((agent: any) => ({
    id: String(agent?.id || "").trim(),
    name: String(agent?.name || agent?.id || "unknown"),
    model:
      typeof agent?.model === "string"
        ? agent.model
        : (agent?.model?.primary || defaultModel || "unknown"),
    emoji: typeof agent?.identity?.emoji === "string" ? agent.identity.emoji : null,
    workspace: typeof agent?.workspace === "string" ? agent.workspace : null,
    raw: agent || {},
  })).filter((agent: { id: string }) => agent.id.length > 0);
}

function buildChannels(config: any): Array<{ id: string; enabled: number; raw: any }> {
  const channels = config?.channels;
  if (!channels || typeof channels !== "object" || Array.isArray(channels)) return [];
  return Object.entries(channels).map(([id, raw]: [string, any]) => ({
    id,
    enabled: raw?.enabled === false ? 0 : 1,
    raw: raw ?? {},
  }));
}

function buildSessions(): Array<{
  sessionKey: string;
  agentId: string;
  sessionId: string | null;
  channel: string | null;
  chatType: string | null;
  updatedAtMs: number | null;
  raw: any;
}> {
  const rows: Array<{
    sessionKey: string;
    agentId: string;
    sessionId: string | null;
    channel: string | null;
    chatType: string | null;
    updatedAtMs: number | null;
    raw: any;
  }> = [];

  let agentIds: string[] = [];
  try {
    agentIds = fs.readdirSync(OPENCLAW_AGENTS_DIR).filter((name) => {
      try {
        return fs.statSync(path.join(OPENCLAW_AGENTS_DIR, name)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return rows;
  }

  for (const agentId of agentIds) {
    const sessionsPath = path.join(OPENCLAW_AGENTS_DIR, agentId, "sessions", "sessions.json");
    if (!fs.existsSync(sessionsPath)) continue;

    let sessionsObj: any;
    try {
      sessionsObj = JSON.parse(fs.readFileSync(sessionsPath, "utf-8"));
    } catch {
      continue;
    }
    if (!sessionsObj || typeof sessionsObj !== "object" || Array.isArray(sessionsObj)) continue;

    for (const [sessionKey, sessionVal] of Object.entries(sessionsObj)) {
      const safeKey = String(sessionKey || "").trim();
      if (!safeKey) continue;
      const meta = parseSessionMeta(safeKey);
      rows.push({
        sessionKey: safeKey,
        agentId,
        sessionId: typeof (sessionVal as any)?.sessionId === "string" ? (sessionVal as any).sessionId : null,
        channel: meta.channel,
        chatType: meta.chatType,
        updatedAtMs:
          typeof (sessionVal as any)?.updatedAt === "number"
            ? (sessionVal as any).updatedAt
            : null,
        raw: sessionVal ?? {},
      });
    }
  }

  return rows;
}

export async function ensureStorageSchema(): Promise<void> {
  const pool = getMysqlPool();
  await pool.query(RUNS_TABLE_SQL);
  await pool.query(CONFIG_TABLE_SQL);
  await pool.query(AGENTS_TABLE_SQL);
  await pool.query(CHANNELS_TABLE_SQL);
  await pool.query(SESSIONS_TABLE_SQL);
}

export async function syncOpenclawToMysql(reason = "manual"): Promise<SyncSummary> {
  const pool = getMysqlPool();
  await ensureStorageSchema();

  const [runResult] = await pool.query(
    "INSERT INTO oc_sync_runs (reason, status, message) VALUES (?, 'running', '')",
    [reason],
  );
  const runId = (runResult as any).insertId as number;

  try {
    const { raw, config } = readConfig();
    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    const agents = buildAgents(config);
    const channels = buildChannels(config);
    const sessions = buildSessions();

    await pool.query(
      `INSERT INTO oc_config_snapshots (config_hash, config_json, source)
       VALUES (?, ?, 'openclaw.json')
       ON DUPLICATE KEY UPDATE config_json = VALUES(config_json), captured_at = CURRENT_TIMESTAMP`,
      [hash, raw],
    );

    for (const agent of agents) {
      await pool.query(
        `INSERT INTO oc_agents (agent_id, name, model, emoji, workspace, raw_json)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           model = VALUES(model),
           emoji = VALUES(emoji),
           workspace = VALUES(workspace),
           raw_json = VALUES(raw_json)`,
        [agent.id, agent.name, agent.model, agent.emoji, agent.workspace, JSON.stringify(agent.raw)],
      );
    }

    for (const channel of channels) {
      await pool.query(
        `INSERT INTO oc_channels (channel_id, enabled, raw_json)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           enabled = VALUES(enabled),
           raw_json = VALUES(raw_json)`,
        [channel.id, channel.enabled, JSON.stringify(channel.raw)],
      );
    }

    for (const session of sessions) {
      await pool.query(
        `INSERT INTO oc_sessions (
          session_key, agent_id, session_id, channel, chat_type, updated_at_ms, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          agent_id = VALUES(agent_id),
          session_id = VALUES(session_id),
          channel = VALUES(channel),
          chat_type = VALUES(chat_type),
          updated_at_ms = VALUES(updated_at_ms),
          raw_json = VALUES(raw_json)`,
        [
          session.sessionKey,
          session.agentId,
          session.sessionId,
          session.channel,
          session.chatType,
          session.updatedAtMs,
          JSON.stringify(session.raw),
        ],
      );
    }

    const message = `ok hash=${hash} agents=${agents.length} channels=${channels.length} sessions=${sessions.length}`;
    await pool.query(
      "UPDATE oc_sync_runs SET status='ok', message=?, ended_at=NOW() WHERE id=?",
      [message, runId],
    );

    return {
      configHash: hash,
      agents: agents.length,
      channels: channels.length,
      sessions: sessions.length,
    };
  } catch (err: any) {
    const message = err?.message || "sync failed";
    await pool.query(
      "UPDATE oc_sync_runs SET status='error', message=?, ended_at=NOW() WHERE id=?",
      [message, runId],
    );
    throw err;
  }
}

