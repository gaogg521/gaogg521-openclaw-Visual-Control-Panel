import { NextResponse } from "next/server";
import fs from "fs";
import Database from "better-sqlite3";
import { resolveSqliteMemoryFile } from "@/lib/memory-resolve";

const LIMIT = 100;

function pickTable(db: Database.Database): string | null {
  const rows = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    .all() as { name: string }[];
  if (!rows.length) return null;
  const names = rows.map((r) => r.name);
  const preferred = ["messages", "memory_entries", "entries", "memories", "conversation", "turns", "events"];
  for (const p of preferred) {
    if (names.includes(p)) return p;
  }
  return names[0];
}

function fetchRows(db: Database.Database, table: string): Record<string, unknown>[] {
  const safe = table.replace(/"/g, '""');
  try {
    return db.prepare(`SELECT * FROM "${safe}" ORDER BY rowid DESC LIMIT ?`).all(LIMIT) as Record<string, unknown>[];
  } catch {
    try {
      return db.prepare(`SELECT * FROM "${safe}" LIMIT ?`).all(LIMIT) as Record<string, unknown>[];
    } catch {
      return [];
    }
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const file = (url.searchParams.get("file") || "").trim();
    const resolved = resolveSqliteMemoryFile(file);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    if (!fs.existsSync(resolved.fullPath)) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const st = fs.statSync(resolved.fullPath);
    let db: Database.Database;
    try {
      db = new Database(resolved.fullPath, { readonly: true, fileMustExist: true });
    } catch (e) {
      return NextResponse.json({
        file,
        mtimeMs: st.mtimeMs,
        size: st.size,
        error: e instanceof Error ? e.message : "open sqlite failed",
        rows: [] as Record<string, unknown>[],
        table: null as string | null,
      });
    }
    try {
      const table = pickTable(db);
      const rows = table ? fetchRows(db, table) : [];
      return NextResponse.json({
        file,
        mtimeMs: st.mtimeMs,
        size: st.size,
        table,
        rowCount: rows.length,
        rows,
      });
    } finally {
      db.close();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "sqlite read failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
