import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { OPENCLAW_CONFIG_PATH, OPENCLAW_HOME } from "@/lib/openclaw-paths";
import { parseApiJsonSafely, shouldFallbackToCli, testSessionViaCli } from "@/lib/session-test-fallback";
const CONFIG_PATH = OPENCLAW_CONFIG_PATH;

interface DmSessionResult {
  agentId: string;
  platform: string;
  ok: boolean;
  detail?: string;
  error?: string;
  elapsed: number;
}

function getDmUser(agentId: string, platform: string): string | null {
  try {
    const sessionsPath = path.join(OPENCLAW_HOME, `agents/${agentId}/sessions/sessions.json`);
    const raw = fs.readFileSync(sessionsPath, "utf-8");
    const sessions = JSON.parse(raw);
    let bestId: string | null = null;
    let bestTime = 0;
    const pattern = platform === "feishu"
      ? /^agent:[^:]+:feishu:direct:(ou_[a-f0-9]+)$/
      : new RegExp(`^agent:[^:]+:${platform}:direct:(.+)$`);
    for (const [key, val] of Object.entries(sessions)) {
      const m = key.match(pattern);
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

async function testDmSession(
  agentId: string,
  platform: string,
  sessionKey: string,
  gatewayPort: number,
  gatewayToken: string
): Promise<DmSessionResult> {
  const startTime = Date.now();
  try {
    const resp = await fetch(`http://127.0.0.1:${gatewayPort}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${gatewayToken}`,
        "x-openclaw-agent-id": agentId,
        "x-openclaw-session-key": sessionKey,
      },
      body: JSON.stringify({
        model: `openclaw:${agentId}`,
        messages: [{ role: "user", content: "Health check: reply with OK" }],
        max_tokens: 64,
      }),
      signal: AbortSignal.timeout(100000),
    });

    const rawText = await resp.text();
    const data = parseApiJsonSafely(rawText);
    const elapsed = Date.now() - startTime;

    if (!resp.ok) {
      if (shouldFallbackToCli(resp, rawText)) {
        const fallback = await testSessionViaCli(agentId);
        return fallback.ok
          ? { agentId, platform, ok: true, detail: `${fallback.reply || "OK"} · DM fallback`, elapsed: fallback.elapsed }
          : { agentId, platform, ok: false, error: fallback.error || "Gateway route not found", elapsed: fallback.elapsed };
      }
      return { agentId, platform, ok: false, error: data?.error?.message || rawText || JSON.stringify(data), elapsed };
    }

    const reply = data.choices?.[0]?.message?.content || "";
    return { agentId, platform, ok: true, detail: reply.slice(0, 200) || "(no reply)", elapsed };
  } catch (err: any) {
    return { agentId, platform, ok: false, error: err.message, elapsed: Date.now() - startTime };
  }
}

export async function POST() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw);
    const gatewayPort = config.gateway?.port || 18789;
    const gatewayToken = config.gateway?.auth?.token || "";
    const channels = config.channels || {};
    const bindings = config.bindings || [];

    let agentList = config.agents?.list || [];
    if (agentList.length === 0) {
      try {
        const agentsDir = path.join(OPENCLAW_HOME, "agents");
        const dirs = fs.readdirSync(agentsDir, { withFileTypes: true });
        agentList = dirs
          .filter((d: any) => d.isDirectory() && !d.name.startsWith("."))
          .map((d: any) => ({ id: d.name }));
      } catch {}
      if (agentList.length === 0) agentList = [{ id: "main" }];
    }

    const results: DmSessionResult[] = [];
    const platformsToTest = Array.from(new Set([
      ...Object.entries(channels)
        .filter(([, cfg]) => cfg && typeof cfg === "object" && (cfg as any).enabled !== false)
        .map(([name]) => name),
      ...bindings
        .map((b: any) => b?.match?.channel)
        .filter((name: unknown): name is string => typeof name === "string" && name.length > 0),
    ]));

    for (const agent of agentList) {
      const id = agent.id;
      for (const platform of platformsToTest) {
        const ch = channels[platform];
        if (ch && ch.enabled === false) continue;

        const isMain = id === "main";
        const hasBinding = bindings.some(
          (b: any) => b.agentId === id && b.match?.channel === platform
        );
        if (!isMain && !hasBinding) continue;

        const dmUser = getDmUser(id, platform);
        if (!dmUser) continue;

        const sessionKey = `agent:${id}:${platform}:direct:${dmUser}`;
        const r = await testDmSession(id, platform, sessionKey, gatewayPort, gatewayToken);
        results.push(r);
      }
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
