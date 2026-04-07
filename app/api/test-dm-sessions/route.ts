import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  parseApiJsonSafely,
  shouldFallbackToCli,
  shouldFallbackToCliFromFetchError,
  testSessionViaCli,
} from "@/lib/session-test-fallback";
import { enforceLocalRequest } from "@/lib/api-local-guard";
import { detectAndFixOpenclawHome, getResolvedConfigPath, getResolvedOpenclawHome } from "@/lib/openclaw-home-detect";

/** 单次网关 HTTP 探测上限，避免多专家×多通道串行时浏览器先断开（Failed to fetch） */
const HTTP_PROBE_MS = 22_000;

/** CLI 回退超时（秒），与 execOpenclaw 上限对齐 */
const CLI_PROBE_TIMEOUT_SEC = 28;

/** 并行探测批大小，避免瞬间压满网关 */
const PROBE_CONCURRENCY = 8;

interface DmSessionResult {
  agentId: string;
  platform: string;
  ok: boolean;
  detail?: string;
  error?: string;
  elapsed: number;
}

interface HttpProbeResult {
  ok: boolean;
  detail?: string;
  error?: string;
  status: number;
  rawText: string;
  elapsed: number;
}

function getDmUser(agentId: string, platform: string): string | null {
  try {
    const home = getResolvedOpenclawHome();
    const sessionsPath = path.join(home, "agents", agentId, "sessions", "sessions.json");
    const raw = fs.readFileSync(sessionsPath, "utf-8");
    const sessions = JSON.parse(raw);
    let bestId: string | null = null;
    let bestTime = 0;
    const pattern =
      platform === "feishu"
        ? /^agent:[^:]+:feishu:direct:(ou_[a-f0-9]+)$/
        : new RegExp(`^agent:[^:]+:${platform}:direct:(.+)$`);
    for (const [key, val] of Object.entries(sessions)) {
      const m = key.match(pattern);
      if (m) {
        const updatedAt = (val as { updatedAt?: number }).updatedAt || 0;
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

function syntheticResponse(status: number, rawText: string): Response {
  return new Response(rawText, { status });
}

async function httpChatProbe(
  agentId: string,
  sessionKey: string,
  gatewayPort: number,
  gatewayToken: string,
): Promise<HttpProbeResult> {
  const startTime = Date.now();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-openclaw-agent-id": agentId,
    "x-openclaw-session-key": sessionKey,
  };
  if (gatewayToken) {
    headers.Authorization = `Bearer ${gatewayToken}`;
  }

  try {
    const resp = await fetch(`http://127.0.0.1:${gatewayPort}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: `openclaw:${agentId}`,
        messages: [{ role: "user", content: "Health check: reply with OK" }],
        max_tokens: 64,
      }),
      signal: AbortSignal.timeout(HTTP_PROBE_MS),
    });
    const rawText = await resp.text();
    const data = parseApiJsonSafely(rawText);
    const elapsed = Date.now() - startTime;
    if (!resp.ok) {
      return {
        ok: false,
        error: (typeof data?.error?.message === "string" ? data.error.message : null) || rawText.slice(0, 500),
        status: resp.status,
        rawText,
        elapsed,
      };
    }
    const reply = data?.choices?.[0]?.message?.content || "";
    return {
      ok: true,
      detail: reply.slice(0, 200) || "(no reply)",
      status: resp.status,
      rawText,
      elapsed,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: msg,
      status: 0,
      rawText: msg,
      elapsed: Date.now() - startTime,
    };
  }
}

function needsCliAfterHttp(h: HttpProbeResult): boolean {
  if (h.ok) return false;
  if (h.status === 0) return shouldFallbackToCliFromFetchError(new Error(h.rawText));
  return shouldFallbackToCli(syntheticResponse(h.status, h.rawText), h.rawText);
}

/**
 * DM 列语义：优先测 DM 私信会话；若无记录或 DM 失败，再用主会话 HTTP（网关通常能认出 agent）；
 * 最后才 CLI（避免本机 openclaw 与网关配置不一致时出现 Unknown agent id 却拿不到 ✅）。
 */
async function probeAgentPlatform(
  agentId: string,
  platform: string,
  gatewayPort: number,
  gatewayToken: string,
): Promise<DmSessionResult> {
  const t0 = Date.now();
  const dmUser = getDmUser(agentId, platform);
  const mainKey = `agent:${agentId}:main`;

  let dmAttempt: HttpProbeResult | null = null;
  if (dmUser) {
    const dmKey = `agent:${agentId}:${platform}:direct:${dmUser}`;
    dmAttempt = await httpChatProbe(agentId, dmKey, gatewayPort, gatewayToken);
    if (dmAttempt.ok) {
      return {
        agentId,
        platform,
        ok: true,
        detail: dmAttempt.detail || "OK",
        elapsed: Date.now() - t0,
      };
    }
  }

  const mainAttempt = await httpChatProbe(agentId, mainKey, gatewayPort, gatewayToken);
  if (mainAttempt.ok) {
    const note = dmUser ? "主会话可达（DM 路由未成功）" : "主会话可达（暂无 DM 私信记录）";
    return {
      agentId,
      platform,
      ok: true,
      detail: `${mainAttempt.detail || "OK"} · ${note}`,
      elapsed: Date.now() - t0,
    };
  }

  const tryCli =
    (dmAttempt && needsCliAfterHttp(dmAttempt)) || needsCliAfterHttp(mainAttempt);
  if (tryCli) {
    const cli = await testSessionViaCli(agentId, { timeoutSec: CLI_PROBE_TIMEOUT_SEC });
    if (cli.ok) {
      return {
        agentId,
        platform,
        ok: true,
        detail: `${cli.reply || "OK"} · CLI（HTTP 主/DM 均未通）`,
        elapsed: Date.now() - t0,
      };
    }
    const cliErr = cli.error || "";
    const mainErr = (mainAttempt.error || "").slice(0, 280);
    if (/unknown agent id/i.test(cliErr)) {
      return {
        agentId,
        platform,
        ok: false,
        error: `主会话 HTTP: ${mainErr || mainAttempt.rawText.slice(0, 200)}。CLI 报 Unknown agent（本机 openclaw 与网关使用的配置目录可能不一致，请以网关为准）。`,
        elapsed: Date.now() - t0,
      };
    }
    return {
      agentId,
      platform,
      ok: false,
      error: cliErr.slice(0, 400) || mainErr,
      elapsed: Date.now() - t0,
    };
  }

  return {
    agentId,
    platform,
    ok: false,
    error: mainAttempt.error || dmAttempt?.error || "HTTP probe failed",
    elapsed: Date.now() - t0,
  };
}

export async function POST(req: Request) {
  const guard = enforceLocalRequest(req, "Test DM sessions API");
  if (guard) return guard;
  try {
    detectAndFixOpenclawHome();
    const configPath = getResolvedConfigPath();
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);
    const gatewayPort = config.gateway?.port || 18789;
    const gatewayToken = config.gateway?.auth?.token || "";
    const channels = config.channels || {};
    const bindings = config.bindings || [];

    let agentList = config.agents?.list || [];
    if (agentList.length === 0) {
      try {
        const agentsDir = path.join(getResolvedOpenclawHome(), "agents");
        const dirs = fs.readdirSync(agentsDir, { withFileTypes: true });
        agentList = dirs
          .filter((d) => d.isDirectory() && !d.name.startsWith("."))
          .map((d) => ({ id: d.name }));
      } catch {
        /* ignore */
      }
      if (agentList.length === 0) agentList = [{ id: "main" }];
    }

    const platformsToTest = Array.from(
      new Set([
        ...Object.entries(channels)
          .filter(([, cfg]) => cfg && typeof cfg === "object" && (cfg as { enabled?: boolean }).enabled !== false)
          .map(([name]) => name),
        ...bindings
          .map((b: { match?: { channel?: string } }) => b?.match?.channel)
          .filter((name: unknown): name is string => typeof name === "string" && name.length > 0),
      ]),
    );

    const probeTasks: Array<() => Promise<DmSessionResult>> = [];
    for (const agent of agentList) {
      const id = agent.id;
      for (const platform of platformsToTest) {
        const ch = channels[platform];
        if (ch && ch.enabled === false) continue;

        const isMain = id === "main";
        const hasBinding = bindings.some(
          (b: { agentId?: string; match?: { channel?: string } }) =>
            b.agentId === id && b.match?.channel === platform,
        );
        if (!isMain && !hasBinding) continue;

        probeTasks.push(() => probeAgentPlatform(id, platform, gatewayPort, gatewayToken));
      }
    }

    const results: DmSessionResult[] = [];
    for (let i = 0; i < probeTasks.length; i += PROBE_CONCURRENCY) {
      const batch = probeTasks.slice(i, i + PROBE_CONCURRENCY).map((fn) => fn());
      results.push(...(await Promise.all(batch)));
    }

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
