import fs from "fs";
import path from "path";
import { OPENCLAW_AGENTS_DIR, OPENCLAW_CONFIG_PATH, OPENCLAW_HOME } from "@/lib/openclaw-paths";

type ConfigAgent = {
  id?: string;
  name?: string;
  agentDir?: string;
  workspace?: string;
  model?: string;
  identity?: { emoji?: string };
  emoji?: string;
};

export type RuntimeAgentInfo = {
  id: string;
  name?: string;
  model?: string;
  emoji?: string;
  agentDir?: string;
  workspace?: string;
};

function readConfigAgents(): RuntimeAgentInfo[] {
  try {
    if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) return [];
    const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    const list: ConfigAgent[] = Array.isArray(parsed?.agents?.list) ? parsed.agents.list : [];
    return list
      .filter((x) => x && typeof x.id === "string" && x.id.trim())
      .map((x) => ({
        id: String(x.id),
        name: typeof x.name === "string" ? x.name : undefined,
        model: typeof x.model === "string" ? x.model : undefined,
        emoji:
          typeof x.identity?.emoji === "string"
            ? x.identity.emoji
            : typeof x.emoji === "string"
              ? x.emoji
              : undefined,
        agentDir: typeof x.agentDir === "string" ? x.agentDir : undefined,
        workspace: typeof x.workspace === "string" ? x.workspace : undefined,
      }));
  } catch {
    return [];
  }
}

function fallbackAgentsFromDir(): RuntimeAgentInfo[] {
  try {
    if (!fs.existsSync(OPENCLAW_AGENTS_DIR)) return [];
    return fs
      .readdirSync(OPENCLAW_AGENTS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => ({ id: d.name }));
  } catch {
    return [];
  }
}

function uniqPaths(paths: string[]): string[] {
  return Array.from(new Set(paths.filter((x) => typeof x === "string" && x.trim())));
}

export function listRuntimeAgents(): RuntimeAgentInfo[] {
  const fromConfig = readConfigAgents();
  if (fromConfig.length > 0) return fromConfig;
  return fallbackAgentsFromDir();
}

export function getAgentSessionsDirCandidates(agentId: string): string[] {
  const info = listRuntimeAgents().find((x) => x.id === agentId);
  const agentDir = info?.agentDir;
  const workspace = info?.workspace;
  const fromAgentDir = agentDir
    ? [
        path.join(agentDir, "sessions"),
        path.join(agentDir, "agent", "sessions"),
        path.join(path.dirname(agentDir), "sessions"),
      ]
    : [];
  const fromWorkspace = workspace ? [path.join(workspace, "sessions"), path.join(workspace, "agent", "sessions")] : [];
  const defaults = [
    path.join(OPENCLAW_HOME, "agents", agentId, "sessions"),
    path.join(OPENCLAW_HOME, "agents", agentId, "agent", "sessions"),
    path.join(OPENCLAW_HOME, "workspace", "agents", agentId, "sessions"),
  ];
  return uniqPaths([...fromAgentDir, ...fromWorkspace, ...defaults]);
}

export function resolveAgentSessionsDir(agentId: string): string {
  const candidates = getAgentSessionsDirCandidates(agentId);
  for (const p of candidates) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return p;
    } catch {
      // ignore
    }
  }
  return candidates[0] || path.join(OPENCLAW_HOME, "agents", agentId, "sessions");
}
