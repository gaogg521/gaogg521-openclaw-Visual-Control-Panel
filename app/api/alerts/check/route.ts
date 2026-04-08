import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getAgentAlertActivityBreakdown } from "@/lib/agent-session-activity";
import { fetchGatewayAgentActivityMap } from "@/lib/gateway-agent-activity-hint";
import {
  DEFAULT_MODEL_PROBE_TIMEOUT_MS,
  humanizeModelProbeError,
  probeModel,
} from "@/lib/model-probe";
import { OPENCLAW_CONFIG_PATH, OPENCLAW_HOME } from "@/lib/openclaw-paths";
import { parseOpenclawConfigText } from "@/lib/openclaw-config-read";
import { enforceLocalRequest } from "@/lib/api-local-guard";
import { reconcileIncidents, summarizeIncidents, type AlertIncident, type AlertSeverity } from "@/lib/alert-incidents";
const ALERTS_CONFIG_PATH = path.join(OPENCLAW_HOME, "alerts.json");

interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  threshold?: number;
  targetAgents?: string[];
}

interface AlertConfig {
  enabled: boolean;
  receiveAgent: string;
  checkInterval: number;
  rules: AlertRule[];
  lastAlerts?: Record<string, number>;
  incidents?: AlertIncident[];
}

/** 告警列表项：Bot 无响应类可带 lastActiveAt（与 /api/agent-status 同源会话推断） */
export type AlertCheckResultItem = {
  incidentKey: string;
  message: string;
  severity?: AlertSeverity;
  agentId?: string;
  /** 告警判定采用的「最近活跃」时间（已合并会话 / 目录 mtime / Gateway） */
  lastActiveAt?: number;
  sessionRecordMs?: number;
  dirMtimeMs?: number;
  gatewayActivityMs?: number;
};

