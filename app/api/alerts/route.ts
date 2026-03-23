import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { OPENCLAW_HOME } from "@/lib/openclaw-paths";
const ALERTS_CONFIG_PATH = path.join(OPENCLAW_HOME, "alerts.json");

interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  threshold?: number; // 阈值配置
  targetAgents?: string[]; // 指定要检测的机器人列表
}

interface AlertConfig {
  enabled: boolean;
  receiveAgent: string; // 接收告警的 agent ID
  checkInterval: number; // 检查间隔（分钟）
  rules: AlertRule[];
  lastAlerts?: Record<string, number>; // 上次告警时间戳
}

const DEFAULT_RULES: AlertRule[] = [
  { id: "model_unavailable", name: "Model Unavailable", enabled: false },
  { id: "bot_no_response", name: "Bot Long Time No Response", enabled: false, threshold: 300 }, // 5分钟无响应
  { id: "message_failure_rate", name: "Message Failure Rate High", enabled: false, threshold: 50 }, // 失败率超过50%
  { id: "cron连续_failure", name: "Cron Continuous Failure", enabled: false, threshold: 3 }, // 连续失败3次
];

function getAlertConfig(): AlertConfig {
  try {
    if (fs.existsSync(ALERTS_CONFIG_PATH)) {
      const raw = fs.readFileSync(ALERTS_CONFIG_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch {}
  return {
    enabled: false,
    receiveAgent: "main",
    checkInterval: 10,
    rules: DEFAULT_RULES,
    lastAlerts: {},
  };
}

function saveAlertConfig(config: AlertConfig): void {
  const dir = path.dirname(ALERTS_CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(ALERTS_CONFIG_PATH, JSON.stringify(config, null, 2));
}

export async function GET() {
  try {
    const config = getAlertConfig();
    return NextResponse.json(config);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config = getAlertConfig();

    if (body.enabled !== undefined) config.enabled = body.enabled;
    if (body.receiveAgent) config.receiveAgent = body.receiveAgent;
    if (body.checkInterval !== undefined) config.checkInterval = body.checkInterval;
    if (body.rules) {
      for (const newRule of body.rules) {
        const existingRule = config.rules.find(r => r.id === newRule.id);
        if (existingRule) {
          existingRule.enabled = newRule.enabled;
          if (newRule.threshold !== undefined) {
            existingRule.threshold = newRule.threshold;
          }
          if (newRule.targetAgents !== undefined) {
            existingRule.targetAgents = newRule.targetAgents;
          }
        }
      }
    }

    saveAlertConfig(config);
    return NextResponse.json(config);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const config = getAlertConfig();
    
    if (body.enabled !== undefined) config.enabled = body.enabled;
    if (body.receiveAgent) config.receiveAgent = body.receiveAgent;
    if (body.checkInterval !== undefined) config.checkInterval = body.checkInterval;
    if (body.rules) {
      // 合并规则配置
      for (const newRule of body.rules) {
        const existingRule = config.rules.find(r => r.id === newRule.id);
        if (existingRule) {
          existingRule.enabled = newRule.enabled;
          if (newRule.threshold !== undefined) {
            existingRule.threshold = newRule.threshold;
          }
          if (newRule.targetAgents !== undefined) {
            existingRule.targetAgents = newRule.targetAgents;
          }
        }
      }
    }
    
    saveAlertConfig(config);
    return NextResponse.json(config);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
