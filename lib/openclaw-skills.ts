import fs from "fs";
import path from "path";
import { readOpenclawConfigObjectSync } from "@/lib/openclaw-config-read";
import { getOpenclawPackageCandidates, OPENCLAW_CONFIG_PATH, OPENCLAW_HOME } from "@/lib/openclaw-paths";

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  emoji: string;
  source: string;
  location: string;
  usedBy: string[];
}

export interface SkillAgentInfo {
  name: string;
  emoji: string;
}

/** 面板展示的「从哪扫技能」路径行（与 listOpenclawSkills 扫描逻辑一致） */
export interface SkillScanPathRow {
  kind: "builtin" | "extension" | "custom" | "custom-workspace";
  path: string;
  exists: boolean;
  count: number;
  /** 扩展包目录名，仅 kind === "extension" 且存在子目录时 */
  packName?: string;
}

function isDirSafe(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function buildSkillScanPathRows(pkg: string, home: string, allSkills: SkillInfo[]): SkillScanPathRow[] {
  const rows: SkillScanPathRow[] = [];
  const extTotal = allSkills.filter((s) => s.source.startsWith("extension:")).length;

  const builtinPath = path.join(pkg, "skills");
  rows.push({
    kind: "builtin",
    path: path.resolve(builtinPath),
    exists: fs.existsSync(builtinPath),
    count: allSkills.filter((s) => s.source === "builtin").length,
  });

  const extRoot = path.join(pkg, "extensions");
  const extRootResolved = path.resolve(extRoot);
  const extCounts = new Map<string, number>();
  for (const s of allSkills) {
    if (!s.source.startsWith("extension:")) continue;
    const pack = s.source.slice("extension:".length);
    extCounts.set(pack, (extCounts.get(pack) || 0) + 1);
  }

  if (!fs.existsSync(extRoot)) {
    rows.push({
      kind: "extension",
      path: extRootResolved,
      exists: false,
      count: extTotal,
    });
  } else {
    let packNames: string[] = [];
    try {
      packNames = fs
        .readdirSync(extRoot)
        .filter((n) => isDirSafe(path.join(extRoot, n)))
        .sort();
    } catch {
      packNames = [];
    }
    if (packNames.length === 0) {
      rows.push({
        kind: "extension",
        path: extRootResolved,
        exists: true,
        count: extTotal,
      });
    } else {
      for (const name of packNames) {
        rows.push({
          kind: "extension",
          path: path.resolve(path.join(extRoot, name)),
          exists: true,
          count: extCounts.get(name) ?? 0,
          packName: name,
        });
      }
    }
  }

  const customPath = path.join(home, "skills");
  rows.push({
    kind: "custom",
    path: path.resolve(customPath),
    exists: fs.existsSync(customPath),
    count: allSkills.filter((s) => s.source === "custom").length,
  });

  const wsPath = path.join(home, "workspace", "skills");
  rows.push({
    kind: "custom-workspace",
    path: path.resolve(wsPath),
    exists: fs.existsSync(wsPath),
    count: allSkills.filter((s) => s.source === "custom-workspace").length,
  });

  return rows;
}

function findOpenClawPkg(): string {
  const candidates = getOpenclawPackageCandidates();
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
  }
  return candidates[0];
}

const OPENCLAW_PKG = findOpenClawPkg();

