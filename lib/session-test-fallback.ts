import { execOpenclaw, parseJsonFromMixedOutput } from "@/lib/openclaw-cli";

function extractCliReply(parsed: any, stdout: string): string {
  const candidates = [
    parsed?.reply,
    parsed?.text,
    parsed?.outputText,
    parsed?.result?.reply,
    parsed?.result?.text,
    parsed?.response?.text,
    parsed?.response?.output_text,
    parsed?.message,
  ];
  const hit = candidates.find((value) => typeof value === "string" && value.trim());
  if (hit) return hit.trim().slice(0, 200);
  if (parsed?.status === "ok") {
    const summary = typeof parsed?.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : "completed";
    return `OK (${summary}, CLI fallback)`;
  }
  return (stdout || "(no reply)").trim().slice(0, 200);
}

export async function testSessionViaCli(agentId: string): Promise<{ ok: boolean; reply?: string; error?: string; elapsed: number }> {
  const startTime = Date.now();
  try {
    const { stdout, stderr } = await execOpenclaw([
      "agent",
      "--agent",
      agentId,
      "--message",
      "Health check: reply with OK",
      "--json",
      "--timeout",
      "100",
    ]);
    const elapsed = Date.now() - startTime;
    const parsed = parseJsonFromMixedOutput(`${stdout}\n${stderr || ""}`);
    const error = parsed?.error?.message || parsed?.error;
    if (typeof error === "string" && error.trim()) {
      return { ok: false, error: error.trim().slice(0, 300), elapsed };
    }
    return { ok: true, reply: extractCliReply(parsed, stdout), elapsed };
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    return { ok: false, error: (err?.message || "CLI fallback failed").slice(0, 300), elapsed };
  }
}

export function shouldFallbackToCli(resp: Response, rawText: string): boolean {
  const text = rawText.trim();
  const lower = text.toLowerCase();
  if (resp.status === 404 || text === "Not Found") return true;
  // Some gateways may reject header routing with "agent not configured",
  // while CLI path can still resolve the agent via local config.
  if (
    resp.status >= 400 &&
    /agent/.test(lower) &&
    (
      /not configured/.test(lower) ||
      /not found/.test(lower) ||
      /unknown/.test(lower) ||
      /未配置/.test(text) ||
      /不存在/.test(text)
    )
  ) {
    return true;
  }
  return false;
}

export function parseApiJsonSafely(rawText: string): any {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}
