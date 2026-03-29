import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { OPENCLAW_CONFIG_PATH, OPENCLAW_HOME } from "@/lib/openclaw-paths";
import { readJsonFileSync } from "@/lib/json";
import { execOpenclaw } from "@/lib/openclaw-cli";

function loadConfig(): Record<string, any> {
  try {
    const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf-8");
    const data = JSON.parse(raw);
    return typeof data === "object" && data !== null ? data : {};
  } catch {
    return {};
  }
}

function normalizeModels(cfg: Record<string, any>): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  const providers = cfg.models?.providers;
  if (typeof providers === "object") {
    for (const [providerName, providerCfg] of Object.entries(providers)) {
      const p = providerCfg as any;
      const models = Array.isArray(p?.models) ? p.models : [];
      for (const m of models) {
        if (typeof m === "object" && m !== null) {
          const id = m.id || m.name || "";
          if (id) out.push({ id, name: m.name || id });
        } else if (typeof m === "string") {
          out.push({ id: m, name: m });
        }
      }
    }
  }
  return out;
}

function normalizeVersionInfo(raw: string): { version: string; versionDate: string } {
  const text = raw.trim();
  const m = text.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (!m) {
    return { version: text || "—", versionDate: "" };
  }
  const year = m[1];
  const month = String(Number(m[2]));
  const day = String(Number(m[3]));
  return {
    version: `v${m[1]}.${m[2]}.${m[3]}`,
    versionDate: `${year}/${month}/${day}`,
  };
}

export async function GET(request: Request) {
  try {
    const cfg = loadConfig();
    const configPath = OPENCLAW_CONFIG_PATH;

    const host = cfg.gateway?.host || "127.0.0.1";
    const port = cfg.gateway?.port || 18789;
    const gatewayUrl = `ws://${host}:${port}`;

    let gatewayOnline = false;
    let openclawVersion = "—";
    let openclawVersionDate = "";
    try {
      const { stdout, stderr } = await execOpenclaw(["--version"], {
        timeoutMs: 4000,
        preferExecutable: true,
      });
      const line = (stdout || stderr || "").trim().split("\n")[0] || "";
      const parsed = normalizeVersionInfo(line);
      openclawVersion = parsed.version;
      openclawVersionDate = parsed.versionDate;
    } catch {
      const envVersion = (process.env.OPENCLAW_VERSION || "").trim();
      if (envVersion) {
        const parsed = normalizeVersionInfo(envVersion);
        openclawVersion = parsed.version;
        openclawVersionDate = parsed.versionDate;
      }
    }
    /**
     * 旧逻辑只打 http://localhost:port/api/health；OpenClaw 2026.3.x 已常无此路由，会误判「离线」。
     * 与 /api/gateway-health 对齐：/api/health → /chat → openclaw gateway status --json
     */
    try {
      const self = new URL(request.url);
      const probeUrl = `${self.origin}/api/gateway-health`;
      const probeRes = await fetch(probeUrl, { cache: "no-store" });
      const gh = (await probeRes.json().catch(() => null)) as Record<string, unknown> | null;
      if (gh && gh.ok === true) {
        gatewayOnline = true;
        const data = gh.data as Record<string, unknown> | undefined;
        if (data && typeof data.version === "string" && data.version.trim()) {
          const parsed = normalizeVersionInfo(data.version.trim());
          openclawVersion = parsed.version;
          if (!openclawVersionDate) openclawVersionDate = parsed.versionDate;
        } else if (typeof gh.openclawVersion === "string" && gh.openclawVersion.trim()) {
          const parsed = normalizeVersionInfo(gh.openclawVersion.trim());
          openclawVersion = parsed.version;
          if (!openclawVersionDate) openclawVersionDate = parsed.versionDate;
        }
      }
    } catch {
      gatewayOnline = false;
    }

    const channelsRaw = cfg.channels ?? cfg.ro_channels ?? [];
    let enabledCount = 0;
    const sampleNames: string[] = [];
    if (typeof channelsRaw === "object" && !Array.isArray(channelsRaw)) {
      const entries = Object.entries(channelsRaw);
      enabledCount = entries.length;
      for (const [k, v] of entries.slice(0, 3)) {
        sampleNames.push((v as any)?.name ?? k);
      }
    } else if (Array.isArray(channelsRaw)) {
      enabledCount = channelsRaw.length;
      for (const c of channelsRaw.slice(0, 3)) {
        sampleNames.push(typeof c === "object" && c?.name ? c.name : String(c));
      }
    }
    const enabledChannelsSample = sampleNames.length ? sampleNames.join(", ") : "飞书, 钉钉";

    const modelsList = normalizeModels(cfg);
    const configuredModelsSample =
      modelsList.length > 0
        ? modelsList.slice(0, 2).map((m) => m.name || m.id).join(", ")
        : "bailian/qwen3.5 plus";

    const workspace =
      cfg.workspace ||
      (cfg.agents?.defaults as any)?.workspace ||
      path.join(OPENCLAW_HOME, "workspace");
    const maxConcurrency =
      cfg.max_concurrency ?? cfg.gateway?.max_concurrency ?? 4;
    const subMaxConcurrency =
      cfg.sub_max_concurrency ?? cfg.gateway?.sub_max_concurrency ?? 8;

    return NextResponse.json({
      version: openclawVersion,
      version_date: openclawVersionDate,
      gateway_url: gatewayUrl,
      gateway_online: gatewayOnline,
      enabled_channels_count: enabledCount,
      enabled_channels_sample: enabledChannelsSample,
      configured_models_count: modelsList.length,
      configured_models_sample: configuredModelsSample,
      config_path: configPath,
      workspace: typeof workspace === "string" ? workspace : path.join(OPENCLAW_HOME, "workspace"),
      max_concurrency: maxConcurrency,
      sub_max_concurrency: subMaxConcurrency,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
