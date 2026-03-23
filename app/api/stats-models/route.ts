import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { OPENCLAW_HOME } from "@/lib/openclaw-paths";

// 30秒内存缓存
let statsCache: { data: any; ts: number } | null = null;
const CACHE_TTL_MS = 30_000;

interface ModelStat {
  modelId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  messageCount: number;
  avgResponseMs: number;
}

interface InternalModelStat extends ModelStat {
  responseTimes: number[];
}

export async function GET() {
  // 命中缓存直接返回
  if (statsCache && Date.now() - statsCache.ts < CACHE_TTL_MS) {
    return NextResponse.json(statsCache.data);
  }

  try {
    const agentsDir = path.join(OPENCLAW_HOME, "agents");
    let agentIds: string[];
    try {
      agentIds = fs.readdirSync(agentsDir).filter(f => fs.statSync(path.join(agentsDir, f)).isDirectory());
    } catch { agentIds = []; }

    const modelMap: Record<string, InternalModelStat> = {};

    // 并行处理所有 agent
    await Promise.all(agentIds.map(async (agentId) => {
      const sessionsDir = path.join(agentsDir, agentId, "sessions");
      let fileNames: string[];
      try {
        fileNames = (await fs.promises.readdir(sessionsDir)).filter(f => f.endsWith(".jsonl") && !f.includes(".deleted."));
      } catch { return; }

      // 并行读取所有 JSONL 文件
      const fileContents = await Promise.all(fileNames.map(async (file) => {
        try { return await fs.promises.readFile(path.join(sessionsDir, file), "utf-8"); } catch { return null; }
      }));

      for (const content of fileContents) {
        if (!content) continue;

        const lines = content.trim().split("\n");

        for (const line of lines) {
          let entry: any;
          try { entry = JSON.parse(line); } catch { continue; }
          if (entry.type !== "message") continue;
          const msg = entry.message;
          if (!msg || !entry.timestamp) continue;

          if (msg.role === "assistant" && msg.usage && msg.model) {
            const key = `${msg.provider || "unknown"}/${msg.model}`;
            if (!modelMap[key]) {
              modelMap[key] = {
                modelId: msg.model,
                provider: msg.provider || "unknown",
                inputTokens: 0, outputTokens: 0, totalTokens: 0,
                messageCount: 0, avgResponseMs: 0, responseTimes: [],
              };
            }
            const m = modelMap[key];
            m.inputTokens += msg.usage.input || 0;
            m.outputTokens += msg.usage.output || 0;
            m.totalTokens += msg.usage.totalTokens || 0;
            m.messageCount += 1;
          }
        }

        // O(n) 响应时间计算
        let lastUserTs: string | null = null;
        for (const line of lines) {
          let entry: any;
          try { entry = JSON.parse(line); } catch { continue; }
          if (entry.type !== "message" || !entry.message || !entry.timestamp) continue;
          const msg = entry.message;
          if (msg.role === "user") {
            lastUserTs = entry.timestamp;
          } else if (msg.role === "assistant" && msg.stopReason === "stop" && lastUserTs && msg.model) {
            const diffMs = new Date(entry.timestamp).getTime() - new Date(lastUserTs).getTime();
            if (diffMs > 0 && diffMs < 600000) {
              const key = `${msg.provider || "unknown"}/${msg.model}`;
              if (modelMap[key]) {
                modelMap[key].responseTimes.push(diffMs);
              }
            }
            lastUserTs = null;
          }
        }
      }
    }));

    const models: ModelStat[] = Object.values(modelMap).map(({ responseTimes, ...rest }) => {
      if (responseTimes.length > 0) {
        rest.avgResponseMs = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
      }
      return rest;
    });

    models.sort((a, b) => b.totalTokens - a.totalTokens);

    const data = { models };
    statsCache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