function parseFrontmatter(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!content.startsWith("---")) return result;
  const parts = content.split("---", 3);
  if (parts.length < 3) return result;
  const fm = parts[1];

  const nameMatch = fm.match(/^name:\s*(.+)/m);
  if (nameMatch) result.name = nameMatch[1].trim().replace(/^["']|["']$/g, "");

  const descMatch = fm.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  if (descMatch) result.description = descMatch[1].trim().replace(/^["']|["']$/g, "");

  const emojiMatch = fm.match(/"emoji":\s*"([^"]+)"/);
  if (emojiMatch) result.emoji = emojiMatch[1];

  return result;
}

function readSkillFile(skillMd: string, source: string, id = path.basename(path.dirname(skillMd))): SkillInfo | null {
  if (!fs.existsSync(skillMd)) return null;
  const content = fs.readFileSync(skillMd, "utf-8");
  const fm = parseFrontmatter(content);
  return {
    id,
    name: fm.name || id,
    description: fm.description || "",
    emoji: fm.emoji || "🔧",
    source,
    location: skillMd,
    usedBy: [],
  };
}

function scanSkillsDir(dir: string, source: string): SkillInfo[] {
  const skills: SkillInfo[] = [];
  if (!fs.existsSync(dir)) return skills;
  for (const name of fs.readdirSync(dir).sort()) {
    const skill = readSkillFile(path.join(dir, name, "SKILL.md"), source, name);
    if (skill) skills.push(skill);
  }
  return skills;
}

function getAgentSkillsFromSessions(): Record<string, Set<string>> {
  const agentsDir = path.join(OPENCLAW_HOME, "agents");
  const result: Record<string, Set<string>> = {};
  if (!fs.existsSync(agentsDir)) return result;

  for (const agentId of fs.readdirSync(agentsDir)) {
    const sessionsDir = path.join(agentsDir, agentId, "sessions");
    if (!fs.existsSync(sessionsDir)) continue;

    const jsonlFiles = fs.readdirSync(sessionsDir)
      .filter((file) => file.endsWith(".jsonl"))
      .sort();
    const skillNames = new Set<string>();

    for (const file of jsonlFiles.slice(-3)) {
      const content = fs.readFileSync(path.join(sessionsDir, file), "utf-8");
      const idx = content.indexOf("skillsSnapshot");
      if (idx < 0) continue;
      const chunk = content.slice(idx, idx + 5000);
      const matches = chunk.matchAll(/\\?"name\\?":\s*\\?"([^"\\]+)\\?"/g);
      for (const match of matches) {
        const name = match[1];
        if (!["exec", "read", "edit", "write", "process", "message", "web_search", "web_fetch",
              "browser", "tts", "gateway", "memory_search", "memory_get", "cron", "nodes",
              "canvas", "session_status", "sessions_list", "sessions_history", "sessions_send",
              "sessions_spawn", "agents_list"].includes(name) && name.length > 1) {
          skillNames.add(name);
        }
      }
    }

    if (skillNames.size > 0) result[agentId] = skillNames;
  }

  return result;
}

export function listOpenclawSkills(options?: { includeScanPaths?: boolean }): {
  skills: SkillInfo[];
  agents: Record<string, SkillAgentInfo>;
  total: number;
  scanPaths?: SkillScanPathRow[];
} {
  const builtinSkills = scanSkillsDir(path.join(OPENCLAW_PKG, "skills"), "builtin");

  const extDir = path.join(OPENCLAW_PKG, "extensions");
  const extSkills: SkillInfo[] = [];
  if (fs.existsSync(extDir)) {
    for (const ext of fs.readdirSync(extDir)) {
      const extSkill = readSkillFile(path.join(extDir, ext, "SKILL.md"), `extension:${ext}`, ext);
      if (extSkill) extSkills.push(extSkill);

      const skillsDir = path.join(extDir, ext, "skills");
      if (fs.existsSync(skillsDir)) {
        extSkills.push(...scanSkillsDir(skillsDir, `extension:${ext}`));
      }
    }
  }

  const customSkills = scanSkillsDir(path.join(OPENCLAW_HOME, "skills"), "custom");
  const workspaceSkills = scanSkillsDir(
    path.join(OPENCLAW_HOME, "workspace", "skills"),
    "custom-workspace",
  );
  const allSkills = [...builtinSkills, ...extSkills, ...customSkills, ...workspaceSkills];
  const scanPaths = options?.includeScanPaths
    ? buildSkillScanPathRows(OPENCLAW_PKG, OPENCLAW_HOME, allSkills)
    : undefined;

  const agentSkills = getAgentSkillsFromSessions();
  for (const skill of allSkills) {
    for (const [agentId, skills] of Object.entries(agentSkills)) {
      if (skills.has(skill.id) || skills.has(skill.name)) {
        skill.usedBy.push(agentId);
      }
    }
  }

  const config = readOpenclawConfigObjectSync(OPENCLAW_CONFIG_PATH) as Record<string, any>;
  const agentList = config.agents?.list || [];
  const agents: Record<string, SkillAgentInfo> = {};
  for (const agent of agentList) {
    agents[agent.id] = {
      name: agent.identity?.name || agent.name || agent.id,
      emoji: agent.identity?.emoji || "🤖",
    };
  }

  return {
    skills: allSkills,
    agents,
    total: allSkills.length,
    ...(scanPaths !== undefined ? { scanPaths } : {}),
  };
}

/** 按需拉取路径清单（会完整扫描技能，与 listOpenclawSkills 成本相同） */
export function getOpenclawSkillScanPaths(): SkillScanPathRow[] {
  return listOpenclawSkills({ includeScanPaths: true }).scanPaths ?? [];
}

export function getOpenclawSkillContent(source: string, id: string): { skill: SkillInfo; content: string } | null {
  const { skills } = listOpenclawSkills();
  const skill = skills.find((entry) => entry.source === source && entry.id === id);
  if (!skill) return null;
  return {
    skill,
    content: fs.readFileSync(skill.location, "utf-8"),
  };
}
