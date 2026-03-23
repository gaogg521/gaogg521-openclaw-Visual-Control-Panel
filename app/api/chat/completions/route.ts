import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { OPENCLAW_CONFIG_PATH } from "@/lib/openclaw-paths";
import { execOpenclaw, parseOpenclawJsonOutput } from "@/lib/openclaw-cli";
import { OPENCLAW_HOME } from "@/lib/openclaw-paths";

type ChatRole = "system" | "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

function readGatewayConfig(): { host: string; port: number; token: string } {
  const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf-8");
  const config = JSON.parse(raw);
  const hostRaw = String(config?.gateway?.host || config?.gateway?.hostname || "127.0.0.1");
  const host = hostRaw === "localhost" ? "127.0.0.1" : hostRaw;
  const port = Number(config?.gateway?.port || 18789);
  const token = String(config?.gateway?.auth?.token || "");
  return { host, port, token };
}

function normalizeMessages(input: any): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  const out: ChatMessage[] = [];
  for (const item of input) {
    const role = item?.role;
    const content = String(item?.content || "").trim();
    if (!content) continue;
    if (role === "system" || role === "user" || role === "assistant") {
      out.push({ role, content });
    }
  }
  return out.slice(-20);
}

function resolveSessionId(agentId: string, sessionKey: string, sessionId: string | null): string | null {
  if (sessionId) return sessionId;
  try {
    const sessionsPath = path.join(OPENCLAW_HOME, "agents", agentId, "sessions", "sessions.json");
    if (!fs.existsSync(sessionsPath)) return null;
    const raw = fs.readFileSync(sessionsPath, "utf-8");
    const sessions = JSON.parse(raw);
    const hit = sessions?.[sessionKey];
    const resolved = String(hit?.sessionId || "").trim();
    return resolved || null;
  } catch {
    return null;
  }
}

function extractReply(parsed: any, stdout = ""): string {
  const payloadText = parsed?.result?.payloads?.find?.((p: any) => typeof p?.text === "string" && p.text.trim())?.text;
  if (typeof payloadText === "string" && payloadText.trim()) {
    return payloadText.trim();
  }

  const contentText = parsed?.result?.content?.text || parsed?.result?.content;
  if (typeof contentText === "string" && contentText.trim()) {
    return contentText.trim();
  }

  return String(
    parsed?.reply ||
    parsed?.text ||
    parsed?.outputText ||
    parsed?.result?.reply ||
    parsed?.result?.text ||
    parsed?.response?.text ||
    parsed?.response?.output_text ||
    parsed?.message ||
    "",
  ).trim();
}

async function cliChatFallback(
  agentId: string,
  sessionId: string | null,
  userMessage: string,
  fastMode: boolean,
): Promise<{ ok: boolean; reply?: string; error?: string }> {
  const attempts: string[][] = [];
  const timeoutSec = fastMode ? "45" : "90";
  const thinking = fastMode ? "off" : "minimal";
  if (sessionId) {
    // Prefer session-bound call first so we don't rely on agent id resolution.
    attempts.push(["agent", "--session-id", sessionId, "--message", userMessage, "--json", "--timeout", timeoutSec, "--thinking", thinking]);
  }
  if (agentId) {
    attempts.push(["agent", "--agent", agentId, "--message", userMessage, "--json", "--timeout", timeoutSec, "--thinking", thinking]);
  }

  let lastError = "CLI fallback failed";
  for (const args of attempts) {
    try {
      const { stdout, stderr } = await execOpenclaw(args);
      const parsed = parseOpenclawJsonOutput(stdout, stderr);
      const parsedError = String(parsed?.error?.message || parsed?.error || "").trim();
      if (parsedError) {
        lastError = parsedError;
        continue;
      }
      const reply = extractReply(parsed, stdout);
      if (reply) return { ok: true, reply };
      const plain = String(stdout || "").trim();
      if (plain && !plain.startsWith("{")) {
        return { ok: true, reply: plain.slice(0, 4000) };
      }
      return { ok: true, reply: "(no reply)" };
    } catch (err: any) {
      lastError = String(err?.message || "CLI fallback failed").trim() || lastError;
    }
  }
  return { ok: false, error: lastError };
}

export async function POST(req: Request) {
  let fastMode = false;
  try {
    const body = await req.json();
    const agentId = String(body?.agentId || "").trim();
    const sessionKey = String(body?.sessionKey || "").trim();
    normalizeMessages(body?.messages);
    const userMessage = String(body?.message || "").trim();
    const sessionIdRaw = String(body?.sessionId || "").trim();
    fastMode = Boolean(body?.fastMode);
    const sessionId = resolveSessionId(agentId, sessionKey, sessionIdRaw || null);
    if (!agentId || !sessionKey) {
      return NextResponse.json({ ok: false, error: "Missing agentId or sessionKey" }, { status: 400 });
    }
    if (!userMessage) {
      return NextResponse.json({ ok: false, error: "Message cannot be empty" }, { status: 400 });
    }

    const { host, port, token } = readGatewayConfig();
    // Session context is already maintained by gateway session key.
    // Sending full frontend history again can inflate tokens and latency.
    const fastSystem =
      "【极速模式】禁止寒暄与角色扮演长开场。用中文：最多3条要点，每条≤35字；无要点时一句话≤60字。不要看板/大段列表。";
    const requestMessages = fastMode
      ? [
          { role: "system" as const, content: fastSystem },
          { role: "user" as const, content: userMessage },
        ]
      : [{ role: "user" as const, content: userMessage }];

    // 极速：压低生成长度可明显缩短模型输出耗时；普通对话保留较大上限。
    const maxTokens = fastMode ? 160 : 1024;
    const gatewayTimeoutMs = fastMode ? 75_000 : 120_000;

    const completionBody: Record<string, unknown> = {
      model: `openclaw:${agentId}`,
      messages: requestMessages,
      max_tokens: maxTokens,
    };
    if (fastMode) completionBody.temperature = 0.35;

    const resp = await fetch(`http://${host}:${port}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "x-openclaw-agent-id": agentId,
        "x-openclaw-session-key": sessionKey,
      },
      body: JSON.stringify(completionBody),
      signal: AbortSignal.timeout(gatewayTimeoutMs),
    });

    const raw = await resp.text();
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }

    if (!resp.ok) {
      const errorText = (data?.error?.message || raw || `HTTP ${resp.status}`).trim();
      const fallbackNeeded = resp.status === 404 || /not found/i.test(errorText);
      if (!fallbackNeeded) {
        return NextResponse.json(
          {
            ok: false,
            error: errorText,
            status: resp.status,
          },
          { status: 500 },
        );
      }

      // Some OpenClaw versions do not expose /v1/chat/completions.
      // Fallback to CLI agent command so chat page can still work.
      const fallback = await cliChatFallback(agentId, sessionId, userMessage, fastMode);
      if (!fallback.ok) {
        return NextResponse.json(
          { ok: false, error: fallback.error || errorText, status: resp.status },
          { status: 500 },
        );
      }
      return NextResponse.json({
        ok: true,
        reply: fallback.reply || "(no reply)",
        via: "cli-fallback",
      });
    }

    const reply = String(data?.choices?.[0]?.message?.content || "").trim();
    return NextResponse.json({
      ok: true,
      reply: reply || "(no reply)",
      raw: data,
    });
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError" || err?.name === "TimeoutError";
    return NextResponse.json(
      {
        ok: false,
        error: isTimeout
          ? fastMode
            ? "请求超时（极速模式 75s）"
            : "请求超时（120s）"
          : (err?.message || "chat request failed"),
      },
      { status: 500 },
    );
  }
}

