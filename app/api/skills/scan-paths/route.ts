import { NextResponse } from "next/server";
import { getOpenclawSkillScanPaths } from "@/lib/openclaw-skills";

export async function GET() {
  try {
    return NextResponse.json({ scanPaths: getOpenclawSkillScanPaths() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
