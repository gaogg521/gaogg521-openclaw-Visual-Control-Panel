import { NextResponse } from "next/server";
import fs from "fs";
import {
  execOpenclaw,
  openclawCliEnvHint,
  resolveOpenclawExecutable,
  resolveOpenclawMjsPath,
} from "@/lib/openclaw-cli";
import { detectAndFixOpenclawHome, getResolvedConfigPath } from "@/lib/openclaw-home-detect";

export const runtime = "nodejs";

type VersionProbeResult =
  | { ok: true; version: string }
  | {
      ok: false;
      reason: "command_not_found" | "empty_version_output" | "exec_failed";
      error: string;
      detail?: string;
    };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probeOpenclawVersion(): Promise<VersionProbeResult> {
  let lastErr: { stdout?: string; stderr?: string; message?: string } | null = null;

  // 按用户约定：优先只检查 `openclaw --version`。
  // 打包环境优先走可执行文件；并做短重试，避免 PATH 刚更新时抖动误判。
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const preferExecutable of [true, false]) {
      try {
        const { stdout, stderr } = await execOpenclaw(["--version"], {
          timeoutMs: 2200,
          preferExecutable,
        });
        const line = (stdout || stderr || "").trim().split("\n")[0] || "";
        if (line) return { ok: true, version: line };
        lastErr = { message: "empty_version_output", stdout, stderr };
      } catch (e: unknown) {
        lastErr = e as { stdout?: string; stderr?: string; message?: string };
      }
    }
    if (attempt < 2) {
      tryRefreshWindowsPath();
      detectAndFixOpenclawHome();
      await sleep(250);
    }
  }

  const detail = `${lastErr?.stdout || ""}\n${lastErr?.stderr || ""}`.trim().slice(-1200) || undefined;
  const msg = String(lastErr?.message || "");
  const notFound =
    /enoent|not recognized|不是内部或外部命令|command not found|spawn/i.test(msg) ||
    /not recognized|不是内部或外部命令|command not found/i.test(detail || "");
  const reason: "command_not_found" | "empty_version_output" | "exec_failed" = notFound
    ? "command_not_found"
    : lastErr?.message === "empty_version_output"
      ? "empty_version_output"
      : "exec_failed";

  return {
    ok: false,
    reason,
    error: lastErr?.message || "openclaw execution failed",
    detail,
  };
}

function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
}

/**
 * 尝试从 Windows 注册表 / shell 刷新当前进程 PATH。
 * Next.js dev 进程在 openclaw 安装前就启动，PATH 不会自动更新。
 */
function tryRefreshWindowsPath(): void {
  if (process.platform !== "win32") return;
  try {
    // 读注册表用户 PATH
    const { execSync } = require("child_process") as typeof import("child_process");
    const out = execSync(
      'powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable(\'Path\',\'User\')"',
      { encoding: "utf8", timeout: 3000, windowsHide: true },
    ).trim();
    if (out) {
      const cur = process.env.PATH || process.env.Path || "";
      // 追加用户 PATH 中不重复的段
      const existing = new Set(cur.split(";").map((s) => s.toLowerCase().trim()));
      const extra = out.split(";").filter((s) => s.trim() && !existing.has(s.toLowerCase().trim()));
      if (extra.length > 0) {
        process.env.PATH = `${cur};${extra.join(";")}`;
      }
    }
  } catch {
    /* 读取失败时静默忽略 */
  }
}

/** 检测本机是否可执行 openclaw（与 Gateway / onboard 同一套解析逻辑） */
export async function GET(req: Request) {
  const host = req.headers.get("host");
  const allowRemote = process.env.SETUP_ALLOW_REMOTE === "1";
  if (!allowRemote && !isLocalHost(host)) {
    return NextResponse.json(
      { ok: false, error: "Precheck is localhost-only.", blocked: true },
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

  // 刷新 PATH：解决 dev 服务器在 openclaw 安装前启动、PATH 未更新的问题
  tryRefreshWindowsPath();
  // 自动探测 OPENCLAW_HOME（修正无点路径等安装问题）
  detectAndFixOpenclawHome();

  const platform = process.platform;
  const mjs = resolveOpenclawMjsPath();
  const exe = resolveOpenclawExecutable();

  const versionResult = await probeOpenclawVersion();
  if (versionResult.ok) {
    const configPath = getResolvedConfigPath();
    const configReady = fs.existsSync(configPath);
    return NextResponse.json({
      ok: true,
      version: versionResult.version,
      platform,
      resolvedExecutable: exe,
      resolvedMjs: !!mjs,
      configReady,
      configPath,
    });
  }

  return NextResponse.json({
    ok: false,
    reason: versionResult.reason,
    platform,
    resolvedExecutable: exe,
    resolvedMjs: !!mjs,
    configPath: getResolvedConfigPath(),
    hintEnv: openclawCliEnvHint(),
    docsUrl: "https://docs.openclaw.ai/install",
    error:
      versionResult.reason === "command_not_found"
        ? "openclaw command not found"
        : versionResult.error || "openclaw execution failed",
    detail: versionResult.detail,
  });
}
