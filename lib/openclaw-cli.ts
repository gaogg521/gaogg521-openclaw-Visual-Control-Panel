import { execFile } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";
import { getResolvedOpenclawHome } from "@/lib/openclaw-home-detect";
import { getOpenclawPackageCandidates } from "@/lib/openclaw-paths";

const execFileAsync = promisify(execFile);

/**
 * OpenClaw CLI（paths 模块）语义：OPENCLAW_HOME = 用户主目录，再在底下拼 `.openclaw` 作为状态目录。
 * 本面板与 README 里常把 OPENCLAW_HOME 设为「已含 openclaw.json 的状态目录」。
 * 若把状态目录误传给 CLI 的 OPENCLAW_HOME，会解析成 `…/.openclaw/.openclaw`，agents.list 读错 → Unknown agent id。
 */
function openclawChildEnv(): NodeJS.ProcessEnv {
  const stateDir = getResolvedOpenclawHome();
  const configPath = path.join(stateDir, "openclaw.json");
  const userHome =
    (process.env.USERPROFILE && process.env.USERPROFILE.trim()) ||
    (process.env.HOME && process.env.HOME.trim()) ||
    os.homedir();
  return {
    ...process.env,
    FORCE_COLOR: "0",
    OPENCLAW_HOME: userHome,
    OPENCLAW_STATE_DIR: stateDir,
    OPENCLAW_CONFIG_PATH: configPath,
  };
}

function openclawExecCwd(): string {
  try {
    const d = getResolvedOpenclawHome();
    if (d && fs.existsSync(d)) return d;
  } catch {
    /* ignore */
  }
  return process.cwd();
}

/**
 * 解析 openclaw 可执行文件路径。
 * Next / IDE 启动的 dev 进程往往继承不到「用户终端」里的 PATH（npm 全局目录），
 * 会导致 `spawn openclaw ENOENT`。可设置 OPENCLAW_CLI 或 OPENCLAW_CLI_PATH 指向完整路径。
 */
export function resolveOpenclawExecutable(): string {
  const fromEnv = (process.env.OPENCLAW_CLI || process.env.OPENCLAW_CLI_PATH || "").trim();
  if (fromEnv) return fromEnv;

  const home = os.homedir();
  const candidates: string[] = [];

  if (process.platform === "win32") {
    const appdata =
      process.env.APPDATA ||
      (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "AppData", "Roaming") : undefined);
    if (appdata) {
      candidates.push(path.join(appdata, "npm", "openclaw.cmd"));
      candidates.push(path.join(appdata, "npm", "openclaw"));
    }
    candidates.push(path.join(home, "scoop", "shims", "openclaw.exe"));
    candidates.push(path.join(home, "scoop", "shims", "openclaw.cmd"));
    const prefix = process.env.npm_config_prefix?.trim();
    if (prefix) {
      candidates.push(path.join(prefix, "openclaw.cmd"));
      candidates.push(path.join(prefix, "openclaw"));
    }
  } else {
    candidates.push("/opt/homebrew/bin/openclaw");
    candidates.push("/usr/local/bin/openclaw");
    candidates.push(path.join(home, ".local", "bin", "openclaw"));
    const prefix = process.env.npm_config_prefix?.trim();
    if (prefix) {
      candidates.push(path.join(prefix, "bin", "openclaw"));
    }
  }

  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) return c;
    } catch {
      /* ignore */
    }
  }

  return "openclaw";
}

function execOptionsForOpenclaw(exe: string): import("child_process").ExecFileOptions {
  const lower = exe.toLowerCase();
  const opts: import("child_process").ExecFileOptions = {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: "0" },
    windowsHide: true,
  };
  // Windows 下 .cmd/.bat 需通过 shell 启动，否则易出现 ENOENT 或无法执行
  if (process.platform === "win32" && (lower.endsWith(".cmd") || lower.endsWith(".bat"))) {
    opts.shell = true;
  }
  return opts;
}

/**
 * 全局安装的 openclaw 包入口（npm 的 openclaw.cmd 实际就是 node 调这个文件）。
 * 优先走此路径可避免 Windows 上 shell:true + cmd 转义破坏 `--params` 里的 JSON，
 * 进而出现 Gateway call failed: SyntaxError: Expected property name... at position 1。
 */
