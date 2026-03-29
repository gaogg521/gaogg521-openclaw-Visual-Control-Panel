import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
}

function isAllowedOpenPath(targetPath: string): boolean {
  if (process.platform !== "win32") return false;
  const abs = path.resolve(targetPath);
  const normalize = (v: string) => path.resolve(v).replace(/\//g, "\\").toLowerCase();
  const absNorm = normalize(abs);
  const allowedRoots = [
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "ONEClaw") : "",
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Temp", "openclaw") : "",
    process.env.TEMP || "",
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, ".openclaw") : "",
  ]
    .map((v) => v.trim())
    .filter(Boolean)
    .map(normalize);

  return allowedRoots.some((root) => absNorm === root || absNorm.startsWith(`${root}\\`));
}

export async function POST(req: Request) {
  const host = req.headers.get("host");
  const allowRemote = process.env.SETUP_ALLOW_REMOTE === "1";
  if (!allowRemote && !isLocalHost(host)) {
    return NextResponse.json(
      { ok: false, blocked: true, error: "Open path is localhost-only." },
      { status: 403 },
    );
  }

  const secret = process.env.LOBBY_SETUP_SECRET?.trim();
  if (allowRemote && !secret) {
    return NextResponse.json(
      { ok: false, error: "SETUP_ALLOW_REMOTE=1 requires LOBBY_SETUP_SECRET." },
      { status: 503 },
    );
  }
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }
  if (process.platform !== "win32") {
    return NextResponse.json({ ok: false, error: "仅支持 Windows 打开资源管理器。" }, { status: 400 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { targetPath?: string };
    const targetPath = String(body?.targetPath || "").trim();
    if (!targetPath) {
      return NextResponse.json({ ok: false, error: "targetPath 不能为空。" }, { status: 400 });
    }
    if (!fs.existsSync(targetPath)) {
      return NextResponse.json({ ok: false, error: `路径不存在：${targetPath}` }, { status: 404 });
    }
    if (!isAllowedOpenPath(targetPath)) {
      return NextResponse.json({ ok: false, error: `路径不在允许范围：${targetPath}` }, { status: 403 });
    }

    const stat = fs.statSync(targetPath);
    const args = stat.isFile() ? ["/select,", targetPath] : [targetPath];
    spawn("explorer.exe", args, {
      detached: true,
      windowsHide: true,
      stdio: "ignore",
    }).unref();

    return NextResponse.json({ ok: true, opened: targetPath, isFile: stat.isFile() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg || "打开目录失败" }, { status: 500 });
  }
}
