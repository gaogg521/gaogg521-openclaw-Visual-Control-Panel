import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { OPENCLAW_HOME } from "@/lib/openclaw-paths";
const ACTIVE_GAP_MS = 2 * 60 * 1000; // 2 minutes — gaps longer than this count as idle

// Server-side cache: 5 min TTL
let cache: { data: any; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

function buildIdleRankData() {
  const agentsDir = path.join(OPENCLAW_HOME, "agents");
  let agentIds: string[];
  try {
    agentIds = fs.readdirSync(agentsDir).filter(f =>
      fs.statSync(path.join(agentsDir, f)).isDirectory()
    );
  } catch {
    agentIds = [];
  }

  const result: Array<{
    agentId: string;
    onlineMinutes: number;
    activeMinutes: number;
    idleMinutes: number;
    idlePercent: number;
  }> = [];

  for (const agentId of agentIds) {
    const sessionsDir = path.join(agentsDir, agentId, "sessions");
    let files: string[];
    try {
      files = fs.readdirSync(sessionsDir).filter(f => f.endsWith(".jsonl") && !f.includes(".deleted."));
    } catch { continue; }

    let totalOnlineMs = 0;
    let totalActiveMs = 0;

    for (const file of files) {
      let content: string;
      try { content = fs.readFileSync(path.join(sessionsDir, file), "utf-8"); } catch { continue; }

      const timestamps: number[] = [];
      for (const line of content.trim().split("\n")) {
        let entry: any;
        try { entry = JSON.parse(line); } catch { continue; }
        if (!entry.timestamp) continue;
        const ts = new Date(entry.timestamp).getTime();
        if (!isNaN(ts)) timestamps.push(ts);
      }

      if (timestamps.length < 2) continue;
      timestamps.sort((a, b) => a - b);

      // Online time: first to last message
      totalOnlineMs += timestamps[timestamps.length - 1] - timestamps[0];

      // Active time: sum of gaps ≤ ACTIVE_GAP_MS
      for (let i = 1; i < timestamps.length; i++) {
        const gap = timestamps[i] - timestamps[i - 1];
        if (gap <= ACTIVE_GAP_MS) {
          totalActiveMs += gap;
        }
      }
    }

    const onlineMinutes = Math.round(totalOnlineMs / 60000);
    const activeMinutes = Math.round(totalActiveMs / 60000);
    const idleMinutes = Math.max(0, onlineMinutes - activeMinutes);
    const idlePercent = onlineMinutes > 0 ? Math.round((idleMinutes / onlineMinutes) * 100) : 0;

    if (onlineMinutes > 0) {
      result.push({ agentId, onlineMinutes, activeMinutes, idleMinutes, idlePercent });
    }
  }

  return { agents: result };
}

export async function GET() {
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }
    const data = buildIdleRankData();
    cache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