export function resolveOpenclawMjsPath(): string | null {
  const fromEnv = (process.env.OPENCLAW_MJS || process.env.OPENCLAW_ENTRY || "").trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  for (const dir of getOpenclawPackageCandidates()) {
    const mjs = path.join(dir, "openclaw.mjs");
    try {
      if (fs.existsSync(mjs)) return mjs;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * 执行 openclaw CLI。优先 `node openclaw.mjs`（无 cmd 层），保证 `--params` 大段 JSON 不被破坏；
 * 找不到包时再回退到 openclaw / openclaw.cmd。
 */
export async function execOpenclaw(
  args: string[],
  opts?: { timeoutMs?: number; preferExecutable?: boolean },
): Promise<{ stdout: string; stderr: string }> {
  const mjs = opts?.preferExecutable ? null : resolveOpenclawMjsPath();
  const baseEnv = openclawChildEnv();
  const cwd = openclawExecCwd();
  const timeout = opts?.timeoutMs;
  let r: { stdout: string | Buffer; stderr: string | Buffer };

  if (mjs) {
    r = await execFileAsync(process.execPath, [mjs, ...args], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      cwd,
      ...(typeof timeout === "number" ? { timeout } : {}),
      env: baseEnv,
      windowsHide: true,
    });
  } else {
    const exe = resolveOpenclawExecutable();
    const shellOpts = execOptionsForOpenclaw(exe);
    r = await execFileAsync(exe, args, {
      ...shellOpts,
      cwd,
      env: { ...shellOpts.env, ...baseEnv },
      ...(typeof timeout === "number" ? { timeout } : {}),
    });
  }

  return {
    stdout: typeof r.stdout === "string" ? r.stdout : r.stdout?.toString?.("utf8") ?? "",
    stderr: typeof r.stderr === "string" ? r.stderr : r.stderr?.toString?.("utf8") ?? "",
  };
}

/**
 * 与 execOpenclaw 相同启动方式，但进程非零退出时不抛错（供 gateway restart 等：CLI 可能因健康检查超时退出，而服务已起来）。
 * 仅 spawn / 可执行文件缺失等仍会 reject。
 */
export function execOpenclawWithExitCode(
  args: string[],
  opts?: { timeoutMs?: number },
): Promise<{ code: number; stdout: string; stderr: string }> {
  const mjs = resolveOpenclawMjsPath();
  const baseEnv = openclawChildEnv();
  const cwd = openclawExecCwd();

  return new Promise((resolve, reject) => {
    const finish = (
      err: Error | null,
      stdout: string | Buffer,
      stderr: string | Buffer,
    ) => {
      const out = typeof stdout === "string" ? stdout : stdout?.toString?.("utf8") ?? "";
      const errStr = typeof stderr === "string" ? stderr : stderr?.toString?.("utf8") ?? "";
      if (err) {
        const ne = err as NodeJS.ErrnoException;
        if (ne.code === "ENOENT" || /ENOENT/i.test(String(ne.message))) {
          reject(err);
          return;
        }
        const raw = (ne as { code?: string | number }).code;
        const code =
          typeof raw === "number"
            ? raw
            : typeof raw === "string" && /^\d+$/.test(raw)
              ? Number(raw)
              : 1;
        resolve({ code, stdout: out, stderr: errStr });
        return;
      }
      resolve({ code: 0, stdout: out, stderr: errStr });
    };

    if (mjs) {
      execFile(
        process.execPath,
        [mjs, ...args],
        {
          encoding: "utf8",
          maxBuffer: 10 * 1024 * 1024,
          cwd,
          ...(typeof opts?.timeoutMs === "number" ? { timeout: opts.timeoutMs } : {}),
          env: baseEnv,
          windowsHide: true,
        },
        finish,
      );
    } else {
      const exe = resolveOpenclawExecutable();
      const shellOpts = execOptionsForOpenclaw(exe);
      execFile(
        exe,
        args,
        {
          ...shellOpts,
          cwd,
          env: { ...shellOpts.env, ...baseEnv },
          encoding: "utf8",
          maxBuffer: 10 * 1024 * 1024,
          ...(typeof opts?.timeoutMs === "number" ? { timeout: opts.timeoutMs } : {}),
        },
        finish,
      );
    }
  });
}

/** 供 API 错误提示：推荐用户在 .env.local 中设置的示例路径 */
export function openclawCliEnvHint(): string {
  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "npm", "openclaw.cmd");
  }
  return "/opt/homebrew/bin/openclaw 或 ~/.local/bin/openclaw";
}

