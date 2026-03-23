import fs from "fs";
import path from "path";
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

export function listOpenclawSkills(): { skills: SkillInfo[]; agents: Record<string, SkillAgentInfo>; total: number } {
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
  const allSkills = [...builtinSkills, ...extSkills, ...customSkills];

  const agentSkills = getAgentSkillsFromSessions();
  for (const skill of allSkills) {
    for (const [agentId, skills] of Object.entries(agentSkills)) {
      if (skills.has(skill.id) || skills.has(skill.name)) {
        skill.usedBy.push(agentId);
      }
    }
  }

  const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf-8"));
  const agentList = config.agents?.list || [];
  const agents: Record<string, SkillAgentInfo> = {};
  for (const agent of agentList) {
    agents[agent.id] = {
      name: agent.identity?.name || agent.name || agent.id,
      emoji: agent.identity?.emoji || "🤖",
    };
  }

  return { skills: allSkills, agents, total: allSkills.length };
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
