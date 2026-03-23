import { NextResponse } from "next/server";
import { listProbePresetsPublic } from "@/lib/model-probe-presets";

/** 列出 JSON 中的探测预设（不返回明文 apiKey） */
export async function GET() {
  try {
    const presets = listProbePresetsPublic();
    return NextResponse.json({ presets });
  } catch (err: any) {
    return NextResponse.json(
      { presets: [], error: err?.message || "Failed to load presets" },
      { status: 500 },
    );
  }
}
