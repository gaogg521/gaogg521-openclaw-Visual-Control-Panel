import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { MarkdownRoot } from "@/lib/memory-resolve";
import { resolveMarkdownUnderRoot } from "@/lib/memory-resolve";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const root = (url.searchParams.get("root") || "").trim() as MarkdownRoot;
    const rel = (url.searchParams.get("path") || "").trim();
    if (root !== "workspace" && root !== "legacy") {
      return NextResponse.json({ error: "invalid root" }, { status: 400 });
    }
    const resolved = resolveMarkdownUnderRoot(root, rel);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    if (!fs.existsSync(resolved.fullPath)) {
      return NextResponse.json({ root, path: rel, content: "", exists: false });
    }
    const content = fs.readFileSync(resolved.fullPath, "utf-8");
    const st = fs.statSync(resolved.fullPath);
    return NextResponse.json({
      root,
      path: rel,
      content,
      exists: true,
      mtimeMs: st.mtimeMs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "read failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const root = body.root as MarkdownRoot;
    const rel = typeof body.path === "string" ? body.path.trim() : "";
    const content = typeof body.content === "string" ? body.content : "";
    if (root !== "workspace" && root !== "legacy") {
      return NextResponse.json({ error: "invalid root" }, { status: 400 });
    }
    const resolved = resolveMarkdownUnderRoot(root, rel);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    const dir = path.dirname(resolved.fullPath);
    if (!fs.existsSync(dir)) {
      return NextResponse.json({ error: "parent directory missing" }, { status: 400 });
    }
    if (fs.existsSync(resolved.fullPath)) {
      try {
        fs.copyFileSync(resolved.fullPath, `${resolved.fullPath}.bak-${Date.now()}`);
      } catch {
        /* optional */
      }
    }
    const tmp = `${resolved.fullPath}.tmp`;
    fs.writeFileSync(tmp, content, "utf-8");
    fs.renameSync(tmp, resolved.fullPath);
    return NextResponse.json({ ok: true, root, path: rel });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "write failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