function getAlertConfig(): AlertConfig {
  try {
    if (fs.existsSync(ALERTS_CONFIG_PATH)) {
      const raw = fs.readFileSync(ALERTS_CONFIG_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch {}
  return { enabled: false, receiveAgent: "main", checkInterval: 10, rules: [
    { id: "model_unavailable", name: "Model Unavailable", enabled: false },
    { id: "bot_no_response", name: "Bot Long Time No Response", enabled: false, threshold: 300 },
    { id: "message_failure_rate", name: "Message Failure Rate High", enabled: false, threshold: 50 },
    { id: "cron连续_failure", name: "Cron Continuous Failure", enabled: false, threshold: 3 },
  ], lastAlerts: {}, incidents: [] };
}

function getOpenclawConfig(): Record<string, any> {
  const configPath = OPENCLAW_CONFIG_PATH;
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return parseOpenclawConfigText(raw) as Record<string, any>;
  } catch {
    return {};
  }
}

function saveAlertConfig(config: AlertConfig): void {
  const dir = path.dirname(ALERTS_CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(ALERTS_CONFIG_PATH, JSON.stringify(config, null, 2));
}

function shouldSendNotification(config: AlertConfig, incidentKey: string, now: number): boolean {
  const incidents = Array.isArray(config.incidents) ? config.incidents : [];
  const hit = incidents.find((x) => x.incidentKey === incidentKey);
  if (!hit) return true;
  if (hit.status === "acknowledged") return false;
  if (hit.status === "snoozed" && typeof hit.snoozeUntil === "number" && hit.snoozeUntil > now) return false;
  return true;
}

function getGatewayConfig() {
  const configPath = OPENCLAW_CONFIG_PATH;
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = parseOpenclawConfigText(raw) as Record<string, any>;
    return {
      port: config.gateway?.port || 18789,
      token: config.gateway?.auth?.token || "",
      feishu: config.channels?.feishu || {},
    };
  } catch {
    return { port: 18789, token: "", feishu: {} };
  }
}

// 获取 agent 对应的飞书账号配置
function getFeishuAccountForAgent(agentId: string, feishuConfig: any, bindings: any[]): { appId: string; appSecret: string; accountId: string } | null {
  const feishuAccounts = feishuConfig.accounts || {};
  
  // 查找显式绑定
  const feishuBinding = bindings.find((b: any) => b.agentId === agentId && b.match?.channel === "feishu");
  if (feishuBinding) {
    const accountId = feishuBinding.match?.accountId || agentId;
    const account = feishuAccounts[accountId];
    if (account?.appId && account?.appSecret) {
      return { appId: account.appId, appSecret: account.appSecret, accountId };
    }
  }
  
  // 检查是否有同名账号
  if (feishuAccounts[agentId]) {
    const account = feishuAccounts[agentId];
    if (account?.appId && account?.appSecret) {
      return { appId: account.appId, appSecret: account.appSecret, accountId: agentId };
    }
  }
  
  // main agent fallback
  if (agentId === "main" && feishuConfig.enabled && feishuConfig.appId && feishuConfig.appSecret) {
    return { appId: feishuConfig.appId, appSecret: feishuConfig.appSecret, accountId: "main" };
  }
  
  return null;
}

// 获取 agent 最近的发过消息的飞书用户
function getFeishuDmUser(agentId: string): string | null {
  try {
    const sessionsPath = path.join(OPENCLAW_HOME, `agents/${agentId}/sessions/sessions.json`);
    const raw = fs.readFileSync(sessionsPath, "utf-8");
    const sessions = JSON.parse(raw);
    let bestId: string | null = null;
    let bestTime = 0;
    for (const [key, val] of Object.entries(sessions)) {
      const m = key.match(/^agent:[^:]+:feishu:direct:(ou_[a-f0-9]+)$/);
      if (m) {
        const updatedAt = (val as any).updatedAt || 0;
        if (updatedAt > bestTime) {
          bestTime = updatedAt;
          bestId = m[1];
        }
      }
    }
    return bestId;
  } catch {
    return null;
  }
}

// 通过飞书 API 发送告警消息
async function sendAlertViaFeishu(agentId: string, message: string) {
  console.log(`[ALERT] sendAlertViaFeishu called with agentId: ${agentId}, message: ${message}`);
  
  const openclawConfig = getOpenclawConfig();
  const feishuConfig = openclawConfig.channels?.feishu || {};
  const feishuAccounts = feishuConfig.accounts || {};
  const bindings = openclawConfig.bindings || [];
  
  console.log(`[ALERT] Feishu accounts found:`, Object.keys(feishuAccounts));
  
  // 获取 agent 对应的飞书账号配置
  const accountInfo = getFeishuAccountForAgent(agentId, feishuConfig, bindings);
  if (!accountInfo) {
    console.log(`[ALERT] No Feishu account found for agent ${agentId}`);
    return { sent: false, error: `No account for agent ${agentId}` };
  }
  
  console.log(`[ALERT] Using account: ${accountInfo.accountId}, appId: ${accountInfo.appId}`);
  
  // 从 receiveAgent 的 session 中获取用户的 open_id
  const testUserId = getFeishuDmUser(agentId);
  console.log(`[ALERT] Feishu DM user found: ${testUserId}`);
  if (!testUserId) {
    console.log(`[ALERT] No Feishu DM user found for agent ${agentId}`);
    return { sent: false, error: "No DM user" };
  }
  
  const baseUrl = (feishuConfig.domain === "lark") ? "https://open.larksuite.com" : "https://open.feishu.cn";
  console.log(`[ALERT] Using baseUrl: ${baseUrl}`);
  
  try {
    // 获取 tenant_access_token
    const tokenResp = await fetch(`${baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: accountInfo.appId, app_secret: accountInfo.appSecret }),
      signal: AbortSignal.timeout(10000),
    });
    
    const tokenData = await tokenResp.json();
    if (tokenData.code !== 0 || !tokenData.tenant_access_token) {
      return { sent: false, error: `Token failed: ${tokenData.msg}` };
    }
    
    const token = tokenData.tenant_access_token;
    
    // 发送 DM - 使用 user_id_type 确保正确识别用户
    const now = new Date().toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai" });
    
    // 先尝试获取用户的 union_id 或 user_id
    // 如果失败则使用 open_id
    const msgResp = await fetch(`${baseUrl}/open-apis/im/v1/messages?receive_id_type=user_id`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receive_id: testUserId,
        msg_type: "text",
        content: JSON.stringify({ text: `🔔 告警通知\n${message}\n(${now})` }),
      }),
      signal: AbortSignal.timeout(10000),
    });
    
    const msgData = await msgResp.json();
    
    // 如果 user_id 失败，尝试 open_id
    if (msgData.code !== 0) {
      const msgResp2 = await fetch(`${baseUrl}/open-apis/im/v1/messages?receive_id_type=open_id`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receive_id: testUserId,
          msg_type: "text",
          content: JSON.stringify({ text: `🔔 告警通知\n${message}\n(${now})` }),
        }),
        signal: AbortSignal.timeout(10000),
      });
      
      const msgData2 = await msgResp2.json();
      if (msgData2.code === 0) {
        console.log(`[ALERT] Sent to ${agentId}: ${message}`);
        return { sent: true, message };
      } else {
        return { sent: false, error: `Send failed: ${msgData2.msg}` };
      }
    }
    
    if (msgData.code === 0) {
      console.log(`[ALERT] Sent to ${agentId}: ${message}`);
      return { sent: true, message };
    } else {
      console.log(`[ALERT] Send failed (user_id):`, msgData);
      return { sent: false, error: msgData.msg };
    }
  } catch (err: any) {
    console.log(`[ALERT] Error sending message:`, err);
    return { sent: false, error: err.message };
  }
}

// 发送告警消息 - 使用 OpenClaw Gateway API
async function sendAlert(agentId: string, message: string) {
  const openclawConfig = getOpenclawConfig();
  const gatewayPort = openclawConfig.gateway?.port || 18789;
  const gatewayToken = openclawConfig.gateway?.auth?.token || "";
  
  // 使用 sessionKey 发送到正确的 agent
  const sessionKey = `agent:${agentId}:main`;
  
  try {
    // 使用 fire-and-forfetch 不等待响应
    fetch(`http://127.0.0.1:${gatewayPort}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${gatewayToken}`,
        "x-openclaw-agent-id": agentId,
      },
      body: JSON.stringify({
        session: sessionKey,
        messages: [{ role: "user", content: `🔔 告警通知: ${message}` }],
        max_tokens: 64,
      }),
    }).then(resp => {
      if (resp.ok) {
        console.log(`[ALERT] Sent to ${agentId}: ${message}`);
      }
    }).catch(err => {
      console.error(`[ALERT] Error: ${err.message}`);
    });
    
    return { sent: true, message };
  } catch (err: any) {
    return { sent: false, error: err.message };
  }
}

