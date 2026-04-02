import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { execOpenclaw, execOpenclawWithExitCode } from "@/lib/openclaw-cli";
import { detectAndFixOpenclawHome, getResolvedConfigPath } from "@/lib/openclaw-home-detect";
import { augmentWindowsPathForOpenclawProbe } from "@/lib/win-openclaw-path";

export const runtime = "nodejs";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tryRefreshWindowsPath(): void {
  if (process.platform !== "win32") return;
  try {
    const { execSync } = require("child_process") as typeof import("child_process");
    const out = execSync(
      'powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable(\'Path\',\'User\')"',
      { encoding: "utf8", timeout: 3000, windowsHide: true },
    ).trim();
    if (!out) return;
    const cur = process.env.PATH || process.env.Path || "";
    const existing = new Set(cur.split(";").map((s) => s.toLowerCase().trim()));
    const extra = out.split(";").filter((s) => s.trim() && !existing.has(s.toLowerCase().trim()));
    if (extra.length > 0) {
      process.env.PATH = `${cur};${extra.join(";")}`;
    }
  } catch {
    // ignore
  }
}

function inferVersionFromInstallOutput(stdout: string, stderr: string): string | null {
  const text = `${stdout || ""}\n${stderr || ""}`;
  const m1 = text.match(/OpenClaw installed successfully\s*\(([^)]+)\)/i);
  if (m1?.[1]?.trim()) return m1[1].trim();
  return null;
}

function manualInstallCommandForCurrentPlatform(): string {
  if (process.platform === "win32") return "iwr -useb https://openclaw.ai/install.ps1 | iex";
  return "curl -fsSL https://openclaw.ai/install.sh | bash";
}

