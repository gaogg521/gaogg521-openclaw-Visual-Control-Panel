import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { OPENCLAW_CONFIG_PATH, OPENCLAW_HOME } from "@/lib/openclaw-paths";
import { parseApiJsonSafely, shouldFallbackToCli, testSessionViaCli } from "@/lib/session-test-fallback";
const CONFIG_PATH = OPENCLAW_CONFIG_PATH;

export async function POST(req: Request) {
  try {
    const { sessionKey, agentId } = await req.json();
    if (!sessionKey || !agentId) {
      return NextResponse.json({ error: "Missing sessionKey or agentId" }, { status: 400 });
    }

    // Read gateway config
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw);
    const gatewayPort = config.gateway?.port || 18789;
    const gatewayToken = config.gateway?.auth?.token || "";

    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${gatewayToken}`,
        "x-openclaw-agent-id": agentId,
        "x-openclaw-session-key": sessionKey,
      };

      const resp = await fetch(`http://127.0.0.1:${gatewayPort}/v1/chat/completions`, {
        method: "POST",
        headers,
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
          return NextResponse.json({
            status: fallback.ok ? "ok" : "error",
            sessionKey,
            elapsed: fallback.elapsed,
            reply: fallback.reply,
            error: fallback.error,
          });
        }
        return NextResponse.json({
          status: "error",
          sessionKey,
          elapsed,
          error: data?.error?.message || rawText || JSON.stringify(data),
        });
      }

      const reply = data.choices?.[0]?.message?.content || "";
      return NextResponse.json({
        status: "ok",
        sessionKey,
        elapsed,
        reply: reply.slice(0, 200) || "(no reply)",
      });
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      const isTimeout = err.name === "TimeoutError" || err.name === "AbortError";
      return NextResponse.json({
        status: "error",
        sessionKey,
        elapsed,
        error: isTimeout ? "Timeout: agent not responding (100s)" : (err.message || "Unknown error").slice(0, 300),
      });
    }
  } catch (err: any) {
    return NextResponse.json({ status: "error", error: err.message }, { status: 500 });
  }
}
