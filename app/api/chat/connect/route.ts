import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { OPENCLAW_CONFIG_PATH, OPENCLAW_HOME } from "@/lib/openclaw-paths";

function parseSessions(agentId: string) {
  const sessionsPath = path.join(OPENCLAW_HOME, `agents/${agentId}/sessions/sessions.json`);
  if (!fs.existsSync(sessionsPath)) return [];
  const raw = fs.readFileSync(sessionsPath, "utf-8");
  const sessions = JSON.parse(raw);
  const list = Object.entries(sessions || {}).map(([key, val]: [string, any]) => ({
    key,
    type: key.endsWith(":main") ? "main" : (key.split(":")[2] || "unknown"),
    sessionId: typeof val?.sessionId === "string" ? val.sessionId : null,
    updatedAt: Number(val?.updatedAt || 0),
    totalTokens: Number(val?.totalTokens || 0),
  }));
  list.sort((a, b) => b.updatedAt - a.updatedAt);
  return list;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const agentId = String(body?.agentId || "").trim();
    if (!agentId) {
      return NextResponse.json({ ok: false, error: "Missing agentId" }, { status: 400 });
    }

    const cfgRaw = fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf-8");
    const cfg = JSON.parse(cfgRaw);
    const token = String(cfg?.gateway?.auth?.token || "");
    const authMode = String(cfg?.gateway?.auth?.mode || "");
    const sessions = parseSessions(agentId);
    const mainSession = sessions.find((s) => s.key.endsWith(":main"));

    return NextResponse.json({
      ok: true,
      connected: true,
      tokenReady: authMode !== "token" || token.length > 0,
      authMode,
      sessionKey: mainSession?.key || sessions?.[0]?.key || `agent:${agentId}:main`,
      sessionId: mainSession?.sessionId || sessions?.[0]?.sessionId || null,
      sessions,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, connected: false, error: err?.message || "Connect session failed" },
      { status: 500 },
    );
  }
}

