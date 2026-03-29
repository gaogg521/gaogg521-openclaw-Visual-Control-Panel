import { NextResponse } from "next/server";

/** 去掉端口；支持 [IPv6]:port、host:port */
function stripHostForCheck(host: string): string {
  const trimmed = host.trim();
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    if (end > 0) return trimmed.slice(1, end).toLowerCase();
  }
  const lastColon = trimmed.lastIndexOf(":");
  if (lastColon > 0) {
    const after = trimmed.slice(lastColon + 1);
    if (/^\d{1,5}$/.test(after)) {
      const before = trimmed.slice(0, lastColon);
      if (!before.includes(":")) return before.toLowerCase();
    }
  }
  return trimmed.toLowerCase();
}

function isPrivateIPv4(hostname: string): boolean {
  const parts = hostname.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** 严格本机回环（用于展示/日志等，不含环境变量放宽） */
export function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  const h = stripHostForCheck(host);
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

/**
 * 敏感 Config 类 API 是否允许当前 Host。
 * - 回环地址始终允许
 * - SETUP_ALLOW_REMOTE=1 时允许任意 Host（公网暴露风险自负）
 * - CONFIG_ALLOW_LAN=1 时额外允许 RFC1918 私网 IPv4（便于局域网浏览器访问）
 */
export function isTrustedConfigHost(host: string | null): boolean {
  if (process.env.SETUP_ALLOW_REMOTE === "1") return true;
  if (!host) return false;
  const h = stripHostForCheck(host);
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (process.env.CONFIG_ALLOW_LAN === "1" && isPrivateIPv4(h)) return true;
  return false;
}

export function enforceLocalRequest(
  req: Request,
  apiLabel: string,
  allowRemoteEnvName = "SETUP_ALLOW_REMOTE",
): NextResponse | null {
  const host = req.headers.get("host");
  if (process.env[allowRemoteEnvName] === "1") return null;
  if (isTrustedConfigHost(host)) return null;
  return NextResponse.json(
    { ok: false, blocked: true, error: `${apiLabel} is localhost-only.` },
    { status: 403 },
  );
}
