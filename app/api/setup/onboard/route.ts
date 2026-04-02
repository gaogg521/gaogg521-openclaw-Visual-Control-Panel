import { NextResponse } from "next/server";
import fs from "fs";
import { execOpenclawWithExitCode } from "@/lib/openclaw-cli";
import { detectAndFixOpenclawHome, getResolvedConfigPath } from "@/lib/openclaw-home-detect";
import { augmentWindowsPathForOpenclawProbe } from "@/lib/win-openclaw-path";

export const runtime = "nodejs";

type Provider = "anthropic" | "openai" | "google" | "kimi" | "custom" | "ollama";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
}

function normalizeCustomBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  let normalized = trimmed.replace(/\s+/g, "");
  // 用户常见误输入：把 /v1 写成 .v1
  normalized = normalized.replace(/\.v1$/i, "/v1");
  normalized = normalized.replace(/\/+$/, "");
  let u: URL;
  try {
    u = new URL(normalized);
  } catch {
    return "";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "";
  // OpenAI 兼容端点默认补 /v1，降低新手配置失败率
  if (!u.pathname || u.pathname === "/") {
    u.pathname = "/v1";
  }
  return u.toString().replace(/\/$/, "");
}

async function waitForConfigFile(maxAttempts = 8, intervalMs = 400): Promise<{ exists: boolean; configPath: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    detectAndFixOpenclawHome();
    const configPath = getResolvedConfigPath();
    if (fs.existsSync(configPath)) {
      return { exists: true, configPath };
    }
    if (i < maxAttempts - 1) {
      await sleep(intervalMs);
    }
  }
  return { exists: false, configPath: getResolvedConfigPath() };
}

/**
 * 极简部署向导：本地调用 openclaw onboard --non-interactive
 * 安全：默认仅允许 Host 为 localhost（避免公网暴露写密钥）。
 */
