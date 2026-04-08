import fs from "fs";
import JSON5 from "json5";
import { stripUtf8Bom } from "@/lib/json";
import { OPENCLAW_CONFIG_PATH } from "@/lib/openclaw-paths";

// openclaw.json：先 JSON.parse，失败再用 JSON5（注释、尾随逗号、无引号键名等）。
export function parseOpenclawConfigText<T = unknown>(text: string): T {
  const s = stripUtf8Bom(text).trim();
  try {
    return JSON.parse(s) as T;
  } catch (strictErr) {
    try {
      return JSON5.parse(s) as T;
    } catch {
      throw strictErr;
    }
  }
}

// 同步读盘；不存在或解析失败返回空对象，不抛错。
export function readOpenclawConfigObjectSync(configPath: string = OPENCLAW_CONFIG_PATH): Record<string, unknown> {
  try {
    if (!fs.existsSync(configPath)) return {};
    const raw = fs.readFileSync(configPath, "utf-8");
    const data = parseOpenclawConfigText<unknown>(raw);
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}
