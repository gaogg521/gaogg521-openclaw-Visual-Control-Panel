import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { OPENCLAW_HOME } from "@/lib/openclaw-paths";

// 30秒内存缓存
let statsCache: { data: any; ts: number } | null = null;
const CACHE_TTL_MS = 30_000;

interface DayStat {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  messageCount: number;
  avgResponseMs: number;
}

interface InternalDayStat extends DayStat {
  responseTimes: number[];
}

async function parseAgentSessions(agentId: string): Promise<InternalDayStat[]> {
  const sessionsDir = path.join(OPENCLAW_HOME, `agents/${agentId}/sessions`);
  const dayMap: Record<string, InternalDayStat> = {};

  let fileNames: string[];
  try {
    fileNames = (await fs.promises.readdir(sessionsDir)).filter(f => f.endsWith(".jsonl") && !f.includes(".deleted."));
  } catch { return []; }

  // 并行读取所有 JSONL 文件
  const fileContents = await Promise.all(fileNames.map(async (file) => {
    try { return await fs.promises.readFile(path.join(sessionsDir, file), "utf-8"); } catch { return null; }
  }));

  for (const content of fileContents) {
    if (!content) continue;

    const lines = content.trim().split("\n");
    const messages: { role: string; ts: string; stopReason?: string }[] = [];

    for (const line of lines) {
      let entry: any;
      try { entry = JSON.parse(line); } catch { continue; }
      if (entry.type !== "message") continue;
      const msg = entry.message;
      if (!msg || !entry.timestamp) continue;

      const ts = entry.timestamp;
      const date = ts.slice(0, 10);
      messages.push({ role: msg.role, ts, stopReason: msg.stopReason });

      if (msg.role === "assistant" && msg.usage) {
        if (!dayMap[date]) {
          dayMap[date] = { date, inputTokens: 0, outputTokens: 0, totalTokens: 0, messageCount: 0, avgResponseMs: 0, responseTimes: [] };
        }
        dayMap[date].inputTokens += msg.usage.input || 0;
        dayMap[date].outputTokens += msg.usage.output || 0;
        dayMap[date].totalTokens += msg.usage.totalTokens || 0;
        dayMap[date].messageCount += 1;
      }
    }

    // O(n) 响应时间计算：跟踪最近的 user 消息，匹配下一个 assistant stop
    let lastUserTs: string | null = null;
    for (const msg of messages) {
      if (msg.role === "user") {
        lastUserTs = msg.ts;
      } else if (msg.role === "assistant" && msg.stopReason === "stop" && lastUserTs) {
        const diffMs = new Date(msg.ts).getTime() - new Date(lastUserTs).getTime();
        if (diffMs > 0 && diffMs < 600000) {
          const date = lastUserTs.slice(0, 10);
          if (!dayMap[date]) {
            dayMap[date] = { date, inputTokens: 0, outputTokens: 0, totalTokens: 0, messageCount: 0, avgResponseMs: 0, responseTimes: [] };
          }
          dayMap[date].responseTimes.push(diffMs);
        }
        lastUserTs = null;
      }
    }
  }
  return Object.values(dayMap);
}

function aggregateToWeeklyMonthly(daily: DayStat[]) {
  const weekMap: Record<string, DayStat> = {};
  const monthMap: Record<string, DayStat> = {};

  for (const d of daily) {
    const dt = new Date(d.date + "T00:00:00Z");
    const day = dt.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(dt.getTime() + mondayOffset * 86400000);
    const weekKey = monday.toISOString().slice(0, 10);

    if (!weekMap[weekKey]) weekMap[weekKey] = { date: weekKey, inputTokens: 0, outputTokens: 0, totalTokens: 0, messageCount: 0, avgResponseMs: 0 };
    weekMap[weekKey].inputTokens += d.inputTokens;
    weekMap[weekKey].outputTokens += d.outputTokens;
    weekMap[weekKey].totalTokens += d.totalTokens;
    weekMap[weekKey].messageCount += d.messageCount;

    const monthKey = d.date.slice(0, 7);
    if (!monthMap[monthKey]) monthMap[monthKey] = { date: monthKey, inputTokens: 0, outputTokens: 0, totalTokens: 0, messageCount: 0, avgResponseMs: 0 };
    monthMap[monthKey].inputTokens += d.inputTokens;
    monthMap[monthKey].outputTokens += d.outputTokens;
    monthMap[monthKey].totalTokens += d.totalTokens;
    monthMap[monthKey].messageCount += d.messageCount;
  }

  return {
    weekly: Object.values(weekMap).sort((a, b) => a.date.localeCompare(b.date)),
    monthly: Object.values(monthMap).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export async function GET() {
  // 命中缓存直接返回
  if (statsCache && Date.now() - statsCache.ts < CACHE_TTL_MS) {
    return NextResponse.json(statsCache.data);
  }

  try {
    const agentsDir = path.join(OPENCLAW_HOME, "agents");
    let agentIds: string[];
    try { agentIds = fs.readdirSync(agentsDir).filter(f => fs.statSync(path.join(agentsDir, f)).isDirectory()); } catch { agentIds = []; }

    // 并行处理所有 agent
    const allAgentDays = await Promise.all(agentIds.map(id => parseAgentSessions(id)));

    const dayMap: Record<string, InternalDayStat> = {};
    for (const agentDays of allAgentDays) {
      for (const ad of agentDays) {
        if (!dayMap[ad.date]) {
          dayMap[ad.date] = { date: ad.date, inputTokens: 0, outputTokens: 0, totalTokens: 0, messageCount: 0, avgResponseMs: 0, responseTimes: [] };
        }
        const d = dayMap[ad.date];
        d.inputTokens += ad.inputTokens;
        d.outputTokens += ad.outputTokens;
        d.totalTokens += ad.totalTokens;
        d.messageCount += ad.messageCount;
        d.responseTimes.push(...ad.responseTimes);
      }
    }

    const daily: DayStat[] = Object.values(dayMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ responseTimes, ...rest }) => {
        if (responseTimes.length > 0) {
          rest.avgResponseMs = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
        }
        return rest;
      });

    const { weekly, monthly } = aggregateToWeeklyMonthly(daily);

    const data = { daily, weekly, monthly };
    statsCache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
