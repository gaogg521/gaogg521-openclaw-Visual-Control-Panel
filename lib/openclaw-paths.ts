import os from "os";
import path from "path";

const home = os.homedir();

export const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(home, ".openclaw");
export const OPENCLAW_CONFIG_PATH = path.join(OPENCLAW_HOME, "openclaw.json");

/**
 * 运行时获取「已自动修正后」的 OPENCLAW_HOME。
 * 首次调用会触发路径探测（懒加载），后续命中缓存直接返回。
 * 适用于所有 API route 中需要读写 openclaw 文件的场景。
 */
export function getRuntimeOpenclawHome(): string {
  // 动态 require 避免循环依赖（openclaw-home-detect → openclaw-paths → openclaw-home-detect）
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getResolvedOpenclawHome } = require("./openclaw-home-detect") as typeof import("./openclaw-home-detect");
  return getResolvedOpenclawHome();
}

export function getRuntimeConfigPath(): string {
  return path.join(getRuntimeOpenclawHome(), "openclaw.json");
}
export const OPENCLAW_AGENTS_DIR = path.join(OPENCLAW_HOME, "agents");
export const OPENCLAW_PIXEL_OFFICE_DIR = path.join(OPENCLAW_HOME, "pixel-office");

/** 维度一：运行时向量/对话等 SQLite（Append-only 落盘） */
export const OPENCLAW_MEMORY_SQLITE_DIR = path.join(OPENCLAW_HOME, "memory");

/** 维度二：战略 Markdown 归档（各目录 MEMORY.md + memory 子目录下按日 recap 的 .md） */
export const OPENCLAW_WORKSPACE_AGENTS_DIR = path.join(OPENCLAW_HOME, "workspace", "agents");

function uniquePaths(paths: Array<string | undefined>): string[] {
  return Array.from(new Set(paths.filter((value): value is string => Boolean(value && value.trim()))));
}

export function getOpenclawPackageCandidates(version = process.version): string[] {
  const appData = process.env.APPDATA;
  const homebrewPrefix = process.env.HOMEBREW_PREFIX;
  const npmPrefix = process.env.npm_config_prefix || process.env.PREFIX;

  return uniquePaths([
    process.env.OPENCLAW_PACKAGE_DIR,
    path.join(home, ".local", "lib", "node_modules", "openclaw"),
    npmPrefix ? path.join(npmPrefix, "node_modules", "openclaw") : undefined,
    path.join(home, ".nvm", "versions", "node", version, "lib", "node_modules", "openclaw"),
    path.join(home, ".fnm", "node-versions", version, "installation", "lib", "node_modules", "openclaw"),
    path.join(home, ".npm-global", "lib", "node_modules", "openclaw"),
    path.join(home, ".local", "share", "pnpm", "global", "5", "node_modules", "openclaw"),
    path.join(home, "Library", "pnpm", "global", "5", "node_modules", "openclaw"),
    appData ? path.join(appData, "npm", "node_modules", "openclaw") : undefined,
    homebrewPrefix ? path.join(homebrewPrefix, "lib", "node_modules", "openclaw") : undefined,
    "/opt/homebrew/lib/node_modules/openclaw",
    "/usr/local/lib/node_modules/openclaw",
    "/usr/lib/node_modules/openclaw",
  ]);
}
