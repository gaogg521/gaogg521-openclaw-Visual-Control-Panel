import fs from "fs";
import path from "path";
import {
  OPENCLAW_AGENTS_DIR,
  OPENCLAW_MEMORY_SQLITE_DIR,
  OPENCLAW_WORKSPACE_AGENTS_DIR,
} from "@/lib/openclaw-paths";

export type SqliteMemoryFile = { name: string; mtimeMs: number; size: number };

export type MarkdownMemoryEntry = {
  root: "workspace" | "legacy";
  relativePath: string;
  kind: "MEMORY" | "recap";
  mtimeMs: number;
};

function safePosixJoin(parts: string[]): string {
  return parts.filter(Boolean).join("/");
}

// workspace/agents：每层 MEMORY.md + 同级 memory 目录下 .md；不进入 memory 的子目录再往下扫
export function scanWorkspaceAgentsMarkdown(base: string): MarkdownMemoryEntry[] {
  const out: MarkdownMemoryEntry[] = [];
  if (!fs.existsSync(base)) return out;

  const walk = (dir: string, rel: string[]) => {
    const mem = path.join(dir, "MEMORY.md");
    try {
      if (fs.existsSync(mem) && fs.statSync(mem).isFile()) {
        const st = fs.statSync(mem);
        out.push({
          root: "workspace",
          relativePath: safePosixJoin([...rel, "MEMORY.md"]),
          kind: "MEMORY",
          mtimeMs: st.mtimeMs,
        });
      }
    } catch {
      /* skip */
    }

    const mdir = path.join(dir, "memory");
    try {
      if (fs.existsSync(mdir) && fs.statSync(mdir).isDirectory()) {
        for (const f of fs.readdirSync(mdir)) {
          if (!f.endsWith(".md")) continue;
          const fp = path.join(mdir, f);
          const st = fs.statSync(fp);
          if (!st.isFile()) continue;
          out.push({
            root: "workspace",
            relativePath: safePosixJoin([...rel, "memory", f]),
            kind: "recap",
            mtimeMs: st.mtimeMs,
          });
        }
      }
    } catch {
      /* skip */
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith(".")) continue;
      if (e.name === "memory") continue;
      walk(path.join(dir, e.name), [...rel, e.name]);
    }
  };

  walk(base, []);
  return out.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

// 兼容旧版：openclaw agents 根下递归查找各子目录的 MEMORY.md（无按日 recap 约定）
export function scanLegacyAgentsMemoryMd(base: string): MarkdownMemoryEntry[] {
  const out: MarkdownMemoryEntry[] = [];
  if (!fs.existsSync(base)) return out;

  const walk = (dir: string, rel: string[]) => {
    const mem = path.join(dir, "MEMORY.md");
    try {
      if (fs.existsSync(mem) && fs.statSync(mem).isFile()) {
        const st = fs.statSync(mem);
        out.push({
          root: "legacy",
          relativePath: safePosixJoin([...rel, "MEMORY.md"]),
          kind: "MEMORY",
          mtimeMs: st.mtimeMs,
        });
      }
    } catch {
      /* skip */
    }
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith(".")) continue;
      walk(path.join(dir, e.name), [...rel, e.name]);
    }
  };

  walk(base, []);
  return out.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function listSqliteMemoryFiles(dir: string): SqliteMemoryFile[] {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sqlite"))
      .map((name) => {
        const p = path.join(dir, name);
        const st = fs.statSync(p);
        return { name, mtimeMs: st.mtimeMs, size: st.size };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export function getMemoryInventory() {
  return {
    sqliteFiles: listSqliteMemoryFiles(OPENCLAW_MEMORY_SQLITE_DIR),
    markdownWorkspace: scanWorkspaceAgentsMarkdown(OPENCLAW_WORKSPACE_AGENTS_DIR),
    markdownLegacy: scanLegacyAgentsMemoryMd(OPENCLAW_AGENTS_DIR),
    dirs: {
      memorySqlite: OPENCLAW_MEMORY_SQLITE_DIR,
      workspaceAgents: OPENCLAW_WORKSPACE_AGENTS_DIR,
      agents: OPENCLAW_AGENTS_DIR,
    },
  };
}