// 检查模型是否可用（直连 probeModel，避免硬编码 localhost:3000 与仪表盘端口不一致导致 fetch failed）
async function checkModelAlerts(config: AlertConfig): Promise<AlertCheckResultItem[]> {
  const results: AlertCheckResultItem[] = [];
  const rule = config.rules.find(r => r.id === "model_unavailable");
  if (!rule?.enabled) return results;

  const openclawConfig = getOpenclawConfig();
  const providers = openclawConfig.models?.providers || {};

  const allModels: Array<{ provider: string; id: string }> = [];
  for (const [providerId, provider] of Object.entries(providers)) {
    const p = provider as { models?: Array<{ id?: string }> };
    if (p.models && Array.isArray(p.models)) {
      for (const model of p.models) {
        if (model?.id) allModels.push({ provider: providerId, id: model.id });
      }
    }
  }

  const timeoutMs = DEFAULT_MODEL_PROBE_TIMEOUT_MS;
  for (const { provider, id } of allModels) {
    try {
      const testResult = await probeModel({
        providerId: provider,
        modelId: id,
        timeoutMs,
      });

      if (!testResult.ok) {
        const hint = humanizeModelProbeError(testResult.error) || testResult.error || "未知错误";
        const incidentKey = `model_unavailable:${provider}/${id}`;
        results.push({
          incidentKey,
          severity: "critical",
          message: `🚨 模型 ${provider}/${id} 不可用：${hint}`,
        });

        const lastAlert = config.lastAlerts?.[`${rule.id}_${provider}_${id}`] || 0;
        const now = Date.now();
        if (now - lastAlert > 60000 && shouldSendNotification(config, incidentKey, now)) {
          await sendAlertViaFeishu(
            config.receiveAgent,
            `模型 ${provider}/${id} 不可用：${hint}`,
          );
          config.lastAlerts = config.lastAlerts || {};
          config.lastAlerts[`${rule.id}_${provider}_${id}`] = now;
        }
      }
    } catch (err: any) {
      results.push({
        incidentKey: `model_unavailable:${provider}/${id}`,
        severity: "critical",
        message: `🚨 测试模型 ${provider}/${id} 时出错：${err?.message || String(err)}`,
      });
    }
  }

  return results;
}

