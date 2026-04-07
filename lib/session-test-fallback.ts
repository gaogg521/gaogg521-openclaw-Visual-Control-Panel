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

export async function testSessionViaCli(
  agentId: string,
  opts?: { timeoutSec?: number },
): Promise<{ ok: boolean; reply?: string; error?: string; elapsed: number }> {
  const startTime = Date.now();
  const timeoutSec = Math.min(120, Math.max(15, opts?.timeoutSec ?? 100));
  try {
    const { stdout, stderr } = await execOpenclaw(
      [
        "agent",
        "--agent",
        agentId,
        "--message",
        "Health check: reply with OK",
        "--json",
        "--timeout",
        String(timeoutSec),
      ],
      { timeoutMs: (timeoutSec + 5) * 1000 },
    );
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
  // HTTP 层能连上，但响应体里是 Gateway/WebSocket 失败（常见于本机网关短时断开）
  if (
    /gateway closed|gateway call failed|abnormal closure|normal closure|websocket|econnrefused|connect failed|socket hang up/i.test(
      lower,
    )
  ) {
    return true;
  }
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

/** fetch 抛错时是否值得用 CLI 再试一次 */
export function shouldFallbackToCliFromFetchError(err: unknown): boolean {
  const name = err && typeof err === "object" && "name" in err ? String((err as Error).name) : "";
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (name === "TimeoutError" || name === "AbortError") return true;
  return /fetch failed|econnrefused|econnreset|etimedout|network|socket|connect/i.test(msg);
}

export function parseApiJsonSafely(rawText: string): any {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}
