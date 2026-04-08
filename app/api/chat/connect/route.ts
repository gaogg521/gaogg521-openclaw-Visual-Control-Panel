import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getResolvedConfigPath, getResolvedOpenclawHome } from "@/lib/openclaw-home-detect";
import { parseOpenclawConfigText } from "@/lib/openclaw-config-read";
import { enforceLocalRequest } from "@/lib/api-local-guard";

function parseSessions(agentId: string) {
  const home = getResolvedOpenclawHome();
  const sessionsPath = path.join(home, `agents/${agentId}/sessions/sessions.json`);
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
  const guard = enforceLocalRequest(req, "Chat connect API");
  if (guard) return guard;
  try {
    const body = await req.json().catch(() => ({}));
    const agentId = String(body?.agentId || "").trim();
    if (!agentId) {
      return NextResponse.json({ ok: false, error: "Missing agentId" }, { status: 400 });
    }

    const cfgRaw = fs.readFileSync(getResolvedConfigPath(), "utf-8");
    const cfg = parseOpenclawConfigText(cfgRaw) as Record<string, any>;
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

