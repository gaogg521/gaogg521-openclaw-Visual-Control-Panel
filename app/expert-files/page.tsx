"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type AgentScan = {
  id: string;
  name?: string;
  role: "main" | "sub";
  source?: "config" | "fallback";
  required: {
    file: string;
    exists: boolean;
    path: string;
    source: "primary" | "workspace-fallback" | "missing";
    primaryPath: string;
    workspacePath: string;
  }[];
  missing: string[];
  compliance: number;
};

type ScanResp = {
  ok: boolean;
  generatedAt: number;
  home: string;
  agentsRoot: string;
  roots?: {
    primary: string;
    workspaceFallback: string;
  };
  detected?: {
    source: "config" | "fallback";
    mainAgentId: string | null;
    count: number;
  };
  overall: {
    agents: number;
    totalRequired: number;
    totalMissing: number;
    compliance: number;
  };
  agents: AgentScan[];
  rollbackPoints?: {
    rollbackId: string;
    createdAt: number;
    action: "scaffold-missing";
    agents: string[];
    createdFiles: string[];
  }[];
  template?: {
    version: string;
    files: string[];
  };
};

type ScaffoldPlan = {
  templateVersion: string;
  targetAgentId: string | null;
  targets: string[];
  totalFiles: number;
  planToken: string;
  items: {
    agentId: string;
    role: "main" | "sub";
    file: string;
    path: string;
    preview: string;
  }[];
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

export default function ExpertFilesPage() {
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [data, setData] = useState<ScanResp | null>(null);
  const [error, setError] = useState("");
  const [pendingPlan, setPendingPlan] = useState<ScaffoldPlan | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorErr, setEditorErr] = useState("");
  const [editorMeta, setEditorMeta] = useState<{
    agentId: string;
    file: string;
    source: "primary" | "workspace-fallback";
    path: string;
  } | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorPreview, setEditorPreview] = useState<{
    changedLines: number;
    beforeLines: number;
    afterLines: number;
    samples: { line: number; before: string; after: string }[];
  } | null>(null);
  const [editorPreviewing, setEditorPreviewing] = useState(false);
  const [editorHistory, setEditorHistory] = useState<MarkdownHistoryEntry[]>([]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/expert-files", { cache: "no-store" });
      const json = (await r.json()) as ScanResp;
      if (!r.ok || !json.ok) {
        setError((json as any)?.error || "扫描失败");
        return;
      }
      setData(json);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const planScaffoldMissing = async (agentId?: string) => {
    setActing(true);
    setActionMsg("");
    try {
      const r = await fetch("/api/expert-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "plan-scaffold", ...(agentId ? { agentId } : {}) }),
      });
      const json = await r.json();
      if (!r.ok || !json?.ok) {
        setActionMsg(`预览失败：${json?.error || "未知错误"}`);
        return;
      }
      setPendingPlan(json.plan as ScaffoldPlan);
    } catch (err: any) {
      setActionMsg(`预览失败：${err?.message || String(err)}`);
    } finally {
      setActing(false);
    }
  };

  const confirmScaffoldMissing = async () => {
    if (!pendingPlan) return;
    setActing(true);
    setActionMsg("");
    try {
      const r = await fetch("/api/expert-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "scaffold-missing",
          ...(pendingPlan.targetAgentId ? { agentId: pendingPlan.targetAgentId } : {}),
          planToken: pendingPlan.planToken,
        }),
      });
      const json = await r.json();
      if (!r.ok || !json?.ok) {
        setActionMsg(`补齐失败：${json?.error || "未知错误"}`);
        return;
      }
      setData(json.scan as ScanResp);
      setActionMsg(
        `补齐完成：新增 ${json.createdCount} 个文件${
          json.rollbackId ? `，回滚点 ${json.rollbackId} 已创建` : "（无新增，未创建回滚点）"
        }`
      );
      setPendingPlan(null);
    } catch (err: any) {
      setActionMsg(`补齐失败：${err?.message || String(err)}`);
    } finally {
      setActing(false);
    }
  };

  const rollback = async (rollbackId: string) => {
    setActing(true);
    setActionMsg("");
    try {
      const r = await fetch("/api/expert-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rollback", rollbackId }),
      });
      const json = await r.json();
      if (!r.ok || !json?.ok) {
        setActionMsg(`回滚失败：${json?.error || "未知错误"}`);
        return;
      }
      setData(json.scan as ScanResp);
      setActionMsg(`回滚完成：移除 ${json.removedCount} 个文件（${rollbackId}）`);
    } catch (err: any) {
      setActionMsg(`回滚失败：${err?.message || String(err)}`);
    } finally {
      setActing(false);
    }
  };

  const openEditor = async (agentId: string, file: string) => {
    setEditorErr("");
    try {
      const r = await fetch("/api/expert-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read-md", agentId, file }),
      });
      const json = await r.json();
      if (!r.ok || !json?.ok) {
        setEditorErr(json?.error || "读取失败");
        return;
      }
      setEditorMeta({
        agentId,
        file,
        source: json.source as "primary" | "workspace-fallback",
        path: json.path as string,
      });
      setEditorContent(String(json.content || ""));
      setEditorHistory(Array.isArray(json.history) ? (json.history as MarkdownHistoryEntry[]) : []);
      setEditorPreview(null);
      setEditorOpen(true);
    } catch (err: any) {
      setEditorErr(err?.message || String(err));
    }
  };

  const saveEditor = async () => {
    if (!editorMeta) return;
    setEditorSaving(true);
    setEditorErr("");
    try {
      const r = await fetch("/api/expert-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-md",
          agentId: editorMeta.agentId,
          file: editorMeta.file,
          content: editorContent,
        }),
      });
      const json = await r.json();
      if (!r.ok || !json?.ok) {
        setEditorErr(json?.error || "保存失败");
        return;
      }
      setData(json.scan as ScanResp);
      setEditorHistory(Array.isArray(json.history) ? (json.history as MarkdownHistoryEntry[]) : []);
      setEditorOpen(false);
      setActionMsg(`已保存 ${editorMeta.agentId}/${editorMeta.file}`);
    } catch (err: any) {
      setEditorErr(err?.message || String(err));
    } finally {
      setEditorSaving(false);
    }
  };

  const previewSaveEditor = async () => {
    if (!editorMeta) return;
    setEditorPreviewing(true);
    setEditorErr("");
    try {
      const r = await fetch("/api/expert-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview-save-md",
          agentId: editorMeta.agentId,
          file: editorMeta.file,
          content: editorContent,
        }),
      });
      const json = await r.json();
      if (!r.ok || !json?.ok) {
        setEditorErr(json?.error || "预览失败");
        return;
      }
      setEditorPreview(json.preview || null);
    } catch (err: any) {
      setEditorErr(err?.message || String(err));
    } finally {
      setEditorPreviewing(false);
    }
  };

  const rollbackEditorHistory = async (historyId: string) => {
    if (!editorMeta) return;
    setEditorSaving(true);
    setEditorErr("");
    try {
      const r = await fetch("/api/expert-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rollback-md",
          agentId: editorMeta.agentId,
          file: editorMeta.file,
          historyId,
        }),
      });
      const json = await r.json();
      if (!r.ok || !json?.ok) {
        setEditorErr(json?.error || "回滚失败");
        return;
      }
      setData(json.scan as ScanResp);
      setEditorHistory(Array.isArray(json.history) ? (json.history as MarkdownHistoryEntry[]) : []);
      await openEditor(editorMeta.agentId, editorMeta.file);
      setActionMsg(`已回滚 ${editorMeta.agentId}/${editorMeta.file} 到历史版本 ${historyId}`);
    } catch (err: any) {
      setEditorErr(err?.message || String(err));
    } finally {
      setEditorSaving(false);
    }
  };

  const sortedAgents = useMemo(() => {
    if (!data) return [];
    return [...data.agents].sort((a, b) => {
      if (a.role === "main" && b.role !== "main") return -1;
      if (a.role !== "main" && b.role === "main") return 1;
      if (a.missing.length !== b.missing.length) return b.missing.length - a.missing.length;
      return a.id.localeCompare(b.id);
    });
  }, [data]);
  const mainAgent = useMemo(() => sortedAgents.find((x) => x.role === "main") || null, [sortedAgents]);
  const subAgents = useMemo(() => sortedAgents.filter((x) => x.role !== "main"), [sortedAgents]);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">专家文件管理</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            巡检 / 补齐 / 编辑 / 历史回滚（主目录优先，workspace 兜底）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            className="px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm hover:border-[var(--accent)]"
            disabled={acting}
          >
            刷新扫描
          </button>
          <button
            onClick={() => void planScaffoldMissing()}
            className="px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm hover:border-[var(--accent)] disabled:opacity-60"
            disabled={acting}
            title="补齐原理：先读取 openclaw.json 的 agents.list 识别真实 Agent（主AGENT/子AGENT），并结合 IDENTITY.md/AGENTS.md 生成内容模板；仅补缺失，不覆盖现有文件。路径策略为主目录优先，workspace 兜底。"
          >
            一键补齐全部缺失
          </button>
          <Link
            href="/oneone-dashboard"
            className="px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm hover:border-[var(--accent)]"
          >
            返回仪表盘
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)]">
          正在扫描专家文件...
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300">{error}</div>
      ) : data ? (
        <>
          {actionMsg ? (
            <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] mb-4 text-sm">
              {actionMsg}
            </div>
          ) : null}
          {data?.template?.version ? (
            <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] mb-4 text-xs text-[var(--text-muted)]">
              模板版本：{data.template.version}
            </div>
          ) : null}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]">
              <div className="text-xs text-[var(--text-muted)]">Agent 数</div>
              <div className="text-xl font-semibold">{data.overall.agents}</div>
            </div>
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]">
              <div className="text-xs text-[var(--text-muted)]">应有文件</div>
              <div className="text-xl font-semibold">{data.overall.totalRequired}</div>
            </div>
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]">
              <div className="text-xs text-[var(--text-muted)]">缺失文件</div>
              <div className="text-xl font-semibold text-amber-300">{data.overall.totalMissing}</div>
            </div>
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]">
              <div className="text-xs text-[var(--text-muted)]">合规率</div>
              <div className="text-xl font-semibold text-green-300">{data.overall.compliance}%</div>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] mb-6 text-xs text-[var(--text-muted)]">
            <div>主目录（优先）：{data.roots?.primary || data.agentsRoot}</div>
            <div className="mt-1">兜底目录（fallback）：{data.roots?.workspaceFallback || "-"}</div>
            <div className="mt-1">
              Agent 判定来源：{data.detected?.source === "config" ? "openclaw.json" : "目录回退"} ·
              主AGENT：{data.detected?.mainAgentId || "未识别"}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] mb-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-base font-semibold">回滚点（最近 20 条）</h3>
              <span className="text-xs text-[var(--text-muted)]">补齐后可一键撤销</span>
            </div>
            {!data.rollbackPoints || data.rollbackPoints.length === 0 ? (
              <div className="text-sm text-[var(--text-muted)]">暂无回滚点</div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-auto pr-1">
                {data.rollbackPoints.map((p) => (
                  <div
                    key={p.rollbackId}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)]"
                  >
                    <div className="text-xs text-[var(--text-muted)]">
                      <span className="text-[var(--text)]">{p.rollbackId}</span> ·
                      {new Date(p.createdAt).toLocaleString("zh-CN")} · 新增 {p.createdFiles.length} 文件
                    </div>
                    <button
                      onClick={() => void rollback(p.rollbackId)}
                      className="px-2.5 py-1.5 rounded border border-[var(--border)] text-xs hover:border-[var(--accent)] disabled:opacity-60"
                      disabled={acting}
                    >
                      回滚
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {mainAgent ? (
            <section className="p-4 rounded-xl border border-[var(--accent)]/40 bg-[var(--card)] mb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-[var(--accent)]">总指挥专区（主AGENT）</div>
                <span className="text-[11px] px-2 py-0.5 rounded border border-[var(--accent)]/50 text-[var(--accent)]">
                  固定置顶
                </span>
              </div>
              <section className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h2 className="text-lg font-semibold">
                    {mainAgent.id}
                    {mainAgent.name ? <span className="ml-2 text-sm text-[var(--text-muted)]">{mainAgent.name}</span> : null}
                    <span className="ml-2 text-xs px-2 py-0.5 rounded border border-[var(--accent)]/60 text-[var(--accent)]">
                      主专家
                    </span>
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--text-muted)]">合规率 {mainAgent.compliance}%</span>
                    {mainAgent.missing.length > 0 ? (
                      <button
                        onClick={() => void planScaffoldMissing(mainAgent.id)}
                        className="px-2.5 py-1.5 rounded border border-[var(--border)] text-xs hover:border-[var(--accent)] disabled:opacity-60"
                        disabled={acting}
                      >
                        仅补齐该 Agent
                      </button>
                    ) : null}
                  </div>
                </div>
                {mainAgent.missing.length > 0 ? (
                  <div className="mb-3 text-sm text-amber-300">
                    缺失：{mainAgent.missing.join(", ")}
                  </div>
                ) : (
                  <div className="mb-3 text-sm text-green-300">文件完整</div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {mainAgent.required.map((row) => (
                    <div
                      key={`${mainAgent.id}_${row.file}`}
                      className={`px-3 py-2 rounded border text-sm ${
                        row.exists
                          ? "border-green-500/30 bg-green-500/10 text-green-200"
                          : "border-red-500/30 bg-red-500/10 text-red-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          {row.exists ? "✓" : "✗"} {row.file}
                          {row.exists ? (
                            <span className="ml-2 text-[10px] text-[var(--text-muted)]">
                              {row.source === "primary" ? "主目录" : "workspace 兜底"}
                            </span>
                          ) : null}
                        </span>
                        {row.exists ? (
                          <button
                            onClick={() => void openEditor(mainAgent.id, row.file)}
                            className="px-2 py-1 rounded border border-[var(--border)] text-[11px] hover:border-[var(--accent)]"
                            disabled={acting}
                          >
                            编辑
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </section>
          ) : null}

          <div className="space-y-4">
            {subAgents.map((agent) => (
              <section key={agent.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h2 className="text-lg font-semibold">
                    {agent.id}
                    {agent.name ? <span className="ml-2 text-sm text-[var(--text-muted)]">{agent.name}</span> : null}
                    <span className="ml-2 text-xs px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)]">
                      {agent.role === "main" ? "主专家" : "子专家"}
                    </span>
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--text-muted)]">合规率 {agent.compliance}%</span>
                    {agent.missing.length > 0 ? (
                      <button
                        onClick={() => void planScaffoldMissing(agent.id)}
                        className="px-2.5 py-1.5 rounded border border-[var(--border)] text-xs hover:border-[var(--accent)] disabled:opacity-60"
                        disabled={acting}
                      >
                        仅补齐该 Agent
                      </button>
                    ) : null}
                  </div>
                </div>
                {agent.missing.length > 0 ? (
                  <div className="mb-3 text-sm text-amber-300">
                    缺失：{agent.missing.join(", ")}
                  </div>
                ) : (
                  <div className="mb-3 text-sm text-green-300">文件完整</div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {agent.required.map((row) => (
                    <div
                      key={`${agent.id}_${row.file}`}
                      className={`px-3 py-2 rounded border text-sm ${
                        row.exists
                          ? "border-green-500/30 bg-green-500/10 text-green-200"
                          : "border-red-500/30 bg-red-500/10 text-red-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          {row.exists ? "✓" : "✗"} {row.file}
                          {row.exists ? (
                            <span className="ml-2 text-[10px] text-[var(--text-muted)]">
                              {row.source === "primary" ? "主目录" : "workspace 兜底"}
                            </span>
                          ) : null}
                        </span>
                        {row.exists ? (
                          <button
                            onClick={() => void openEditor(agent.id, row.file)}
                            className="px-2 py-1 rounded border border-[var(--border)] text-[11px] hover:border-[var(--accent)]"
                            disabled={acting}
                          >
                            编辑
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : null}
      {editorOpen && editorMeta ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-lg font-semibold">
                  编辑：{editorMeta.agentId}/{editorMeta.file}
                </h3>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  来源：{editorMeta.source === "primary" ? "主目录" : "workspace 兜底"} · {editorMeta.path}
                </div>
              </div>
              <button
                onClick={() => setEditorOpen(false)}
                className="px-2.5 py-1.5 rounded border border-[var(--border)] text-xs hover:border-[var(--accent)]"
                disabled={editorSaving}
              >
                关闭
              </button>
            </div>
            <textarea
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              className="w-full min-h-[360px] p-3 rounded border border-[var(--border)] bg-[var(--bg)] text-sm font-mono"
            />
            <div className="mt-3 p-3 rounded border border-[var(--border)] bg-[var(--bg)]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-sm font-medium">保存前差异预览</div>
                <button
                  onClick={() => void previewSaveEditor()}
                  className="px-2.5 py-1.5 rounded border border-[var(--border)] text-xs hover:border-[var(--accent)] disabled:opacity-60"
                  disabled={editorPreviewing || editorSaving}
                >
                  {editorPreviewing ? "预览中..." : "刷新预览"}
                </button>
              </div>
              {editorPreview ? (
                <div className="space-y-2">
                  <div className="text-xs text-[var(--text-muted)]">
                    变更行数：{editorPreview.changedLines} · 原始行数：{editorPreview.beforeLines} · 新行数：
                    {editorPreview.afterLines}
                  </div>
                  <div className="max-h-40 overflow-auto space-y-1 pr-1">
                    {editorPreview.samples.length === 0 ? (
                      <div className="text-xs text-[var(--text-muted)]">当前无差异</div>
                    ) : (
                      editorPreview.samples.map((s) => (
                        <div key={`sample_${s.line}_${s.before}_${s.after}`} className="text-xs border border-[var(--border)] rounded p-2">
                          <div className="text-[var(--text-muted)]">L{s.line}</div>
                          <div className="text-red-300">- {s.before || " "}</div>
                          <div className="text-green-300">+ {s.after || " "}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[var(--text-muted)]">点击“刷新预览”查看保存影响。</div>
              )}
            </div>
            <div className="mt-3 p-3 rounded border border-[var(--border)] bg-[var(--bg)]">
              <div className="text-sm font-medium mb-2">历史版本（最近 30 条）</div>
              {editorHistory.length === 0 ? (
                <div className="text-xs text-[var(--text-muted)]">暂无历史版本（首次编辑后自动产生）。</div>
              ) : (
                <div className="max-h-44 overflow-auto space-y-1 pr-1">
                  {editorHistory.map((h) => (
                    <div
                      key={h.historyId}
                      className="flex items-center justify-between gap-2 border border-[var(--border)] rounded px-2 py-1.5"
                    >
                      <div className="text-xs text-[var(--text-muted)]">
                        {h.historyId} · {new Date(h.createdAt).toLocaleString("zh-CN")} · {h.bytes} bytes
                      </div>
                      <button
                        onClick={() => void rollbackEditorHistory(h.historyId)}
                        className="px-2 py-1 rounded border border-[var(--border)] text-[11px] hover:border-[var(--accent)] disabled:opacity-60"
                        disabled={editorSaving}
                      >
                        回滚到此版本
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {editorErr ? <div className="mt-2 text-sm text-red-300">{editorErr}</div> : null}
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditorOpen(false)}
                className="px-3 py-2 rounded border border-[var(--border)] text-sm hover:border-[var(--accent)]"
                disabled={editorSaving}
              >
                取消
              </button>
              <button
                onClick={() => void previewSaveEditor()}
                className="px-3 py-2 rounded border border-[var(--border)] text-sm hover:border-[var(--accent)] disabled:opacity-60"
                disabled={editorSaving || editorPreviewing}
              >
                {editorPreviewing ? "预览中..." : "先预览再保存"}
              </button>
              <button
                onClick={() => void saveEditor()}
                className="px-3 py-2 rounded border border-[var(--border)] text-sm hover:border-[var(--accent)] disabled:opacity-60"
                disabled={editorSaving}
              >
                {editorSaving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingPlan ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-lg font-semibold">补齐预览（Dry Run）</h3>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  目标：{pendingPlan.targetAgentId || "全部 Agent"} · 模板版本：{pendingPlan.templateVersion} ·
                  将创建 {pendingPlan.totalFiles} 个文件
                </div>
              </div>
              <button
                onClick={() => setPendingPlan(null)}
                className="px-2.5 py-1.5 rounded border border-[var(--border)] text-xs hover:border-[var(--accent)]"
                disabled={acting}
              >
                关闭
              </button>
            </div>
            <div className="max-h-[55vh] overflow-auto space-y-2 pr-1">
              {pendingPlan.items.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)]">当前没有需要补齐的文件。</div>
              ) : (
                pendingPlan.items.map((it) => (
                  <div
                    key={`${it.agentId}_${it.file}`}
                    className="rounded border border-[var(--border)] bg-[var(--bg)] p-3"
                  >
                    <div className="text-sm font-medium">
                      {it.agentId} / {it.file}
                    </div>
                    <pre className="mt-2 text-xs whitespace-pre-wrap text-[var(--text-muted)]">{it.preview}</pre>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingPlan(null)}
                className="px-3 py-2 rounded border border-[var(--border)] text-sm hover:border-[var(--accent)]"
                disabled={acting}
              >
                取消
              </button>
              <button
                onClick={() => void confirmScaffoldMissing()}
                className="px-3 py-2 rounded border border-[var(--border)] text-sm hover:border-[var(--accent)] disabled:opacity-60"
                disabled={acting || pendingPlan.items.length === 0}
              >
                确认执行补齐
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
