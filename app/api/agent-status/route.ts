import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getAgentLastActivityMs } from "@/lib/agent-session-activity";
import { listRuntimeAgents, resolveAgentSessionsDir } from "@/lib/agent-runtime-paths";

// 状态: working(2分钟内有assistant消息) / online(10分钟内) / idle(24小时内) / offline(超过24小时)
type AgentState = "working" | "online" | "idle" | "offline";

interface AgentStatus {
  agentId: string;
  state: AgentState;
  lastActive: number | null;
}

function getLastAssistantTsFromRecentJsonl(agentId: string): number | null {
  const sessionsDir = resolveAgentSessionsDir(agentId);
  const now = Date.now();
  let lastAssistantTs: number | null = null;
  try {
    const files = fs
      .readdirSync(sessionsDir)
      .filter((f) => f.endsWith(".jsonl") && !f.includes(".deleted."))
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 5);

    for (const file of files) {
      if (now - file.mtime > 3 * 60 * 1000) continue;

      const content = fs.readFileSync(path.join(sessionsDir, file.name), "utf-8");
      const lines = content.trim().split("\n");
      for (let i = lines.length - 1; i >= Math.max(0, lines.length - 20); i--) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.type === "message" && entry.message?.role === "assistant" && entry.timestamp) {
            const ts = new Date(entry.timestamp).getTime();
            if (!lastAssistantTs || ts > lastAssistantTs) lastAssistantTs = ts;
          }
        } catch {
          /* skip */
        }
      }
    }
  } catch {
    /* noop */
  }
  return lastAssistantTs;
}

function getAgentState(agentId: string): AgentStatus {
  const now = Date.now();
  const lastActive = getAgentLastActivityMs(agentId);
  const lastAssistantTs = getLastAssistantTsFromRecentJsonl(agentId);

  let state: AgentState = "offline";
  if (lastActive) {
    const diff = now - lastActive;
    if (lastAssistantTs && now - lastAssistantTs < 3 * 60 * 1000) {
      state = "working";
    } else if (diff < 10 * 60 * 1000) {
      state = "online";
    } else if (diff < 24 * 60 * 60 * 1000) {
      state = "idle";
    }
  }

  return { agentId, state, lastActive };
}

export async function GET() {
  try {
    const runtimeAgents = listRuntimeAgents();
    const agentIds = runtimeAgents.length > 0 ? runtimeAgents.map((x) => x.id) : ["main"];

    const statuses = agentIds.map(id => getAgentState(id));
    return NextResponse.json({ statuses });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
