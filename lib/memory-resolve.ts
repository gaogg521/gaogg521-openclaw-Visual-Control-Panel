import path from "path";
import {
  OPENCLAW_AGENTS_DIR,
  OPENCLAW_MEMORY_SQLITE_DIR,
  OPENCLAW_WORKSPACE_AGENTS_DIR,
} from "@/lib/openclaw-paths";

export type MarkdownRoot = "workspace" | "legacy";

export function resolveMarkdownUnderRoot(
  root: MarkdownRoot,
  relativePath: string,
): { ok: true; fullPath: string } | { ok: false; error: string } {
  const base = root === "workspace" ? OPENCLAW_WORKSPACE_AGENTS_DIR : OPENCLAW_AGENTS_DIR;
  const norm = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!norm || norm.includes("..") || !norm.toLowerCase().endsWith(".md")) {
    return { ok: false, error: "invalid path" };
  }
  const segments = norm.split("/").filter(Boolean);
  if (segments.some((s) => s === "..")) return { ok: false, error: "invalid path" };
  const full = path.resolve(path.join(base, ...segments));
  const baseResolved = path.resolve(base);
  const rel = path.relative(baseResolved, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return { ok: false, error: "path escape" };
  }
  return { ok: true, fullPath: full };
}

export function resolveSqliteMemoryFile(basename: string): { ok: true; fullPath: string } | { ok: false; error: string } {
  const name = basename.trim();
  if (!/^[\w.-]+\.sqlite$/i.test(name)) {
    return { ok: false, error: "invalid sqlite name" };
  }
  const full = path.resolve(path.join(OPENCLAW_MEMORY_SQLITE_DIR, name));
  const root = path.resolve(OPENCLAW_MEMORY_SQLITE_DIR);
  const rel = path.relative(root, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return { ok: false, error: "path escape" };
  }
  return { ok: true, fullPath: full };
}
