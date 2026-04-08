import { NextResponse } from "next/server";
import { OPENCLAW_CONFIG_PATH } from "@/lib/openclaw-paths";
import { readOpenclawConfigObjectSync } from "@/lib/openclaw-config-read";

export type ChannelItem = { id: string; name: string; enabled: boolean; raw?: Record<string, unknown> };

function loadConfig(): Record<string, any> {
  return readOpenclawConfigObjectSync(OPENCLAW_CONFIG_PATH) as Record<string, any>;
}

function normalizeChannels(cfg: Record<string, any>): ChannelItem[] {
  const raw = cfg.channels ?? cfg.ro_channels ?? [];
  const out: ChannelItem[] = [];
  if (typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "object" && v !== null) {
        out.push({
          id: k,
          name: (v as any).name ?? k,
          enabled: (v as any).enabled !== false,
          raw: v as Record<string, unknown>,
        });
      } else {
        out.push({ id: k, name: k, enabled: true, raw: {} });
      }
    }
  } else if (Array.isArray(raw)) {
    raw.forEach((c: any, i: number) => {
      if (typeof c === "string") {
        out.push({ id: c, name: c, enabled: true, raw: {} });
      } else if (typeof c === "object" && c !== null) {
        const name = c.name ?? c.id ?? String(i);
        out.push({
          id: c.id ?? name,
          name,
          enabled: c.enabled !== false,
          raw: c,
        });
      }
    });
  }
  return out;
}

export async function GET() {
  try {
    const cfg = loadConfig();
    const items = normalizeChannels(cfg);
    return NextResponse.json({ items, total: items.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