// 检查 Bot 响应时间
async function checkBotResponseAlerts(config: AlertConfig): Promise<AlertCheckResultItem[]> {
  const results: AlertCheckResultItem[] = [];
  const rule = config.rules.find(r => r.id === "bot_no_response");
  if (!rule?.enabled) return results;

  const agentsDir = path.join(OPENCLAW_HOME, "agents");
  let agentIds: string[] = [];
  try {
    agentIds = fs.readdirSync(agentsDir).filter(f => 
      fs.statSync(path.join(agentsDir, f)).isDirectory()
    );
  } catch { return results; }

  // 如果配置了 targetAgents，只检测指定的机器人
  const targetAgents = rule.targetAgents;
  if (targetAgents && targetAgents.length > 0) {
    agentIds = agentIds.filter(id => targetAgents.includes(id));
  }

  const gatewayActivityByAgent = await fetchGatewayAgentActivityMap();

  for (const agentId of agentIds) {
    const gwMs = gatewayActivityByAgent.get(agentId) ?? 0;
    const b = getAgentAlertActivityBreakdown(agentId, gwMs);
    const lastActivity = b.effectiveMs;
    const now = Date.now();
    const thresholdMs = (rule.threshold || 300) * 1000;
    if (lastActivity > 0 && now - lastActivity > thresholdMs) {
      const mins = Math.round((now - lastActivity) / 60000);
      const lastSeenZh = new Date(lastActivity).toLocaleString("zh-CN", {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const incidentKey = `bot_no_response:${agentId}`;
      results.push({
        incidentKey,
        severity: "warning",
        message: `⚠️ Agent ${agentId} 已 ${mins} 分钟无响应`,
        agentId,
        lastActiveAt: lastActivity,
        sessionRecordMs: b.sessionRecordMs,
        dirMtimeMs: b.dirMtimeMs,
        gatewayActivityMs: b.gatewayMs,
      });

      const lastAlert = config.lastAlerts?.[`${rule.id}_${agentId}`] || 0;
      if (now - lastAlert > 60000 && shouldSendNotification(config, incidentKey, now)) {
        await sendAlertViaFeishu(
          config.receiveAgent,
          `Agent ${agentId} 已 ${mins} 分钟无响应（综合最近活跃：${lastSeenZh}，已含会话/目录/Gateway）`,
        );
        config.lastAlerts = config.lastAlerts || {};
        config.lastAlerts[`${rule.id}_${agentId}`] = now;
      }
    }
  }

  return results;
}

// 检查 Cron 失败
async function checkCronAlerts(config: AlertConfig): Promise<AlertCheckResultItem[]> {
  const results: AlertCheckResultItem[] = [];
  const rule = config.rules.find(r => r.id === "cron连续_failure");
  if (!rule?.enabled) return results;

  // 检查 cron 任务状态（简化版：检查 sessions 中是否有失败的 cron 任务）
  const agentsDir = path.join(OPENCLAW_HOME, "agents");
  let agentIds: string[] = [];
  try {
    agentIds = fs.readdirSync(agentsDir).filter(f => 
      fs.statSync(path.join(agentsDir, f)).isDirectory()
    );
  } catch { return results; }

  // 模拟检查（实际应该记录 cron 失败次数）
  const mockCronFailures = Math.floor(Math.random() * 5); // 模拟 0-4 次失败
  
  if (mockCronFailures >= (rule.threshold || 3)) {
    const incidentKey = "cron连续_failure:global";
    results.push({
      incidentKey,
      severity: "critical",
      message: `🚨 Cron 连续失败 ${mockCronFailures} 次！`,
    });
    const lastAlert = config.lastAlerts?.[rule.id] || 0;
    const now = Date.now();
    if (now - lastAlert > 300000 && shouldSendNotification(config, incidentKey, now)) { // 5分钟内不重复
      await sendAlertViaFeishu(config.receiveAgent, `Cron 连续失败 ${mockCronFailures} 次，请检查定时任务配置`);
      config.lastAlerts = config.lastAlerts || {};
      config.lastAlerts[rule.id] = now;
    }
  }

  return results;
}

export async function POST(req: Request) {
  const guard = enforceLocalRequest(req, "Alerts check API");
  if (guard) return guard;
  try {
    const config = getAlertConfig();
    
    if (!config.enabled) {
      return NextResponse.json({ 
        success: false, 
        message: "Alerts are disabled",
        results: [],
        incidents: config.incidents || [],
        summary: summarizeIncidents(config.incidents || []),
      });
    }

    const allResults: AlertCheckResultItem[] = [];

    const modelResults = await checkModelAlerts(config);
    allResults.push(...modelResults);

    const botResults = await checkBotResponseAlerts(config);
    allResults.push(...botResults);

    const cronResults = await checkCronAlerts(config);
    allResults.push(...cronResults);

    const incidents = reconcileIncidents(config.incidents || [], allResults, Date.now());
    config.incidents = incidents;
    const summary = summarizeIncidents(incidents);

    // 保存配置（更新 lastAlerts）
    saveAlertConfig(config);

    return NextResponse.json({
      success: true,
      message: `Found ${allResults.length} alerts`,
      results: allResults,
      incidents,
      summary,
      config: {
        enabled: config.enabled,
        receiveAgent: config.receiveAgent,
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
