import fs from "fs";
import path from "path";
import { readJsonFileSync } from "@/lib/json";
import { OPENCLAW_CONFIG_PATH, OPENCLAW_HOME } from "@/lib/openclaw-paths";

/** 与内网调试台「协议」选项对应，写入 JSON 时用这些值 */
export type ProbePresetProtocol = "anthropic" | "openai" | "gemini" | string;

export type RawProbePreset = {
  id: string;
  label?: string;
  /** 网关根 URL，勿带 /v1/messages 或 /chat/completions */
  baseUrl: string;
  /** anthropic | openai | gemini（gemini 当前不做直连探测） */
  protocol: ProbePresetProtocol;
  /** 明文 key 或全大写环境变量名，如 JOYMAAS_API_KEY */
  apiKey?: string;
  headers?: Record<string, string>;
  authHeader?: boolean | string;
  /** 与 Kimi 一样要求 temperature=1 时设为 true */
  kimiTemperature?: boolean;
};

export type ProbePresetFileShape = {
  presets?: RawProbePreset[];
};

function presetCandidatePaths(): string[] {
  return [
    path.join(process.cwd(), "model-probe-presets.json"),
    path.join(OPENCLAW_HOME, "model-probe-presets.json"),
  ];
}

function looksLikeEnvPlaceholder(key: string): boolean {
  return /^[A-Z][A-Z0-9_]+$/.test(key.trim());
}

/** anthropic → anthropic-messages；openai → openai-completions */
export function mapProbeProtocolToApi(protocol: string): "anthropic-messages" | "openai-completions" | null {
  const p = String(protocol || "")
    .trim()
    .toLowerCase();
  if (p === "anthropic" || p === "anthropic-messages") return "anthropic-messages";
  if (p === "openai" || p === "openai-completions" || p === "openai-chat") return "openai-completions";
  if (p === "gemini" || p === "google") return null;
  return null;
}

function mergePresetsFromObject(data: unknown, into: Map<string, RawProbePreset>): void {
  if (!data) return;
  let arr: RawProbePreset[] | undefined;
  if (Array.isArray(data)) {
    arr = data as RawProbePreset[];
  } else if (typeof data === "object" && Array.isArray((data as ProbePresetFileShape).presets)) {
    arr = (data as ProbePresetFileShape).presets;
  }
  if (!arr) return;
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const id = String((item as RawProbePreset).id || "").trim();
    if (!id) continue;
    into.set(id, item as RawProbePreset);
  }
}

/**
 * 合并来源：项目根 model-probe-presets.json → ~/.openclaw/model-probe-presets.json → openclaw.json 内嵌
 */
export function loadProbePresetsMap(): Map<string, RawProbePreset> {
  const map = new Map<string, RawProbePreset>();

  for (const file of presetCandidatePaths()) {
    try {
      if (!fs.existsSync(file)) continue;
      const data = readJsonFileSync<unknown>(file);
      mergePresetsFromObject(data, map);
    } catch {
      /* ignore */
    }
  }

  try {
    if (fs.existsSync(OPENCLAW_CONFIG_PATH)) {
      const cfg = readJsonFileSync<any>(OPENCLAW_CONFIG_PATH);
      if (cfg?.modelProbePresets) mergePresetsFromObject(cfg.modelProbePresets, map);
      if (cfg?.models?.probePresets) mergePresetsFromObject(cfg.models.probePresets, map);
      if (cfg?.models?.modelProbePresets) mergePresetsFromObject(cfg.models.modelProbePresets, map);
    }
  } catch {
    /* ignore */
  }

  return map;
}

export function getProbePresetById(id: string): RawProbePreset | null {
  const t = String(id || "").trim();
  if (!t) return null;
  return loadProbePresetsMap().get(t) ?? null;
}

/** 给前端展示：不返回明文 apiKey */
export type ProbePresetPublic = {
  id: string;
  label: string;
  baseUrl: string;
  protocol: string;
  /** env:VAR | file | none */
  keyHint: string;
};

function keyHintForPreset(p: RawProbePreset): string {
  const raw = typeof p.apiKey === "string" ? p.apiKey.trim() : "";
  if (!raw) return "none";
  if (looksLikeEnvPlaceholder(raw)) return `env:${raw}`;
  return "file";
}

export function listProbePresetsPublic(): ProbePresetPublic[] {
  const map = loadProbePresetsMap();
  const out: ProbePresetPublic[] = [];
  for (const p of map.values()) {
    const id = String(p.id || "").trim();
    if (!id) continue;
    out.push({
      id,
      label: (p.label && String(p.label).trim()) || id,
      baseUrl: String(p.baseUrl || "").trim(),
      protocol: String(p.protocol || "").trim() || "anthropic",
      keyHint: keyHintForPreset(p),
    });
  }
  out.sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN"));
  return out;
}
