import fs from "fs";
import path from "path";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { OPENCLAW_HOME } from "@/lib/openclaw-paths";
import { enforceLocalRequest } from "@/lib/api-local-guard";

type AgentRole = "main" | "sub";
type ScanSource = "primary" | "workspace-fallback" | "missing";
type AgentSource = "config" | "fallback";

const MAIN_REQUIRED = [
  "IDENTITY.md",
  "MEMORY.md",
  "USER.md",
  "TOOLS.md",
  "AGENTS.md",
  "BOOTSTRAP.md",
  "SKILL_1ONE_ARMY.md",
  "SOUL.md",
  "ROLE.md",
];

const SUB_REQUIRED = [
  "IDENTITY.md",
  "MEMORY.md",
  "USER.md",
  "TOOLS.md",
  "SOUL.md",
  "ROLE.md",
];

const OPENCLAW_CONFIG_PATH = path.join(OPENCLAW_HOME, "openclaw.json");
const PRIMARY_AGENTS_ROOT = path.join(OPENCLAW_HOME, "agents");
const WORKSPACE_AGENTS_ROOT = path.join(OPENCLAW_HOME, "workspace", "agents");
const AUDIT_DIR = path.join(OPENCLAW_HOME, "audit");
const EXPERT_FILES_AUDIT_LOG = path.join(AUDIT_DIR, "expert-files-actions.log");
const ROLLBACK_DIR = path.join(AUDIT_DIR, "expert-files-rollbacks");
const MD_HISTORY_DIR = path.join(AUDIT_DIR, "expert-files-md-history");
const TEMPLATE_VERSION = "2026.03.27-v3";

type ScanRow = {
  file: string;
  exists: boolean;
  path: string;
  source: ScanSource;
  primaryPath: string;
  workspacePath: string;
};

type AgentScan = {
  id: string;
  name?: string;
  role: AgentRole;
  source: AgentSource;
  required: ScanRow[];
  missing: string[];
  compliance: number;
};

type RollbackPoint = {
  rollbackId: string;
  createdAt: number;
  action: "scaffold-missing";
  agents: string[];
  createdFiles: string[];
};

type ScaffoldPlanItem = {
  agentId: string;
  role: AgentRole;
  file: string;
  path: string;
  preview: string;
};

type MarkdownHistoryEntry = {
  historyId: string;
  agentId: string;
  file: string;
  sourcePath: string;
  contentPath: string;
  metaPath: string;
  createdAt: number;
  bytes: number;
};

type AgentDescriptor = {
  id: string;
  name?: string;
  role: AgentRole;
  source: AgentSource;
  model?: string;
  primaryBases: string[];
  workspaceBases: string[];
  identityHint?: string;
  allowSubagentIds?: string[];
};

function ensureAuditDirs() {
  if (!fs.existsSync(AUDIT_DIR)) fs.mkdirSync(AUDIT_DIR, { recursive: true });
  if (!fs.existsSync(ROLLBACK_DIR)) fs.mkdirSync(ROLLBACK_DIR, { recursive: true });
  if (!fs.existsSync(MD_HISTORY_DIR)) fs.mkdirSync(MD_HISTORY_DIR, { recursive: true });
}

function appendAuditLog(record: Record<string, unknown>) {
  ensureAuditDirs();
  fs.appendFileSync(EXPERT_FILES_AUDIT_LOG, `${JSON.stringify({ ts: Date.now(), ...record })}\n`, "utf-8");
}

function uniq(list: string[]): string[] {
  return Array.from(new Set(list.filter((x) => typeof x === "string" && x.trim())));
}

function isSafeAgentId(agentId: string): boolean {
  return /^[a-zA-Z0-9._\-\u4e00-\u9fa5]+$/.test(agentId);
}

function isSafeMdFile(file: string): boolean {
  return /^[a-zA-Z0-9._-]+\.md$/i.test(file);
}

