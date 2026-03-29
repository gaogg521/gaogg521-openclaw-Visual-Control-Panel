import { readJsonFileSync } from "@/lib/json";
import { OPENCLAW_CONFIG_PATH } from "@/lib/openclaw-paths";

function readGatewayWebTarget(): { port: number; token: string; host: string } {
  let port = 18789;
  let token = "";
  let host = "127.0.0.1";
  try {
    const cfg = readJsonFileSync<{
      gateway?: { port?: number; host?: string; auth?: { token?: string } };
    }>(OPENCLAW_CONFIG_PATH);
    port = cfg.gateway?.port ?? 18789;
    token = cfg.gateway?.auth?.token ?? "";
    if (typeof cfg.gateway?.host === "string" && cfg.gateway.host.trim()) {
      host = cfg.gateway.host.trim();
    }
  } catch {
    /* use defaults */
  }
  return { port, token, host };
}

async function fetchChatOnce(
  host: string,
  port: number,
  token: string,
  timeoutMs: number,
): Promise<boolean> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    const resp = await fetch(`http://${host}:${port}/chat${qs}`, {
      signal: controller.signal,
      cache: "no-store",
      redirect: "manual",
    });
    return resp.status >= 200 && resp.status < 400;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/**
 * 探测 Gateway 的 Web 聊天页是否可达（与 openclaw gateway restart 内置健康检查不同源，避免 CLI 60s 超时误判）。
 * 依次尝试配置 host、127.0.0.1、localhost。
 */
export async function probeGatewayChatReachable(timeoutMs = 10000): Promise<boolean> {
  const { port, token, host } = readGatewayWebTarget();
  const hosts = Array.from(new Set([host, "127.0.0.1", "localhost"]));
  for (const h of hosts) {
    if (await fetchChatOnce(h, port, token, timeoutMs)) return true;
  }
  return false;
}
