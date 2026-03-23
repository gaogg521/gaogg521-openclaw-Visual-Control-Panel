import { NextResponse } from "next/server";
import { getStorageMetrics } from "@/lib/db-metrics";

export async function GET() {
  try {
    const metrics = await getStorageMetrics();
    return NextResponse.json({ ok: true, metrics });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "failed to load storage metrics" },
      { status: 500 },
    );
  }
}