export function parseJsonFromMixedOutput(output: string): any {
  for (let i = 0; i < output.length; i++) {
    if (output[i] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let j = i; j < output.length; j++) {
      const ch = output[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === "\"") inString = false;
        continue;
      }
      if (ch === "\"") {
        inString = true;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = output.slice(i, j + 1).trim();
          try {
            return JSON.parse(candidate);
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}

/**
 * OpenClaw CLI 常把插件注册、诊断等写到 stdout/stderr；勿当作聊天正文展示。
 */
export function stripOpenclawCliLogNoise(text: string): string {
  return String(text || "")
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (/^\[plugins\]/i.test(t)) return false;
      if (/^\[diagnostic\]/i.test(t)) return false;
      if (/^\[openclaw\]/i.test(t)) return false;
      if (/^\[model-fallback/i.test(t)) return false;
      if (/^\[agent\/embedded\]/i.test(t)) return false;
      if (/^\[agent\]\s/i.test(t)) return false;
      if (/^\s*at\s+/.test(t)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

export function parseOpenclawJsonOutput(stdout: string, stderr = ""): any {
  const trimmed = stdout.trim();
  if (trimmed) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Fallback below.
    }
  }
  const fromStdout = parseJsonFromMixedOutput(stdout);
  if (fromStdout != null) return fromStdout;
  return parseJsonFromMixedOutput(`${stdout}\n${stderr}`);
}

export function resolveConfigSnapshotHash(snapshot: { hash?: string; raw?: string | null } | null | undefined): string | null {
  const hash = snapshot?.hash;
  if (typeof hash === "string" && hash.trim()) return hash.trim();
  if (typeof snapshot?.raw !== "string") return null;
  return crypto.createHash("sha256").update(snapshot.raw).digest("hex");
}

export async function callOpenclawGateway(method: string, params: Record<string, unknown> = {}, timeoutMs = 10000): Promise<any> {
  try {
    // OpenClaw CLI: `gateway call [options] <method>` —— method 必须放在最后，
    // 否则 `--json` / `--timeout` / `--params` 会被当成多余位置参数。
    const { stdout, stderr } = await execOpenclaw(
      [
        "gateway",
        "call",
        "--json",
        "--timeout",
        String(timeoutMs),
        "--params",
        JSON.stringify(params),
        method,
      ],
      { timeoutMs: Math.min(120_000, Math.max(5000, timeoutMs + 2500)) },
    );
    const parsed = parseOpenclawJsonOutput(stdout, stderr);
    if (parsed == null) {
      throw new Error(`Failed to parse Gateway response for ${method}`);
    }
    return parsed;
  } catch (err: any) {
    const stderr = typeof err?.stderr === "string" ? err.stderr.trim() : "";
    const stdout = typeof err?.stdout === "string" ? err.stdout.trim() : "";
    let message = stderr || stdout || err?.message || `Gateway call failed: ${method}`;
    const code = err?.code;
    if (code === "ENOENT" || /spawn .* ENOENT/i.test(String(message))) {
      const hint = openclawCliEnvHint();
      const mjs = resolveOpenclawMjsPath();
      message = [
        "找不到 openclaw 可执行文件（仪表盘进程 PATH 中通常没有 npm 全局目录）。",
        mjs ? `已检测到包入口：${mjs.replace(/\\/g, "/")}（若仍失败请检查 Node 与全局安装）` : "",
        `也可在项目 .env.local 设置 OPENCLAW_CLI=${hint.replace(/\\/g, "/")} 或 OPENCLAW_MJS=.../openclaw.mjs`,
        `当前回退命令：${resolveOpenclawExecutable()}`,
        `原始错误：${stderr || stdout || err?.message || code}`,
      ]
        .filter(Boolean)
        .join(" ");
    }
    throw new Error(message);
  }
}
