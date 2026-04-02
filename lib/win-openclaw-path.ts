import fs from "fs";
import path from "path";

/**
 * Windows：一键安装常在子进程用便携 Node 执行 npm -g，产物落在
 * - %LOCALAPPDATA%\ONEClaw\node-portable\node-v*\ 或
 * - %APPDATA%\npm / %LOCALAPPDATA%\npm
 * Electron/Next 主进程启动早，PATH 不含上述目录时 execOpenclaw 会 ENOENT。
 * 本函数把「已存在」的目录 prepend 到当前进程 PATH（幂等）。
 */
export function augmentWindowsPathForOpenclawProbe(): void {
  if (process.platform !== "win32") return;
  const parts: string[] = [];
  const appdata = process.env.APPDATA || "";
  const local = process.env.LOCALAPPDATA || "";
  if (appdata) {
    const npm = path.join(appdata, "npm");
    if (fs.existsSync(npm)) parts.push(path.normalize(npm));
  }
  if (local) {
    const npm = path.join(local, "npm");
    if (fs.existsSync(npm)) parts.push(path.normalize(npm));
    const portableRoot = path.join(local, "ONEClaw", "node-portable");
    if (fs.existsSync(portableRoot)) {
      try {
        for (const name of fs.readdirSync(portableRoot)) {
          if (!/^node-v[\d.]+-win-x64$/i.test(name)) continue;
          const nodeRoot = path.join(portableRoot, name);
          if (!fs.existsSync(nodeRoot)) continue;
          parts.push(path.normalize(nodeRoot));
          const npmBin = path.join(nodeRoot, "node_modules", "npm", "bin");
          if (fs.existsSync(npmBin)) parts.push(path.normalize(npmBin));
        }
      } catch {
        /* ignore */
      }
    }
  }
  const cur = process.env.PATH || process.env.Path || "";
  const existing = new Set(
    cur
      .split(";")
      .map((s) => s.toLowerCase().trim())
      .filter(Boolean),
  );
  const extra = parts.filter((p) => p && !existing.has(p.toLowerCase()));
  if (extra.length === 0) return;
  const merged = [...extra, cur].filter(Boolean).join(";");
  process.env.PATH = merged;
  process.env.Path = merged;
}

/** 便携 Node 目录下可能存在的 openclaw 包路径（供 getOpenclawPackageCandidates 使用）。 */
export function listPortableOneClawOpenclawPackageDirs(): string[] {
  if (process.platform !== "win32") return [];
  const local = process.env.LOCALAPPDATA || "";
  if (!local) return [];
  const portableRoot = path.join(local, "ONEClaw", "node-portable");
  if (!fs.existsSync(portableRoot)) return [];
  const out: string[] = [];
  try {
    for (const name of fs.readdirSync(portableRoot)) {
      if (!/^node-v[\d.]+-win-x64$/i.test(name)) continue;
      const pkg = path.join(portableRoot, name, "node_modules", "openclaw");
      try {
        if (fs.existsSync(pkg)) out.push(path.normalize(pkg));
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** 便携 Node 前缀下 npm 全局可能生成的 openclaw.cmd 路径。 */
export function listPortableOneClawOpenclawCmdPaths(): string[] {
  if (process.platform !== "win32") return [];
  const local = process.env.LOCALAPPDATA || "";
  if (!local) return [];
  const portableRoot = path.join(local, "ONEClaw", "node-portable");
  if (!fs.existsSync(portableRoot)) return [];
  const out: string[] = [];
  try {
    for (const name of fs.readdirSync(portableRoot)) {
      if (!/^node-v[\d.]+-win-x64$/i.test(name)) continue;
      const root = path.join(portableRoot, name);
      out.push(path.join(root, "openclaw.cmd"));
      out.push(path.join(root, "openclaw.exe"));
      out.push(path.join(root, "openclaw"));
    }
  } catch {
    /* ignore */
  }
  return out;
}
