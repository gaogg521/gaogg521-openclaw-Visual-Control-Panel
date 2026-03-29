"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

const CARD =
  "rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a1a23]/95 to-[#121218]/98 p-6";

type MarkdownRoot = "workspace" | "legacy";

type Inv = {
  sqliteFiles: { name: string; mtimeMs: number; size: number }[];
  markdownWorkspace: { root: MarkdownRoot; relativePath: string; kind: string; mtimeMs: number }[];
  markdownLegacy: { root: MarkdownRoot; relativePath: string; kind: string; mtimeMs: number }[];
  dirs: { memorySqlite: string; workspaceAgents: string; agents: string };
};

function formatTime(ms: number) {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "—";
  }
}

function mdKey(root: MarkdownRoot, path: string) {
  return `${root}\t${path}`;
}

function parseMdKey(key: string): { root: MarkdownRoot; path: string } | null {
  const i = key.indexOf("\t");
  if (i < 1) return null;
  const root = key.slice(0, i) as MarkdownRoot;
  const path = key.slice(i + 1);
  if (root !== "workspace" && root !== "legacy") return null;
  if (!path) return null;
  return { root, path };
}

function MemoryEditor() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"sqlite" | "markdown">("markdown");
  const [inv, setInv] = useState<Inv | null>(null);
  const [invError, setInvError] = useState<string | null>(null);
  const [invLoading, setInvLoading] = useState(true);

  const [sqliteFile, setSqliteFile] = useState("");
  const [sqliteData, setSqliteData] = useState<{
    mtimeMs: number;
    table: string | null;
    rows: Record<string, unknown>[];
    error?: string;
  } | null>(null);
  const [sqliteLoading, setSqliteLoading] = useState(false);

  const [mdKeySel, setMdKeySel] = useState("");
  const [mdContent, setMdContent] = useState("");
  const [mdExists, setMdExists] = useState(false);
  const [mdMtime, setMdMtime] = useState<number | null>(null);
  const [mdLoading, setMdLoading] = useState(false);
  const [mdSaving, setMdSaving] = useState(false);

  const loadInv = useCallback(() => {
    setInvLoading(true);
    setInvError(null);
    fetch("/api/memory/inventory", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setInvError(d.error);
        else setInv(d as Inv);
      })
      .catch((e) => setInvError(e instanceof Error ? e.message : "err"))
      .finally(() => setInvLoading(false));
  }, []);

  useEffect(() => {
    loadInv();
  }, [loadInv]);

  useEffect(() => {
    const root = searchParams.get("root")?.trim();
    const p = searchParams.get("path")?.trim();
    if ((root === "workspace" || root === "legacy") && p) {
      setTab("markdown");
      setMdKeySel(mdKey(root, p));
    }
    const tabQ = searchParams.get("tab")?.trim();
    if (tabQ === "sqlite") setTab("sqlite");
  }, [searchParams]);

  const mdOptions = useMemo(() => {
    if (!inv) return [];
    return [...inv.markdownWorkspace, ...inv.markdownLegacy];
  }, [inv]);

  const loadSqlite = useCallback(async () => {
    if (!sqliteFile) return;
    setSqliteLoading(true);
    try {
      const r = await fetch(`/api/memory/sqlite?file=${encodeURIComponent(sqliteFile)}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "sqlite");
      setSqliteData({
        mtimeMs: d.mtimeMs,
        table: d.table ?? null,
        rows: Array.isArray(d.rows) ? d.rows : [],
        error: d.error,
      });
    } catch (e) {
      setSqliteData({
        mtimeMs: 0,
        table: null,
        rows: [],
        error: e instanceof Error ? e.message : "err",
      });
    } finally {
      setSqliteLoading(false);
    }
  }, [sqliteFile]);

  useEffect(() => {
    if (tab === "sqlite" && sqliteFile) void loadSqlite();
  }, [tab, sqliteFile, loadSqlite]);

  const loadMarkdown = useCallback(async () => {
    const parsed = parseMdKey(mdKeySel);
    if (!parsed) return;
    setMdLoading(true);
    try {
      const r = await fetch(
        `/api/memory/markdown?root=${encodeURIComponent(parsed.root)}&path=${encodeURIComponent(parsed.path)}`,
        { cache: "no-store" },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "md");
      setMdContent(typeof d.content === "string" ? d.content : "");
      setMdExists(d.exists === true);
      setMdMtime(typeof d.mtimeMs === "number" ? d.mtimeMs : null);
    } catch {
      setMdContent("");
      setMdExists(false);
      setMdMtime(null);
    } finally {
      setMdLoading(false);
    }
  }, [mdKeySel]);

  useEffect(() => {
    if (tab === "markdown" && mdKeySel) void loadMarkdown();
  }, [tab, mdKeySel, loadMarkdown]);

  const saveMarkdown = async () => {
    const parsed = parseMdKey(mdKeySel);
    if (!parsed) return;
    setMdSaving(true);
    try {
      const r = await fetch("/api/memory/markdown", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root: parsed.root, path: parsed.path, content: mdContent }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "save");
      setMdExists(true);
      void loadInv();
      void loadMarkdown();
    } catch {
      /* ignore */
    } finally {
      setMdSaving(false);
    }
  };

  const rowKeys = useMemo(() => {
    const rows = sqliteData?.rows || [];
    if (!rows.length) return [] as string[];
    return Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  }, [sqliteData]);

  if (invLoading && !inv) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-[var(--text-muted)]">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 text-[var(--text)] max-w-6xl mx-auto">
      <h1 className="text-xl font-semibold mb-1">{t("memory.title")}</h1>
      <p className="text-xs text-[var(--text-muted)] mb-4 max-w-3xl">{t("memory.subtitleDual")}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab("markdown")}
          className={`px-3 py-1.5 rounded-lg text-sm ${
            tab === "markdown" ? "bg-[var(--accent)] text-white" : "border border-white/15 text-[var(--text-muted)]"
          }`}
        >
          {t("memory.tabMarkdown")}
        </button>
        <button
          type="button"
          onClick={() => setTab("sqlite")}
          className={`px-3 py-1.5 rounded-lg text-sm ${
            tab === "sqlite" ? "bg-[var(--accent)] text-white" : "border border-white/15 text-[var(--text-muted)]"
          }`}
        >
          {t("memory.tabSqlite")}
        </button>
        <button
          type="button"
          onClick={() => loadInv()}
          className="px-3 py-1.5 rounded-lg text-sm border border-white/15 text-[var(--text-muted)] hover:bg-white/5"
        >
          {t("memory.refreshInventory")}
        </button>
      </div>

      {inv && (
        <div className="text-[10px] text-[var(--text-muted)] font-mono mb-4 space-y-0.5 break-all">
          <div>
            <span className="text-[var(--text)]/80">{t("memory.pathDim1")}</span> {inv.dirs.memorySqlite}
          </div>
          <div>
            <span className="text-[var(--text)]/80">{t("memory.pathDim2")}</span> {inv.dirs.workspaceAgents}
          </div>
          {inv.markdownLegacy.length > 0 && (
            <div>
              <span className="text-[var(--text)]/80">{t("memory.pathLegacy")}</span> {inv.dirs.agents}
            </div>
          )}
        </div>
      )}

      {invError && <p className="text-red-400 text-sm mb-4">{invError}</p>}

      <div className={CARD}>
        {tab === "markdown" && (
          <>
            <p className="text-xs text-[var(--text-muted)] mb-3">{t("memory.dimMarkdownHint")}</p>
            {mdOptions.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">{t("memory.noMarkdown")}</p>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-3 mb-3">
                  <select
                    value={mdKeySel}
                    onChange={(e) => setMdKeySel(e.target.value)}
                    className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm"
                  >
                    <option value="">{t("memory.pickPlaceholder")}</option>
                    {mdOptions.map((it) => (
                      <option key={mdKey(it.root, it.relativePath)} value={mdKey(it.root, it.relativePath)}>
                        [{it.root === "workspace" ? t("memory.rootWorkspace") : t("memory.rootLegacy")}]{" "}
                        {it.kind === "recap" ? t("memory.kindRecap") : t("memory.kindMemory")} · {it.relativePath}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void loadMarkdown()}
                    disabled={!mdKeySel || mdLoading}
                    className="px-4 py-2 rounded-lg border border-white/15 text-sm"
                  >
                    {t("memory.refresh")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveMarkdown()}
                    disabled={!mdKeySel || mdSaving || mdLoading}
                    className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm disabled:opacity-50"
                  >
                    {mdSaving ? t("common.loading") : t("memory.save")}
                  </button>
                </div>
                {!mdKeySel ? (
                  <p className="text-sm text-[var(--text-muted)]">{t("memory.pickHint")}</p>
                ) : (
                  <>
                    <div className="text-xs text-[var(--text-muted)] mb-2">
                      {mdMtime != null && (
                        <span>
                          {t("memory.mtime")}: {formatTime(mdMtime)}
                        </span>
                      )}
                      {!mdExists && <span className="ml-2">{t("memory.fileNew")}</span>}
                      {mdLoading && <span className="ml-2">{t("common.loading")}</span>}
                    </div>
                    <textarea
                      value={mdContent}
                      onChange={(e) => setMdContent(e.target.value)}
                      disabled={mdLoading}
                      rows={20}
                      className="w-full font-mono text-sm rounded-lg border border-[var(--border)] bg-black/30 p-3 text-[var(--text)] min-h-[280px]"
                      placeholder={t("memory.editorPlaceholder")}
                    />
                  </>
                )}
              </>
            )}
          </>
        )}

        {tab === "sqlite" && (
          <>
            <p className="text-xs text-[var(--text-muted)] mb-3">{t("memory.dimSqliteHint")}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              <select
                value={sqliteFile}
                onChange={(e) => setSqliteFile(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm"
              >
                <option value="">{t("memory.pickSqlite")}</option>
                {(inv?.sqliteFiles || []).map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name} · {formatTime(f.mtimeMs)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void loadSqlite()}
                disabled={!sqliteFile || sqliteLoading}
                className="px-4 py-2 rounded-lg border border-white/15 text-sm"
              >
                {t("memory.refresh")}
              </button>
            </div>
            {!sqliteFile ? (
              <p className="text-sm text-[var(--text-muted)]">{t("memory.noSqliteFiles")}</p>
            ) : sqliteLoading ? (
              <p className="text-sm text-[var(--text-muted)]">{t("common.loading")}</p>
            ) : sqliteData ? (
              <>
                <div className="text-xs text-[var(--text-muted)] mb-2 space-x-3">
                  <span>
                    {t("memory.mtime")}: {formatTime(sqliteData.mtimeMs)}
                  </span>
                  {sqliteData.table && (
                    <span>
                      {t("memory.sqliteTable")}: <code className="text-[var(--accent)]">{sqliteData.table}</code>
                    </span>
                  )}
                  {sqliteData.error && <span className="text-amber-400">{sqliteData.error}</span>}
                </div>
                {sqliteData.rows.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">{t("memory.sqliteEmptyRows")}</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-white/10 max-h-[480px] overflow-y-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead className="sticky top-0 bg-[var(--card)] border-b border-white/10">
                        <tr>
                          {rowKeys.map((k) => (
                            <th key={k} className="text-left p-2 font-medium text-[var(--text-muted)] whitespace-nowrap">
                              {k}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sqliteData.rows.map((row, ri) => (
                          <tr key={ri} className="border-b border-white/5 align-top">
                            {rowKeys.map((k) => (
                              <td key={k} className="p-2 max-w-[240px] break-words font-mono">
                                {formatCell(row[k])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}
          </>
        )}
      </div>

      <p className="mt-4 text-xs text-[var(--text-muted)]">
        <Link href="/expert-squad" className="text-[var(--accent)] hover:underline">
          {t("common.backHome")}
        </Link>
      </p>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function MemoryPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="p-6 text-[var(--text-muted)]">{t("common.loading")}</div>}>
      <MemoryEditor />
    </Suspense>
  );
}
