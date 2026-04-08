import { NextResponse } from "next/server";
import fs from "fs";
import { OPENCLAW_CONFIG_PATH } from "@/lib/openclaw-paths";
import { readOpenclawConfigObjectSync } from "@/lib/openclaw-config-read";
import { syncOpenclawToMysql } from "@/lib/db-sync";
import { enforceLocalRequest } from "@/lib/api-local-guard";

const SUPPORTED_TOP_LEVEL_KEYS = new Set([
  "agents",
  "auth",
  "bindings",
  "channels",
  "commands",
  "gateway",
  "hooks",
  "messages",
  "meta",
  "models",
  "plugins",
  "session",
  "tools",
  "ro_channels",
]);

function buildBackupName() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hhmmss = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `openclaw-${yy}-${mm}-${dd}-${hhmmss}.json`;
}

function createConfigBackup() {
  if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) return null;
  const backupPath = `${OPENCLAW_CONFIG_PATH}.${buildBackupName()}`;
  fs.copyFileSync(OPENCLAW_CONFIG_PATH, backupPath);
  return backupPath;
}

function loadConfig(): Record<string, any> {
  return readOpenclawConfigObjectSync(OPENCLAW_CONFIG_PATH) as Record<string, any>;
}

export async function GET(req: Request) {
  const guard = enforceLocalRequest(req, "Openclaw config API");
  if (guard) return guard;
  try {
    const cfg = loadConfig();
    return NextResponse.json(cfg);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const guard = enforceLocalRequest(request, "Openclaw config API");
  if (guard) return guard;
  try {
    const body = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const unsupportedKeys = Object.keys(body).filter(
      (key) => !key.startsWith("_") && !SUPPORTED_TOP_LEVEL_KEYS.has(key),
    );
    if (unsupportedKeys.length > 0) {
      return NextResponse.json(
        {
          error: `Unsupported OpenClaw config keys: ${unsupportedKeys.join(", ")}`,
          hint: "Only officially supported top-level keys can be patched.",
        },
        { status: 400 },
      );
    }

    const current = loadConfig();
    (current as any)._config_path = undefined;
    for (const [key, value] of Object.entries(body)) {
      if (key.startsWith("_")) continue;
      (current as any)[key] = value;
    }

    const backupPath = createConfigBackup();
    const tmp = OPENCLAW_CONFIG_PATH + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(current, null, 2), "utf-8");
    fs.renameSync(tmp, OPENCLAW_CONFIG_PATH);
    await syncOpenclawToMysql("api:openclaw-config");
    return NextResponse.json({
      ok: true,
      config_path: OPENCLAW_CONFIG_PATH,
      backup_path: backupPath,
      reminder: "OpenClaw JSON was modified and auto-backed up before write.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "写入配置失败" }, { status: 500 });
  }
}