/** 仅从安装日志中解析出的路径（可能已删除或从未创建，仅供对照日志）。 */
function collectPathsFromInstallLog(stdout: string, stderr: string): string[] {
  const text = `${stdout || ""}\n${stderr || ""}`;
  const hints = new Set<string>();
  const add = (v: string | null | undefined) => {
    const s = (v || "").trim();
    if (!s) return;
    try {
      hints.add(path.normalize(s));
    } catch {
      hints.add(s);
    }
  };
  const winPathPattern = /([A-Za-z]:\\[^\r\n"'<>|]+(?:\.(?:exe|msi|zip|7z|log|ps1|cmd|bat))?)/g;
  for (const m of text.matchAll(winPathPattern)) add(m[1]);
  const unixPathPattern = /(\/[^\s"'<>|]+(?:\.(?:sh|pkg|deb|rpm|tar|gz|zip|log))?)/g;
  for (const m of text.matchAll(unixPathPattern)) add(m[1]);
  return Array.from(hints).slice(0, 16);
}

/** 仅包含当前进程可见且确实存在的常见目录（避免把「可能会用到的路径」当成已下载）。 */
function collectPathsExistingOnDisk(): string[] {
  const out: string[] = [];
  const addIfDir = (p: string) => {
    try {
      if (p && fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        out.push(path.normalize(p));
      }
    } catch {
      // ignore
    }
  };
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || "";
    const userProfile = process.env.USERPROFILE || "";
    const oneClawRoot = localAppData ? path.join(localAppData, "ONEClaw") : "";
    const nodePortable = oneClawRoot ? path.join(oneClawRoot, "node-portable") : "";
    const tempOpenclaw = localAppData ? path.join(localAppData, "Temp", "openclaw") : "";
    const dotOpenclaw = userProfile ? path.join(userProfile, ".openclaw") : "";
    for (const p of [nodePortable, oneClawRoot, tempOpenclaw, dotOpenclaw]) addIfDir(p);
    if (nodePortable && fs.existsSync(nodePortable)) {
      try {
        for (const name of fs.readdirSync(nodePortable)) {
          if (/^node-v[\d.]+-win-x64$/i.test(name)) {
            addIfDir(path.join(nodePortable, name));
          }
        }
      } catch {
        // ignore
      }
    }
  } else {
    const home = process.env.HOME || "";
    if (home) {
      addIfDir(path.join(home, ".openclaw"));
      addIfDir(path.join(home, ".cache", "openclaw"));
    }
  }
  return [...new Set(out)].slice(0, 16);
}

function mergeInstallPathHints(stdout: string, stderr: string): {
  pathsFromLog: string[];
  pathsOnDisk: string[];
  downloadPathHints: string[];
} {
  const pathsFromLog = collectPathsFromInstallLog(stdout, stderr);
  const pathsOnDisk = collectPathsExistingOnDisk();
  const downloadPathHints = [...new Set([...pathsOnDisk, ...pathsFromLog])].slice(0, 16);
  return { pathsFromLog, pathsOnDisk, downloadPathHints };
}

async function probeOpenclawVersionLine(): Promise<string | null> {
  // 用户约定：优先执行 openclaw --version
  for (let attempt = 0; attempt < 10; attempt++) {
    if (attempt > 0) {
      tryRefreshWindowsPath();
      augmentWindowsPathForOpenclawProbe();
      detectAndFixOpenclawHome();
      await sleep(900);
    } else {
      augmentWindowsPathForOpenclawProbe();
    }
    for (const preferExecutable of [false, true]) {
      try {
        const { stdout, stderr } = await execOpenclaw(["--version"], {
          timeoutMs: 2400,
          preferExecutable,
        });
        const line = (stdout || stderr || "").trim().split("\n")[0] || "";
        if (line) return line;
      } catch {
        // continue trying fallback strategy
      }
    }
  }
  return null;
}

async function runPostInstallChecks() {
  const doctor = await execOpenclawWithExitCode(["doctor"], { timeoutMs: 12000 });
  const dashboard = await execOpenclawWithExitCode(["dashboard", "--help"], { timeoutMs: 7000 });
  return {
    doctor: { ok: doctor.code === 0, code: doctor.code },
    dashboard: { ok: dashboard.code === 0, code: dashboard.code },
  };
}

function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = 12 * 60 * 1000,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    let stdout = "";
    let stderr = "";
    let finished = false;

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill("SIGTERM");
      reject(new Error("安装超时，请检查网络后重试。"));
    }, timeoutMs);

    const decode = (buf: Buffer): string => {
      // PowerShell 在某些系统上会吐 UTF-16LE，避免日志乱码
      if (buf.length > 2 && buf[1] === 0) return buf.toString("utf16le");
      return buf.toString("utf8");
    };

    child.stdout.on("data", (buf: Buffer) => {
      stdout += decode(buf);
      if (stdout.length > 2_000_000) {
        stdout = stdout.slice(-1_000_000);
      }
    });

    child.stderr.on("data", (buf: Buffer) => {
      stderr += decode(buf);
      if (stderr.length > 2_000_000) {
        stderr = stderr.slice(-1_000_000);
      }
    });

    child.on("error", (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

/** 在调用官方 install.ps1 之前，若系统 PATH 上只有旧版 Node（如 v16）或没有 Node，则解压便携版 Node 22+ 并置于 PATH 最前。
 *  避免完全依赖 winget/MSI：其在子进程里常出现「下载完成但 PATH 尚未生效 / MSI 挂起」导致 OpenClaw 安装脚本误判失败。 */
const WINDOWS_NODE_BOOTSTRAP_PS = [
  "$ErrorActionPreference='Stop';",
  "function Ensure-Node22Plus {",
  "  $need=$true;",
  "  try {",
  "    if (Get-Command node -ErrorAction SilentlyContinue) {",
  "      $raw = (node -v 2>&1 | Select-Object -First 1 | Out-String).Trim();",
  "      if ($raw -match '^v(\\d+)') { if ([int]$Matches[1] -ge 22) { $need=$false } }",
  "    }",
  "  } catch {}",
  "  if (-not $need) { return }",
  "  $cacheRoot=Join-Path $env:LOCALAPPDATA 'ONEClaw\\node-portable';",
  "  New-Item -ItemType Directory -Force -Path $cacheRoot | Out-Null;",
  "  $idx=Invoke-RestMethod -UseBasicParsing -Uri 'https://nodejs.org/dist/index.json';",
  "  $ver=($idx | Where-Object { $_.version -like 'v22.*' -and ($_.files -contains 'win-x64-zip') } | Select-Object -First 1).version;",
  "  if (-not $ver) { throw 'Cannot resolve Node.js v22+ win-x64 zip from nodejs.org' };",
  "  $zipName=('node-' + $ver + '-win-x64.zip');",
  "  $zipPath=Join-Path $cacheRoot $zipName;",
  "  $nodeDir=Join-Path $cacheRoot ('node-' + $ver + '-win-x64');",
  "  if (-not (Test-Path -LiteralPath $nodeDir)) {",
  "    Invoke-WebRequest -UseBasicParsing -Uri ('https://nodejs.org/dist/' + $ver + '/' + $zipName) -OutFile $zipPath;",
  "    Expand-Archive -LiteralPath $zipPath -DestinationPath $cacheRoot -Force;",
  "  }",
  "  $npmBin=Join-Path $nodeDir 'node_modules\\npm\\bin';",
  "  $env:Path=($nodeDir + ';' + $npmBin + ';' + $env:Path);",
  "  Write-Host ('[lobster-setup] Using portable Node ' + $ver + ' at ' + $nodeDir)",
  "}",
  "Ensure-Node22Plus;",
].join(" ");

async function runWindowsOfficialInstall(projectRoot: string): Promise<{
  code: number;
  stdout: string;
  stderr: string;
  commandLabel: string;
}> {
  // 始终先保证 Node 22+ 在当前子进程 PATH 最前，再跑官方脚本（减少对 winget/MSI 同步 PATH 的依赖）
  const cmd1 =
    WINDOWS_NODE_BOOTSTRAP_PS +
    " $env:SHARP_IGNORE_GLOBAL_LIBVIPS='1'; " +
    "$env:OPENCLAW_NO_ONBOARD='1'; " +
    "& ([scriptblock]::Create((Invoke-WebRequest -UseBasicParsing -Uri 'https://openclaw.ai/install.ps1').Content)) -NoOnboard";
  const args1 = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd1];
  const r1 = await runCommand("powershell.exe", args1, projectRoot);
  if (r1.code === 0) {
    return {
      ...r1,
      commandLabel: "powershell (portable Node if needed + official install.ps1 -NoOnboard)",
    };
  }

  const cmd2 =
    WINDOWS_NODE_BOOTSTRAP_PS +
    " $env:SHARP_IGNORE_GLOBAL_LIBVIPS='1'; " +
    "$env:OPENCLAW_NO_ONBOARD='1'; " +
    "iwr -useb https://openclaw.ai/install.ps1 | iex";
  const args2 = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd2];
  const r2 = await runCommand("powershell.exe", args2, projectRoot);
  return {
    ...r2,
    commandLabel: "powershell (portable Node if needed + iwr install.ps1 | iex)",
  };
}

export async function POST(req: Request) {
  const host = req.headers.get("host");
  const allowRemote = process.env.SETUP_ALLOW_REMOTE === "1";
  if (!allowRemote && !isLocalHost(host)) {
    return NextResponse.json(
      { ok: false, blocked: true, error: "One-click install is localhost-only." },
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

  const projectRoot = process.cwd();
  const installScriptWin = path.join(projectRoot, "packaging", "openclaw-oneclick", "scripts", "install-openclaw-windows.ps1");
  const installScriptUnix = path.join(projectRoot, "packaging", "openclaw-oneclick", "scripts", "install-openclaw-macos-linux.sh");
  const runningInsidePackagedStandalone = /[\\/]resources[\\/]standalone/i.test(projectRoot);
  const manualCommand = manualInstallCommandForCurrentPlatform();

  try {
    tryRefreshWindowsPath();
    augmentWindowsPathForOpenclawProbe();
    detectAndFixOpenclawHome();

    let runResult: { code: number; stdout: string; stderr: string };
    let commandLabel = "";
    if (process.platform === "win32") {
      if (!runningInsidePackagedStandalone && fs.existsSync(installScriptWin)) {
        const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", installScriptWin];
        commandLabel = `powershell ${args.join(" ")}`;
        runResult = await runCommand("powershell.exe", args, projectRoot);
        // 本地脚本失败时再自动回退官方流，提升新用户成功率
        if (runResult.code !== 0) {
          const fallback = await runWindowsOfficialInstall(projectRoot);
          runResult = { code: fallback.code, stdout: fallback.stdout, stderr: fallback.stderr };
          commandLabel = fallback.commandLabel;
        }
      } else {
        // 打包环境强制走官方流，避免误走 resources/standalone 下不存在的本地脚本路径
        const fallback = await runWindowsOfficialInstall(projectRoot);
        runResult = { code: fallback.code, stdout: fallback.stdout, stderr: fallback.stderr };
        commandLabel = fallback.commandLabel;
      }
    } else {
      if (fs.existsSync(installScriptUnix)) {
        const args = [installScriptUnix];
        commandLabel = `bash ${args.join(" ")}`;
        runResult = await runCommand("bash", args, projectRoot);
      } else {
        const cmd =
          "export SHARP_IGNORE_GLOBAL_LIBVIPS=1; " +
          "export OPENCLAW_NO_PROMPT=1; " +
          "curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash -s -- --no-prompt --no-onboard";
        const args = ["-lc", cmd];
        commandLabel = "bash (official install.sh --no-onboard)";
        runResult = await runCommand("bash", args, projectRoot);
      }
    }

    if (runResult.code !== 0) {
      const { pathsFromLog, pathsOnDisk, downloadPathHints } = mergeInstallPathHints(
        runResult.stdout,
        runResult.stderr,
      );
      return NextResponse.json(
        {
          ok: false,
          command: commandLabel,
          manualCommand,
          downloadPathHints,
          pathsFromLog,
          pathsOnDisk,
          code: runResult.code,
          error: runResult.stderr.trim() || runResult.stdout.trim() || `安装失败（exit ${runResult.code}）`,
          stdout: runResult.stdout,
          stderr: runResult.stderr,
        },
        { status: 500 },
      );
    }

    tryRefreshWindowsPath();
    augmentWindowsPathForOpenclawProbe();
    const versionLine = await probeOpenclawVersionLine();
    if (!versionLine) {
      const { pathsFromLog, pathsOnDisk, downloadPathHints } = mergeInstallPathHints(
        runResult.stdout,
        runResult.stderr,
      );
      const inferredVersion = inferVersionFromInstallOutput(runResult.stdout, runResult.stderr);
      if (inferredVersion) {
        return NextResponse.json({
          ok: true,
          command: commandLabel,
          manualCommand,
          downloadPathHints,
          pathsFromLog,
          pathsOnDisk,
          code: 0,
          message: `ONE CLAW 已安装（${inferredVersion}），正在等待环境变量同步。请点击“我已安装，重新检测”。`,
          version: inferredVersion,
          verifyDeferred: true,
          stdout: runResult.stdout,
          stderr: runResult.stderr,
        });
      }
      return NextResponse.json(
        {
          ok: false,
          command: commandLabel,
          manualCommand,
          downloadPathHints,
          pathsFromLog,
          pathsOnDisk,
          code: 5001,
          error:
            "安装脚本执行后仍无法执行 `openclaw --version`。请检查 PATH，若提示不是内部或外部命令，请修复 PATH 后重试。",
          stdout: runResult.stdout,
          stderr: runResult.stderr,
        },
        { status: 500 },
      );
    }

    const checks = await runPostInstallChecks();
    const configPath = getResolvedConfigPath();
    const configReady = fs.existsSync(configPath);
    const { pathsFromLog, pathsOnDisk, downloadPathHints } = mergeInstallPathHints(
      runResult.stdout,
      runResult.stderr,
    );

    return NextResponse.json({
      ok: true,
      command: commandLabel,
      manualCommand,
      downloadPathHints,
      pathsFromLog,
      pathsOnDisk,
      code: 0,
      message: configReady
        ? `ONE CLAW 安装成功（${versionLine}）。`
        : `ONE CLAW 已安装（${versionLine}），但尚未初始化配置。请继续完成设置向导。`,
      version: versionLine,
      configReady,
      configPath,
      checks,
      stdout: runResult.stdout,
      stderr: runResult.stderr,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false,
        error: message || "安装执行失败",
      },
      { status: 500 },
    );
  }
}
