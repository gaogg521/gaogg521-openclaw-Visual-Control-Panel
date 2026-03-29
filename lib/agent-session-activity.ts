import fs from "fs";
import path from "path";
import { resolveAgentSessionsDir } from "@/lib/agent-runtime-paths";

/**
 * 与 /api/agent-status 一致：合并 sessions.json 的 updatedAt 与近期 jsonl 中的消息时间，
 * 用于告警「长时间无响应」等，避免只扫全量 jsonl 导致误报。
 */
export function getAgentLastActivityMs(agentId: string): number | null {
  const sessionsDir = resolveAgentSessionsDir(agentId);
  const now = Date.now();
  let lastActive: number | null = null;

  try {
    const sessionsPath = path.join(sessionsDir, "sessions.json");
    const raw = fs.readFileSync(sessionsPath, "utf-8");
    const sessions = JSON.parse(raw);
    for (const val of Object.values(sessions)) {
      const ts = (val as { updatedAt?: number }).updatedAt || 0;
      if (ts > (lastActive || 0)) lastActive = ts;
    }
  } catch {
    /* no sessions.json */
  }

  try {
    const files = fs
      .readdirSync(sessionsDir)
      .filter((f) => f.endsWith(".jsonl") && !f.includes(".deleted."))
      .map((f) => ({
        name: f,
        mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 8);

    for (const file of files) {
      if (now - file.mtime > 24 * 60 * 60 * 1000) continue;

      const content = fs.readFileSync(path.join(sessionsDir, file.name), "utf-8");
      const lines = content.trim().split("\n");
      const scanFrom = Math.max(0, lines.length - 80);
      for (let i = lines.length - 1; i >= scanFrom; i--) {
        try {
          const entry = JSON.parse(lines[i]) as {
            type?: string;
            timestamp?: string;
            message?: { role?: string };
          };
          if (entry.type === "message" && entry.timestamp) {
            const ts = new Date(entry.timestamp).getTime();
            if (Number.isFinite(ts) && ts > (lastActive || 0)) lastActive = ts;
          }
        } catch {
          /* skip line */
        }
      }
    }
  } catch {
    /* no jsonl */
  }

  return lastActive;
}

/**
 * 与 /api/agent-activity 一致：sessions 目录下**顶层文件**的最新 mtime（任一会话文件被写入即视为有活动）。
 */
export function getAgentSessionsDirMaxMtimeMs(agentId: string): number {
  const sessionsDir = resolveAgentSessionsDir(agentId);
  let max = 0;
  try {
    for (const name of fs.readdirSync(sessionsDir)) {
      const fp = path.join(sessionsDir, name);
      const st = fs.statSync(fp);
      if (st.isFile() && st.mtimeMs > max) max = st.mtimeMs;
    }
  } catch {
    return 0;
  }
  return max;
}

export type AgentAlertActivityBreakdown = {
  /** 用于阈值比较的最终时间 */
  effectiveMs: number;
  sessionRecordMs: number;
  dirMtimeMs: number;
  gatewayMs: number;
};

/**
 * 告警用：取会话解析、目录 mtime、Gateway 快照三者最大值，减少「实际在跑但日志时间旧」的误报。
 */
export function getAgentAlertActivityBreakdown(
  agentId: string,
  gatewayMs: number,
): AgentAlertActivityBreakdown {
  const sessionRecordMs = getAgentLastActivityMs(agentId) ?? 0;
  const dirMtimeMs = getAgentSessionsDirMaxMtimeMs(agentId);
  const g = gatewayMs > 0 ? gatewayMs : 0;
  const effectiveMs = Math.max(sessionRecordMs, dirMtimeMs, g);
  return { effectiveMs, sessionRecordMs, dirMtimeMs, gatewayMs: g };
}

