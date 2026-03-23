import { getMysqlPool } from "@/lib/mysql";
import { ensureStorageSchema } from "@/lib/db-sync";

type Overview = {
  agentCount: number;
  sessionCount: number;
  enabledChannelCount: number;
  lastSyncTime: string | null;
};

type DistributionItem = {
  name: string;
  value: number;
};

type RunItem = {
  id: number;
  reason: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
};

export type StorageMetrics = {
  overview: Overview;
  channelDistribution: DistributionItem[];
  chatTypeDistribution: DistributionItem[];
  topAgents: DistributionItem[];
  recentRuns: RunItem[];
};

function asNumber(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function getStorageMetrics(): Promise<StorageMetrics> {
  const pool = getMysqlPool();
  await ensureStorageSchema();

  const [overviewRows] = await pool.query(
    `SELECT
      (SELECT COUNT(*) FROM oc_agents) AS agent_count,
      (SELECT COUNT(*) FROM oc_sessions) AS session_count,
      (SELECT COUNT(*) FROM oc_channels WHERE enabled = 1) AS enabled_channel_count,
      (SELECT MAX(ended_at) FROM oc_sync_runs WHERE status = 'ok') AS last_sync_time`,
  );
  const overviewRow = (overviewRows as any[])[0] || {};

  const [channelRows] = await pool.query(
    `SELECT COALESCE(channel, 'unknown') AS name, COUNT(*) AS value
     FROM oc_sessions
     GROUP BY COALESCE(channel, 'unknown')
     ORDER BY value DESC`,
  );

  const [chatTypeRows] = await pool.query(
    `SELECT COALESCE(chat_type, 'unknown') AS name, COUNT(*) AS value
     FROM oc_sessions
     GROUP BY COALESCE(chat_type, 'unknown')
     ORDER BY value DESC`,
  );

  const [topAgentsRows] = await pool.query(
    `SELECT agent_id AS name, COUNT(*) AS value
     FROM oc_sessions
     GROUP BY agent_id
     ORDER BY value DESC
     LIMIT 8`,
  );

  const [runsRows] = await pool.query(
    `SELECT id, reason, status, started_at, ended_at
     FROM oc_sync_runs
     ORDER BY id DESC
     LIMIT 10`,
  );

  return {
    overview: {
      agentCount: asNumber(overviewRow.agent_count),
      sessionCount: asNumber(overviewRow.session_count),
      enabledChannelCount: asNumber(overviewRow.enabled_channel_count),
      lastSyncTime: overviewRow.last_sync_time
        ? new Date(overviewRow.last_sync_time).toISOString()
        : null,
    },
    channelDistribution: (channelRows as any[]).map((row) => ({
      name: String(row.name || "unknown"),
      value: asNumber(row.value),
    })),
    chatTypeDistribution: (chatTypeRows as any[]).map((row) => ({
      name: String(row.name || "unknown"),
      value: asNumber(row.value),
    })),
    topAgents: (topAgentsRows as any[]).map((row) => ({
      name: String(row.name || "unknown"),
      value: asNumber(row.value),
    })),
    recentRuns: (runsRows as any[]).map((row) => ({
      id: asNumber(row.id),
      reason: String(row.reason || ""),
      status: String(row.status || ""),
      startedAt: row.started_at ? new Date(row.started_at).toISOString() : "",
      endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : null,
    })),
  };
}

