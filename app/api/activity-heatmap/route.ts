import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { OPENCLAW_HOME } from "@/lib/openclaw-paths";

// Server-side cache: 5 min TTL
let cache: { data: any; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

function buildHeatmapData() {
  const agentsDir = path.join(OPENCLAW_HOME, "agents");
  let agentIds: string[];
  try {
    agentIds = fs.readdirSync(agentsDir).filter(f =>
      fs.statSync(path.join(agentsDir, f)).isDirectory()
    );
  } catch {
    agentIds = [];
  }

  const result: { agentId: string; grid: number[][] }[] = [];

  for (const agentId of agentIds) {
    const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    const sessionsDir = path.join(agentsDir, agentId, "sessions");
    let files: string[];
    try {
      files = fs.readdirSync(sessionsDir).filter(f => f.endsWith(".jsonl") && !f.includes(".deleted."));
    } catch { continue; }

    for (const file of files) {
      let content: string;
      try { content = fs.readFileSync(path.join(sessionsDir, file), "utf-8"); } catch { continue; }

      for (const line of content.trim().split("\n")) {
        let entry: any;
        try { entry = JSON.parse(line); } catch { continue; }
        if (entry.type !== "message" || !entry.message || !entry.timestamp) continue;
        if (entry.message.role !== "assistant") continue;

        const dt = new Date(entry.timestamp);
        const shanghai = new Date(dt.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
        const hour = shanghai.getHours();
        const jsDay = shanghai.getDay(); // 0=Sun
        const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon … 6=Sun
        grid[dayOfWeek][hour]++;
      }
    }

    result.push({ agentId, grid });
  }

  return { agents: result };
}

/**
 * Per-agent message activity grids: 7×24 (dayOfWeek × hour).
 * dayOfWeek: 0=Monday … 6=Sunday, hour: 0-23 in Asia/Shanghai timezone.
 * Cached for 5 minutes server-side.
 */
export async function GET() {
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }
    const data = buildHeatmapData();
    cache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
