import { NextResponse } from "next/server";
import { syncOpenclawToMysql } from "@/lib/db-sync";
import { getMysqlPool } from "@/lib/mysql";
import { enforceLocalRequest } from "@/lib/api-local-guard";

export async function POST(req: Request) {
  const guard = enforceLocalRequest(req, "Storage sync API");
  if (guard) return guard;
  try {
    const summary = await syncOpenclawToMysql("api:storage-sync");
    return NextResponse.json({ ok: true, ...summary });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "sync failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  const guard = enforceLocalRequest(req, "Storage sync API");
  if (guard) return guard;
  try {
    const pool = getMysqlPool();
    const [rows] = await pool.query(
      `SELECT id, reason, status, message, started_at, ended_at
       FROM oc_sync_runs
       ORDER BY id DESC
       LIMIT 1`,
    );
    const row = (rows as any[])[0] || null;
    if (!row) return NextResponse.json({ ok: true, latest: null });
    return NextResponse.json({
      ok: true,
      latest: {
        id: Number(row.id || 0),
        reason: String(row.reason || ""),
        status: String(row.status || ""),
        message: String(row.message || ""),
        startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
        endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : null,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "failed to load sync status" },
      { status: 500 },
    );
  }
}