function readJson(filePath: string): any {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function listRootDirs(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((name) => !name.startsWith("."))
    .filter((name) => fs.statSync(path.join(root, name)).isDirectory());
}

function detectMainAgentId(list: Array<{ id?: string; name?: string; subagents?: any }>): string | undefined {
  if (!Array.isArray(list) || list.length === 0) return undefined;
  const keyword = list.find((a) => {
    const text = `${a.id || ""} ${a.name || ""}`.toLowerCase();
    return text.includes("1one") || text.includes("总指挥") || text.includes("commander");
  });
  if (keyword?.id) return keyword.id;
  const hasSub = list.find((a) => Array.isArray(a?.subagents?.allowAgents) && a.subagents.allowAgents.length > 0);
  if (hasSub?.id) return hasSub.id;
  return list[0]?.id;
}

function readIdentityHint(candidates: string[]): string | undefined {
  for (const base of candidates) {
    const fp = path.join(base, "IDENTITY.md");
    try {
      if (!fs.existsSync(fp)) continue;
      const lines = fs
        .readFileSync(fp, "utf-8")
        .split("\n")
        .map((x) => x.trim())
        .filter((x) => x && !x.startsWith("#"));
      if (lines.length > 0) return lines[0].slice(0, 160);
    } catch {}
  }
  return undefined;
}

function buildAgentDescriptors(): {
  descriptors: AgentDescriptor[];
  detectedMainId?: string;
  source: AgentSource;
} {
  const cfg = readJson(OPENCLAW_CONFIG_PATH);
  const list = Array.isArray(cfg?.agents?.list) ? cfg.agents.list : [];

  if (list.length > 0) {
    const mainId = detectMainAgentId(list) || undefined;
    const descriptors = list
      .filter((it: any) => typeof it?.id === "string" && isSafeAgentId(String(it.id)))
      .map((it: any) => {
        const id = String(it.id);
        const primaryBases = uniq([
          typeof it.agentDir === "string" ? it.agentDir : "",
          typeof it.agentDir === "string" ? path.join(it.agentDir, "agent") : "",
          typeof it.agentDir === "string" ? path.dirname(it.agentDir) : "",
          path.join(PRIMARY_AGENTS_ROOT, id),
          path.join(PRIMARY_AGENTS_ROOT, id, "agent"),
        ]);
        const workspaceBases = uniq([
          typeof it.workspace === "string" ? it.workspace : "",
          path.join(WORKSPACE_AGENTS_ROOT, id),
        ]);
        const role: AgentRole = id === mainId ? "main" : "sub";
        const hint = readIdentityHint([...primaryBases, ...workspaceBases]);
        return {
          id,
          name: typeof it.name === "string" ? it.name : undefined,
          role,
          source: "config" as const,
          model: typeof it.model === "string" ? it.model : undefined,
          primaryBases,
          workspaceBases,
          identityHint: hint,
          allowSubagentIds: Array.isArray(it?.subagents?.allowAgents)
            ? it.subagents.allowAgents.filter((x: unknown) => typeof x === "string")
            : undefined,
        };
      });
    return { descriptors, detectedMainId: mainId, source: "config" };
  }

  const fallbackIds = uniq([...listRootDirs(PRIMARY_AGENTS_ROOT), ...listRootDirs(WORKSPACE_AGENTS_ROOT)]).filter(
    (id) => isSafeAgentId(id),
  );
  const fallbackMain =
    fallbackIds.find((id) => id.toLowerCase().includes("1one")) ||
    fallbackIds.find((id) => id === "main") ||
    fallbackIds[0];
  const descriptors = fallbackIds.map((id) => ({
    id,
    role: id === fallbackMain ? ("main" as const) : ("sub" as const),
    source: "fallback" as const,
    primaryBases: [path.join(PRIMARY_AGENTS_ROOT, id), path.join(PRIMARY_AGENTS_ROOT, id, "agent")],
    workspaceBases: [path.join(WORKSPACE_AGENTS_ROOT, id)],
  }));
  return { descriptors, detectedMainId: fallbackMain, source: "fallback" };
}

function requiredForRole(role: AgentRole): string[] {
  return role === "main" ? MAIN_REQUIRED : SUB_REQUIRED;
}

function resolveFileInAgent(descriptor: AgentDescriptor, file: string) {
  const primaryCandidates = descriptor.primaryBases.map((base) => path.join(base, file));
  const workspaceCandidates = descriptor.workspaceBases.map((base) => path.join(base, file));
  const existingPrimary = primaryCandidates.find((fp) => fs.existsSync(fp));
  const existingWorkspace = workspaceCandidates.find((fp) => fs.existsSync(fp));
  if (existingPrimary) {
    return {
      exists: true,
      path: existingPrimary,
      source: "primary" as ScanSource,
      primaryPath: primaryCandidates[0] || existingPrimary,
      workspacePath: workspaceCandidates[0] || "",
    };
  }
  if (existingWorkspace) {
    return {
      exists: true,
      path: existingWorkspace,
      source: "workspace-fallback" as ScanSource,
      primaryPath: primaryCandidates[0] || "",
      workspacePath: workspaceCandidates[0] || existingWorkspace,
    };
  }
  const fallbackPrimary = primaryCandidates[0] || path.join(PRIMARY_AGENTS_ROOT, descriptor.id, file);
  return {
    exists: false,
    path: fallbackPrimary,
    source: "missing" as ScanSource,
    primaryPath: fallbackPrimary,
    workspacePath: workspaceCandidates[0] || path.join(WORKSPACE_AGENTS_ROOT, descriptor.id, file),
  };
}

function buildTemplateContent(file: string, descriptor: AgentDescriptor, allDescriptors: AgentDescriptor[]): string {
  const roleLabel = descriptor.role === "main" ? "主AGENT" : "子AGENT";
  const titleName = descriptor.name || descriptor.id;
  const subagents =
    descriptor.allowSubagentIds && descriptor.allowSubagentIds.length > 0
      ? descriptor.allowSubagentIds
      : allDescriptors.filter((x) => x.role === "sub").map((x) => x.id);
  const roleScope =
    descriptor.identityHint || (descriptor.role === "main" ? "负责统筹与任务分发、质量兜底与最终决策。" : "负责领域执行，并向主AGENT反馈结果。");

  if (file === "IDENTITY.md") {
    return `# IDENTITY\n\n- agent_id: ${descriptor.id}\n- agent_name: ${titleName}\n- role: ${roleLabel}\n- model: ${descriptor.model || "inherit-default"}\n\n## 核心职责\n${roleScope}\n\n## 协作关系\n- 主AGENT: ${allDescriptors.find((x) => x.role === "main")?.id || descriptor.id}\n- 协作对象: ${subagents.join(", ") || "待配置"}\n`;
  }
  if (file === "AGENTS.md") {
    const children = allDescriptors
      .filter((x) => x.role === "sub")
      .map((x) => `- ${x.id}${x.name ? ` (${x.name})` : ""}`)
      .join("\n");
    return `# AGENTS\n\n## 主体\n- ${descriptor.id}${descriptor.name ? ` (${descriptor.name})` : ""}\n\n## 子AGENT列表\n${children || "- 暂无"}\n\n## 协同原则\n- 主AGENT负责拆解任务并统一验收。\n- 子AGENT按专长执行，输出结构化结论与可落地建议。\n`;
  }
  if (file === "ROLE.md") {
    return `# ROLE\n\n- ${descriptor.id}: ${roleLabel}\n\n## 输出标准\n- 先结论后证据\n- 输出可执行步骤\n- 关键变更提供回滚方案\n`;
  }
  if (file === "TOOLS.md") {
    return `# TOOLS\n\n## 可用工具策略\n- 默认遵循最小权限原则\n- 先读后写，先预览后执行\n- 高风险操作必须可回滚\n`;
  }
  if (file === "MEMORY.md") {
    return `# MEMORY\n\n## ${titleName}\n- 当前定位：${roleLabel}\n- 近期目标：补齐专家文件治理链路与告警闭环\n- 重要约束：主目录优先，workspace 仅兜底\n`;
  }
  if (file === "USER.md") {
    return `# USER\n\n## 用户偏好\n- 中文沟通\n- 先修稳定性，再做体验升级\n- 任何自动修复都要有可解释原理\n`;
  }
  if (file === "SOUL.md") {
    return `# SOUL\n\n- 对结果负责\n- 对风险透明\n- 对用户反馈快速迭代\n`;
  }
  if (file === "BOOTSTRAP.md") {
    return `# BOOTSTRAP\n\n1. 加载 openclaw.json 配置\n2. 识别主/子AGENT拓扑\n3. 执行任务并记录审计日志\n`;
  }
  if (file === "SKILL_1ONE_ARMY.md") {
    return `# SKILL_1ONE_ARMY\n\n- 战队协同：主AGENT分发，子AGENT执行，统一回收\n- 输出约束：可执行、可验证、可回滚\n`;
  }
  return `# ${file.replace(/\.md$/i, "")}\n\n- agent: ${descriptor.id}\n`;
}

function scanAgentsFromDescriptors(descriptors: AgentDescriptor[]): {
  agents: AgentScan[];
  totalRequired: number;
  totalMissing: number;
} {
  let totalRequired = 0;
  let totalMissing = 0;
  const agents = descriptors.map((desc) => {
    const required = requiredForRole(desc.role);
    const rows = required.map((file) => {
      const r = resolveFileInAgent(desc, file);
      return { file, exists: r.exists, path: r.path, source: r.source, primaryPath: r.primaryPath, workspacePath: r.workspacePath };
    });
    const missing = rows.filter((x) => !x.exists).map((x) => x.file);
    totalRequired += rows.length;
    totalMissing += missing.length;
    return {
      id: desc.id,
      name: desc.name,
      role: desc.role,
      source: desc.source,
      required: rows,
      missing,
      compliance: rows.length ? Math.round(((rows.length - missing.length) / rows.length) * 100) : 100,
    };
  });
  return { agents, totalRequired, totalMissing };
}

function readRollbackPoints(): RollbackPoint[] {
  ensureAuditDirs();
  const files = fs
    .readdirSync(ROLLBACK_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(ROLLBACK_DIR, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    .slice(0, 20);
  const out: RollbackPoint[] = [];
  for (const fp of files) {
    try {
      const parsed = JSON.parse(fs.readFileSync(fp, "utf-8")) as RollbackPoint;
      if (parsed?.rollbackId && Array.isArray(parsed?.createdFiles)) out.push(parsed);
    } catch {}
  }
  return out;
}

function buildScanPayload(descriptors: AgentDescriptor[], detectedMainId?: string, detectSource: AgentSource = "fallback") {
  const { agents, totalRequired, totalMissing } = scanAgentsFromDescriptors(descriptors);
  const compliance = totalRequired ? Math.round(((totalRequired - totalMissing) / totalRequired) * 100) : 100;
  return {
    ok: true,
    generatedAt: Date.now(),
    home: OPENCLAW_HOME,
    agentsRoot: PRIMARY_AGENTS_ROOT,
    roots: {
      primary: PRIMARY_AGENTS_ROOT,
      workspaceFallback: WORKSPACE_AGENTS_ROOT,
    },
    detected: {
      source: detectSource,
      mainAgentId: detectedMainId || null,
      count: descriptors.length,
    },
    overall: {
      agents: agents.length,
      totalRequired,
      totalMissing,
      compliance,
    },
    agents,
    rollbackPoints: readRollbackPoints(),
    template: {
      version: TEMPLATE_VERSION,
      files: uniq([...MAIN_REQUIRED, ...SUB_REQUIRED]).sort((a, b) => a.localeCompare(b)),
    },
    spec: {
      mainRequired: MAIN_REQUIRED,
      subRequired: SUB_REQUIRED,
    },
  };
}

function createRollbackId() {
  return `rbk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toPreview(content: string): string {
  return content.split("\n").slice(0, 6).join("\n").trim();
}

function createPlanToken(items: ScaffoldPlanItem[]) {
  const seed = items.map((x) => `${x.path}|${x.file}|${x.agentId}`).join("||");
  return crypto.createHash("sha256").update(`${TEMPLATE_VERSION}|${seed}`).digest("hex").slice(0, 24);
}

function buildScaffoldPlan(descriptors: AgentDescriptor[], targetAgentId?: string) {
  const targets = targetAgentId ? descriptors.filter((x) => x.id === targetAgentId) : descriptors;
  const items: ScaffoldPlanItem[] = [];
  for (const desc of targets) {
    for (const file of requiredForRole(desc.role)) {
      const resolved = resolveFileInAgent(desc, file);
      if (resolved.exists) continue;
      const content = buildTemplateContent(file, desc, descriptors);
      items.push({
        agentId: desc.id,
        role: desc.role,
        file,
        path: resolved.primaryPath,
        preview: toPreview(content),
      });
    }
  }
  return {
    templateVersion: TEMPLATE_VERSION,
    targetAgentId: targetAgentId || null,
    targets: targets.map((x) => x.id),
    totalFiles: items.length,
    planToken: createPlanToken(items),
    items,
  };
}

function scaffoldMissingFiles(
  descriptors: AgentDescriptor[],
  targetAgentId?: string,
  expectedPlanToken?: string,
) {
  const plan = buildScaffoldPlan(descriptors, targetAgentId);
  if (expectedPlanToken && expectedPlanToken !== plan.planToken) {
    throw new Error("计划已变化，请先重新预览后再执行补齐");
  }

  const targets = targetAgentId ? descriptors.filter((x) => x.id === targetAgentId) : descriptors;
  const createdFiles: string[] = [];
  for (const desc of targets) {
    const primaryBase =
      desc.primaryBases[0] || path.join(PRIMARY_AGENTS_ROOT, desc.id);
    if (!fs.existsSync(primaryBase)) fs.mkdirSync(primaryBase, { recursive: true });
    for (const file of requiredForRole(desc.role)) {
      const resolved = resolveFileInAgent(desc, file);
      if (resolved.exists) continue;
      const targetPath = path.join(primaryBase, file);
      const content = buildTemplateContent(file, desc, descriptors);
      fs.writeFileSync(targetPath, content, "utf-8");
      createdFiles.push(targetPath);
    }
  }

  let rollbackId: string | null = null;
  if (createdFiles.length > 0) {
    rollbackId = createRollbackId();
    const point: RollbackPoint = {
      rollbackId,
      createdAt: Date.now(),
      action: "scaffold-missing",
      agents: targets.map((x) => x.id),
      createdFiles,
    };
    ensureAuditDirs();
    fs.writeFileSync(path.join(ROLLBACK_DIR, `${rollbackId}.json`), JSON.stringify(point, null, 2), "utf-8");
  }
  appendAuditLog({
    action: "scaffold-missing",
    rollbackId,
    targetAgentId: targetAgentId || "all",
    createdCount: createdFiles.length,
    templateVersion: TEMPLATE_VERSION,
  });
  return { rollbackId, createdFiles, planToken: plan.planToken, templateVersion: TEMPLATE_VERSION };
}

function resolveDescriptorById(descriptors: AgentDescriptor[], agentId: string): AgentDescriptor {
  const hit = descriptors.find((x) => x.id === agentId);
  if (hit) return hit;
  if (!isSafeAgentId(agentId)) throw new Error("非法 agentId");
  return {
    id: agentId,
    role: "sub",
    source: "fallback",
    primaryBases: [path.join(PRIMARY_AGENTS_ROOT, agentId), path.join(PRIMARY_AGENTS_ROOT, agentId, "agent")],
    workspaceBases: [path.join(WORKSPACE_AGENTS_ROOT, agentId)],
  };
}

function resolveMarkdownPath(descriptor: AgentDescriptor, file: string) {
  if (!isSafeMdFile(file)) throw new Error("仅允许编辑 .md 文件");
  const resolved = resolveFileInAgent(descriptor, file);
  return {
    exists: resolved.exists,
    source: resolved.source,
    path: resolved.path,
    primaryPath: resolved.primaryPath,
  };
}

function normalizeFileStem(file: string): string {
  return file.replace(/\.md$/i, "");
}

function createHistoryId() {
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function historyFolder(agentId: string, file: string) {
  return path.join(MD_HISTORY_DIR, agentId, normalizeFileStem(file));
}

function snapshotMarkdownHistory(agentId: string, file: string, sourcePath: string, content: string): MarkdownHistoryEntry {
  ensureAuditDirs();
  const id = createHistoryId();
  const dir = historyFolder(agentId, file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const contentPath = path.join(dir, `${id}.md`);
  const metaPath = path.join(dir, `${id}.json`);
  fs.writeFileSync(contentPath, content, "utf-8");
  const meta: MarkdownHistoryEntry = {
    historyId: id,
    agentId,
    file,
    sourcePath,
    contentPath,
    metaPath,
    createdAt: Date.now(),
    bytes: Buffer.byteLength(content, "utf-8"),
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
  return meta;
}

function listMarkdownHistory(agentId: string, file: string): MarkdownHistoryEntry[] {
  const dir = historyFolder(agentId, file);
  if (!fs.existsSync(dir)) return [];
  const metas = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(dir, name));
  const out: MarkdownHistoryEntry[] = [];
  for (const metaPath of metas) {
    try {
      const parsed = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as MarkdownHistoryEntry;
      if (parsed?.historyId && parsed?.contentPath) out.push(parsed);
    } catch {}
  }
  return out.sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
}

function getHistoryEntry(agentId: string, file: string, historyId: string): MarkdownHistoryEntry | null {
  return listMarkdownHistory(agentId, file).find((x) => x.historyId === historyId) || null;
}

function computeDiffPreview(before: string, after: string) {
  const b = before.split("\n");
  const a = after.split("\n");
  let changed = 0;
  const max = Math.max(b.length, a.length);
  const samples: Array<{ line: number; before: string; after: string }> = [];
  for (let i = 0; i < max; i++) {
    const bv = b[i] ?? "";
    const av = a[i] ?? "";
    if (bv !== av) {
      changed += 1;
      if (samples.length < 12) samples.push({ line: i + 1, before: bv, after: av });
    }
  }
  return { changedLines: changed, beforeLines: b.length, afterLines: a.length, samples };
}

function rollbackScaffold(rollbackId: string) {
  ensureAuditDirs();
  const manifestPath = path.join(ROLLBACK_DIR, `${rollbackId}.json`);
  if (!fs.existsSync(manifestPath)) throw new Error(`Rollback point not found: ${rollbackId}`);
  const point = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as RollbackPoint;
  const removed: string[] = [];
  for (const fp of point.createdFiles || []) {
    if (!fp || typeof fp !== "string") continue;
    if (!fs.existsSync(fp)) continue;
    fs.unlinkSync(fp);
    removed.push(fp);
  }
  appendAuditLog({ action: "rollback", rollbackId, removedCount: removed.length });
  return { removed };
}

export async function GET(req: Request) {
  const guard = enforceLocalRequest(req, "Expert files API");
  if (guard) return guard;
  try {
    const built = buildAgentDescriptors();
    return NextResponse.json(buildScanPayload(built.descriptors, built.detectedMainId, built.source));
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const guard = enforceLocalRequest(req, "Expert files API");
  if (guard) return guard;
  try {
    const body = await req.json();
    const action = String(body?.action || "");
    const built = buildAgentDescriptors();
    const descriptors = built.descriptors;
    if (descriptors.length === 0) {
      return NextResponse.json({ ok: false, error: "未检测到任何可用AGENT（请检查 openclaw.json）" }, { status: 400 });
    }

    if (action === "plan-scaffold") {
      const targetAgentId =
        typeof body?.agentId === "string" && body.agentId.trim() ? String(body.agentId.trim()) : undefined;
      return NextResponse.json({ ok: true, action, plan: buildScaffoldPlan(descriptors, targetAgentId) });
    }

    if (action === "scaffold-missing") {
      const targetAgentId =
        typeof body?.agentId === "string" && body.agentId.trim() ? String(body.agentId.trim()) : undefined;
      const planToken =
        typeof body?.planToken === "string" && body.planToken.trim() ? String(body.planToken.trim()) : undefined;
      const result = scaffoldMissingFiles(descriptors, targetAgentId, planToken);
      return NextResponse.json({
        ok: true,
        action,
        rollbackId: result.rollbackId,
        createdCount: result.createdFiles.length,
        createdFiles: result.createdFiles,
        templateVersion: result.templateVersion,
        planToken: result.planToken,
        scan: buildScanPayload(descriptors, built.detectedMainId, built.source),
      });
    }

    if (action === "read-md") {
      const agentId = String(body?.agentId || "");
      const file = String(body?.file || "");
      const descriptor = resolveDescriptorById(descriptors, agentId);
      const resolved = resolveMarkdownPath(descriptor, file);
      if (!resolved.exists) return NextResponse.json({ ok: false, error: "文件不存在" }, { status: 404 });
      return NextResponse.json({
        ok: true,
        action,
        agentId,
        file,
        source: resolved.source,
        path: resolved.path,
        content: fs.readFileSync(resolved.path, "utf-8"),
        history: listMarkdownHistory(agentId, file),
      });
    }

    if (action === "preview-save-md") {
      const agentId = String(body?.agentId || "");
      const file = String(body?.file || "");
      const nextContent = String(body?.content ?? "");
      const descriptor = resolveDescriptorById(descriptors, agentId);
      const resolved = resolveMarkdownPath(descriptor, file);
      const before = resolved.exists ? fs.readFileSync(resolved.path, "utf-8") : "";
      return NextResponse.json({
        ok: true,
        action,
        agentId,
        file,
        exists: resolved.exists,
        source: resolved.source,
        path: resolved.path,
        preview: computeDiffPreview(before, nextContent),
      });
    }

    if (action === "list-md-history") {
      const agentId = String(body?.agentId || "");
      const file = String(body?.file || "");
      if (!isSafeAgentId(agentId)) return NextResponse.json({ ok: false, error: "非法 agentId" }, { status: 400 });
      if (!isSafeMdFile(file)) return NextResponse.json({ ok: false, error: "仅允许 .md" }, { status: 400 });
      return NextResponse.json({ ok: true, action, agentId, file, history: listMarkdownHistory(agentId, file) });
    }

    if (action === "save-md") {
      const agentId = String(body?.agentId || "");
      const file = String(body?.file || "");
      const content = String(body?.content ?? "");
      const descriptor = resolveDescriptorById(descriptors, agentId);
      const resolved = resolveMarkdownPath(descriptor, file);
      const targetPath = resolved.exists ? resolved.path : resolved.primaryPath;
      const before = resolved.exists ? fs.readFileSync(targetPath, "utf-8") : "";
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const historyEntry = resolved.exists ? snapshotMarkdownHistory(agentId, file, targetPath, before) : null;
      fs.writeFileSync(targetPath, content, "utf-8");
      const diff = computeDiffPreview(before, content);
      appendAuditLog({
        action: "save-md",
        agentId,
        file,
        targetPath,
        source: resolved.source,
        bytes: Buffer.byteLength(content, "utf-8"),
        changedLines: diff.changedLines,
        historyId: historyEntry?.historyId || null,
      });
      return NextResponse.json({
        ok: true,
        action,
        agentId,
        file,
        targetPath,
        diff,
        historyId: historyEntry?.historyId || null,
        history: listMarkdownHistory(agentId, file),
        scan: buildScanPayload(descriptors, built.detectedMainId, built.source),
      });
    }

    if (action === "rollback-md") {
      const agentId = String(body?.agentId || "");
      const file = String(body?.file || "");
      const historyId = String(body?.historyId || "");
      if (!historyId) return NextResponse.json({ ok: false, error: "缺少 historyId" }, { status: 400 });
      const descriptor = resolveDescriptorById(descriptors, agentId);
      const resolved = resolveMarkdownPath(descriptor, file);
      const entry = getHistoryEntry(agentId, file, historyId);
      if (!entry) return NextResponse.json({ ok: false, error: "历史版本不存在" }, { status: 404 });
      if (!fs.existsSync(entry.contentPath)) return NextResponse.json({ ok: false, error: "历史内容文件缺失" }, { status: 404 });
      const rollbackContent = fs.readFileSync(entry.contentPath, "utf-8");
      const targetPath = resolved.exists ? resolved.path : resolved.primaryPath;
      const before = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf-8") : "";
      const rollbackSnapshot = fs.existsSync(targetPath)
        ? snapshotMarkdownHistory(agentId, file, targetPath, before)
        : null;
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(targetPath, rollbackContent, "utf-8");
      const diff = computeDiffPreview(before, rollbackContent);
      appendAuditLog({
        action: "rollback-md",
        agentId,
        file,
        historyId,
        rollbackSnapshotId: rollbackSnapshot?.historyId || null,
        changedLines: diff.changedLines,
      });
      return NextResponse.json({
        ok: true,
        action,
        agentId,
        file,
        historyId,
        rollbackSnapshotId: rollbackSnapshot?.historyId || null,
        diff,
        history: listMarkdownHistory(agentId, file),
        scan: buildScanPayload(descriptors, built.detectedMainId, built.source),
      });
    }

    if (action === "rollback") {
      const rollbackId = String(body?.rollbackId || "");
      if (!rollbackId) return NextResponse.json({ ok: false, error: "缺少 rollbackId" }, { status: 400 });
      const result = rollbackScaffold(rollbackId);
      return NextResponse.json({
        ok: true,
        action,
        rollbackId,
        removedCount: result.removed.length,
        removedFiles: result.removed,
        scan: buildScanPayload(descriptors, built.detectedMainId, built.source),
      });
    }

    return NextResponse.json({ ok: false, error: "未知 action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}
