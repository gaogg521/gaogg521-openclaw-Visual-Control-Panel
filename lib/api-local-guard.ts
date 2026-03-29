import { NextResponse } from "next/server";

export function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
}

export function enforceLocalRequest(
  req: Request,
  apiLabel: string,
  allowRemoteEnvName = "SETUP_ALLOW_REMOTE",
): NextResponse | null {
  const host = req.headers.get("host");
  const allowRemote = process.env[allowRemoteEnvName] === "1";
  if (!allowRemote && !isLocalHost(host)) {
    return NextResponse.json(
      { ok: false, blocked: true, error: `${apiLabel} is localhost-only.` },
      { status: 403 },
    );
  }
  return null;
}