export async function POST(req: Request) {
  const host = req.headers.get("host");
  const allowRemote = process.env.SETUP_ALLOW_REMOTE === "1";
  if (!allowRemote && !isLocalHost(host)) {
    return NextResponse.json(
      { ok: false, error: "Setup API is localhost-only. Set SETUP_ALLOW_REMOTE=1 to override (not recommended)." },
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

  if (process.platform === "win32") {
    augmentWindowsPathForOpenclawProbe();
  }

  let body: {
    provider?: Provider;
    apiKey?: string;
    modelId?: string;
    customBaseUrl?: string;
    gatewayPort?: number;
    installDaemon?: boolean;
    skipSkills?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const provider = body.provider;
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const customBaseUrl = typeof body.customBaseUrl === "string" ? body.customBaseUrl.trim() : "";
  const gatewayPort =
    typeof body.gatewayPort === "number" && body.gatewayPort > 0 && body.gatewayPort < 65536
      ? body.gatewayPort
      : 18789;
  const installDaemon = body.installDaemon !== false;
  const skipSkills = body.skipSkills !== false;

  if (!provider) {
    return NextResponse.json({ ok: false, error: "Missing provider" }, { status: 400 });
  }

  const args: string[] = [
    "onboard",
    "--non-interactive",
    "--accept-risk",
    "--mode",
    "local",
    "--secret-input-mode",
    "plaintext",
    "--gateway-port",
    String(gatewayPort),
    "--gateway-bind",
    "loopback",
  ];

  if (installDaemon) {
    args.push("--install-daemon", "--daemon-runtime", "node");
  }
  if (skipSkills) {
    args.push("--skip-skills");
  }

  switch (provider) {
    case "anthropic":
      if (!apiKey) return NextResponse.json({ ok: false, error: "Missing API key" }, { status: 400 });
      args.push("--auth-choice", "anthropic-api-key", "--anthropic-api-key", apiKey);
      break;
    case "openai":
      if (!apiKey) return NextResponse.json({ ok: false, error: "Missing API key" }, { status: 400 });
      args.push("--auth-choice", "openai-api-key", "--openai-api-key", apiKey);
      break;
    case "google":
      if (!apiKey) return NextResponse.json({ ok: false, error: "Missing API key" }, { status: 400 });
      args.push("--auth-choice", "gemini-api-key", "--gemini-api-key", apiKey);
      break;
    case "kimi":
      if (!apiKey) return NextResponse.json({ ok: false, error: "Missing API key" }, { status: 400 });
      args.push("--auth-choice", "moonshot-api-key", "--moonshot-api-key", apiKey);
      break;
    case "custom":
      if (!customBaseUrl) {
        return NextResponse.json({ ok: false, error: "Missing custom base URL" }, { status: 400 });
      }
      const normalizedCustomBaseUrl = normalizeCustomBaseUrl(customBaseUrl);
      if (!normalizedCustomBaseUrl) {
        return NextResponse.json(
          { ok: false, error: "Invalid custom base URL. Please input a valid http(s) URL." },
          { status: 400 },
        );
      }
      args.push(
        "--auth-choice",
        "custom-api-key",
        "--custom-base-url",
        normalizedCustomBaseUrl,
        "--custom-compatibility",
        "openai",
        "--custom-provider-id",
        "wizard-custom",
      );
      if (apiKey) {
        args.push("--custom-api-key", apiKey);
      }
      if (modelId) {
        args.push("--custom-model-id", modelId);
      }
      break;
    case "ollama":
      args.push("--auth-choice", "ollama");
      if (modelId) {
        args.push("--custom-model-id", modelId);
      }
      if (customBaseUrl) {
        args.push("--custom-base-url", customBaseUrl);
      }
      break;
    default:
      return NextResponse.json({ ok: false, error: "Unknown provider" }, { status: 400 });
  }

  let stdout = "";
  let stderr = "";
  let code = 0;
  try {
    const r = await execOpenclawWithExitCode(args, {
      preferExecutable: true,
      timeoutMs: 90_000,
    });
    code = r.code;
    stdout = r.stdout;
    stderr = r.stderr;
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    stdout = err.stdout || "";
    stderr = err.stderr || "";
    const rawCombined = `${stdout}\n${stderr}`.trim();
    const fallbackMessage = (err.message || "").trim();
    const out = rawCombined || fallbackMessage;
    const safeLog = out.replace(/sk-[a-zA-Z0-9_-]{10,}/g, "sk-***").replace(/sk-ant-[a-zA-Z0-9_-]{10,}/g, "sk-ant-***");
    const lower = safeLog.toLowerCase();
    const friendly =
      lower.includes("requires explicit risk acknowledgement") || lower.includes("--accept-risk")
        ? "当前 OpenClaw 版本要求在非交互初始化时显式确认风险（--accept-risk）。已自动处理；请重试。"
        : lower.includes("invalid url") || lower.includes("invalid custom base url")
          ? "自定义 API Base URL 格式无效，请检查为 http(s)://... 并重试。"
          : "openclaw onboard failed";
    return NextResponse.json(
      {
        ok: false,
        error: friendly,
        detail: safeLog.slice(-4000),
      },
      { status: 500 },
    );
  }

  detectAndFixOpenclawHome();
  const combined = `${stdout}\n${stderr}`;
  const safeLog = combined.replace(/sk-[a-zA-Z0-9_-]{10,}/g, "sk-***").replace(/sk-ant-[a-zA-Z0-9_-]{10,}/g, "sk-ant-***");
  const wait = await waitForConfigFile(14, 450);

  const hint =
    modelId && provider !== "custom" && provider !== "ollama"
      ? "Model id was not passed to onboard for this provider; set default model in Models page if needed."
      : undefined;

  if (code === 0 && wait.exists) {
    return NextResponse.json({
      ok: true,
      message: "onboard completed",
      gatewayPort,
      ...wait,
      hint,
    });
  }

  if (code !== 0 && wait.exists) {
    const gwProbeFail =
      /gateway did not become reachable|gateway timeout|18789/i.test(combined) ||
      /未能在.*内.*网关|网关.*超时/i.test(combined);
    return NextResponse.json({
      ok: true,
      partialSuccess: true,
      gatewayProbeFailed: gwProbeFail,
      message: gwProbeFail
        ? "配置已写入，但 Gateway 在 CLI 短时探测内未就绪（Windows 常见）。"
        : "配置已写入，但 onboard 以非零退出码结束。",
      detail: safeLog.slice(-4000),
      gatewayPort,
      ...wait,
      hint,
    });
  }

  if (code !== 0) {
    const lower = safeLog.toLowerCase();
    const friendly =
      lower.includes("requires explicit risk acknowledgement") || lower.includes("--accept-risk")
        ? "当前 OpenClaw 版本要求在非交互初始化时显式确认风险（--accept-risk）。已自动处理；请重试。"
        : lower.includes("invalid url") || lower.includes("invalid custom base url")
          ? "自定义 API Base URL 格式无效，请检查为 http(s)://... 并重试。"
          : "openclaw onboard failed";
    return NextResponse.json(
      {
        ok: false,
        error: friendly,
        detail: safeLog.slice(-4000),
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: "onboard 已退出成功但未找到 openclaw.json，请展开日志或重试。",
      detail: safeLog.slice(-4000),
    },
    { status: 500 },
  );
}
