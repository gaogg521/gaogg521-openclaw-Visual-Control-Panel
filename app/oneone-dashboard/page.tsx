"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { type Theme, THEME_OPTIONS, useTheme } from "@/lib/theme";
import { GlobalStatsTrend, type AllStats, type TimeRange } from "@/app/components/global-stats-trend";
import { StorageInsights, type StorageMetricsData } from "@/app/components/storage-insights";
import {
  AgentTaskTracking,
  type AgentActivityData,
} from "@/app/components/agent-task-tracking";

type OpenClawStatus = {
  version: string;
  version_date: string;
  gateway_url: string;
  gateway_online: boolean;
  enabled_channels_count: number;
  enabled_channels_sample: string;
  configured_models_count: number;
  configured_models_sample: string;
  config_path: string;
  workspace: string;
  max_concurrency: number;
  sub_max_concurrency: number;
};

const CARD_CLASS =
  "rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a1a23]/95 to-[#121218]/98 p-5";

let cachedDashboardStatus: OpenClawStatus | null = null;
let cachedDashboardAgentActivity: AgentActivityData[] | null = null;
let cachedDashboardAllStats: AllStats | null = null;
let cachedDashboardStorageMetrics: StorageMetricsData | null = null;
let cachedDashboardError: string | null = null;

export default function OneOneDashboardPage() {
  const { t, locale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [status, setStatus] = useState<OpenClawStatus | null>(cachedDashboardStatus);
  const [agentActivity, setAgentActivity] = useState<AgentActivityData[] | null>(cachedDashboardAgentActivity);
  const [allStats, setAllStats] = useState<AllStats | null>(cachedDashboardAllStats);
  const [storageMetrics, setStorageMetrics] = useState<StorageMetricsData | null>(cachedDashboardStorageMetrics);
  const [syncingStorage, setSyncingStorage] = useState(false);
  const [statsRange, setStatsRange] = useState<TimeRange>("daily");
  const [diagnosingClaw, setDiagnosingClaw] = useState(false);
  const [restartingClaw, setRestartingClaw] = useState(false);
  const [checkingClawStatus, setCheckingClawStatus] = useState(false);
  const [shellOpen, setShellOpen] = useState(false);
  const [shellTitle, setShellTitle] = useState("命令输出");
  const [shellLines, setShellLines] = useState<string[]>([]);
  const [shellRunning, setShellRunning] = useState(false);
  const [loading, setLoading] = useState(!cachedDashboardStatus);
  const [error, setError] = useState<string | null>(cachedDashboardError);

  const openShell = useCallback((title: string, initial: string[] = []) => {
    setShellTitle(title);
    setShellLines(initial);
    setShellRunning(true);
    setShellOpen(true);
  }, []);

  const appendShell = useCallback((line: string) => {
    setShellLines((prev) => [...prev, line]);
  }, []);

  const streamShellFromApi = useCallback(
    async (url: string): Promise<number> => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const ct = res.headers.get("content-type") || "";
      if (!res.body || ct.includes("application/json")) {
        const payload = await res.json().catch(() => ({}));
        const out = typeof payload?.stdout === "string" ? payload.stdout : "";
        const err = typeof payload?.stderr === "string" ? payload.stderr : "";
        if (out) appendShell(out);
        if (err) appendShell(`[stderr] ${err}`);
        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.error || `HTTP ${res.status}`);
        }
        return typeof payload?.cliExitCode === "number" ? payload.cliExitCode : 0;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buf = "";
      let exitCode = res.ok ? 0 : 1;
      const flushLines = (chunk: string, final = false) => {
        buf += chunk;
        const lines = buf.split(/\r\n|\n|\r/);
        buf = final ? "" : lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trimEnd();
          if (!trimmed.trim()) continue;
          const mExit = trimmed.match(/^\[exit_code\]\s+(-?\d+)/);
          if (mExit) {
            exitCode = Number(mExit[1]);
            continue;
          }
          appendShell(trimmed);
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        flushLines(decoder.decode(value, { stream: true }), false);
      }
      const last = decoder.decode();
      if (last) flushLines(last, false);
      if (buf.length) {
        const t = buf.trimEnd();
        if (t) {
          const mExit = t.match(/^\[exit_code\]\s+(-?\d+)/);
          if (mExit) exitCode = Number(mExit[1]);
          else appendShell(t);
        }
      }
      if (!res.ok || exitCode !== 0) {
        throw new Error(`exit code ${exitCode}`);
      }
      return exitCode;
    },
    [appendShell],
  );

  const fetchAgentActivity = useCallback(async () => {
    try {
      const r = await fetch("/api/agent-activity", { cache: "no-store" });
      const d = await r.json();
      if (Array.isArray(d.agents) && d.agents.length > 0) {
        setAgentActivity(d.agents);
        cachedDashboardAgentActivity = d.agents;
      }
    } catch {
      /* 保留上次数据 */
    }
  }, []);

  const fetchStatus = useCallback(
    async (silent = false) => {
      if (!silent || !cachedDashboardStatus) setLoading(true);
      setError(null);
      cachedDashboardError = null;
      try {
        const statusReq = fetch("/api/openclaw/status", { cache: "no-store" }).then((r) => r.json());
        const statsReq = fetch("/api/stats-all", { cache: "no-store" }).then((r) => r.json());

        const statusRes = await statusReq;
        if (statusRes.error) throw new Error(statusRes.error || "获取状态失败");
        setStatus(statusRes);
        cachedDashboardStatus = statusRes;

        const statsRes = await statsReq;
        if (!statsRes.error && Array.isArray(statsRes.daily)) {
          setAllStats({
            daily: statsRes.daily,
            weekly: Array.isArray(statsRes.weekly) ? statsRes.weekly : [],
            monthly: Array.isArray(statsRes.monthly) ? statsRes.monthly : [],
          });
          cachedDashboardAllStats = {
            daily: statsRes.daily,
            weekly: Array.isArray(statsRes.weekly) ? statsRes.weekly : [],
            monthly: Array.isArray(statsRes.monthly) ? statsRes.monthly : [],
          };
        } else {
          setAllStats(null);
          cachedDashboardAllStats = null;
        }
      } catch (e: any) {
        const msg = e?.message ?? t("oneone.dashboardFetchFailed");
        setError(msg);
        cachedDashboardError = msg;
        if (!cachedDashboardStatus) setStatus(null);
      } finally {
        setLoading(false);
        void fetchAgentActivity();
      }
    },
    [t, fetchAgentActivity],
  );

  const runClawDiagnose = useCallback(async () => {
    setDiagnosingClaw(true);
    openShell("CLAW诊断", ["$ openclaw doctor --fix", "执行中..."]);
    try {
      await streamShellFromApi("/api/openclaw/doctor");
      appendShell("诊断完成。");
    } catch (e: any) {
      appendShell(`诊断失败: ${e?.message || "未知错误"}`);
    } finally {
      setDiagnosingClaw(false);
      setShellRunning(false);
    }
  }, [appendShell, openShell, streamShellFromApi]);

  const restartOneOneClaw = useCallback(async () => {
    const ok = window.confirm("确认重启 OneOneClaw 吗？");
    if (!ok) return;
    setRestartingClaw(true);
    openShell("重启 OneOneClaw", ["$ openclaw gateway restart"]);
    try {
      await streamShellFromApi("/api/openclaw/restart");
      appendShell("重启流程结束，若网关刚起来可稍等几秒再试。");
      void fetchStatus(true);
    } catch (e: any) {
      appendShell(`重启失败: ${e?.message || "未知错误"}`);
    } finally {
      setRestartingClaw(false);
      setShellRunning(false);
    }
  }, [appendShell, openShell, streamShellFromApi, fetchStatus]);

  const viewClawStatus = useCallback(async () => {
    setCheckingClawStatus(true);
    openShell("查看 CLAW 状态", ["$ openclaw gateway status", "执行中..."]);
    try {
      await streamShellFromApi("/api/openclaw/gateway-status");
      appendShell("状态查询完成。");
    } catch (e: any) {
      appendShell(`状态查询失败: ${e?.message || "未知错误"}`);
    } finally {
      setCheckingClawStatus(false);
      setShellRunning(false);
    }
  }, [appendShell, openShell, streamShellFromApi]);

  const fetchStorageMetrics = async () => {
    try {
      const res = await fetch("/api/storage/metrics", { cache: "no-store" });
      const payload = await res.json();
      if (payload?.ok && payload.metrics) {
        setStorageMetrics(payload.metrics);
        cachedDashboardStorageMetrics = payload.metrics;
      }
    } catch {
      // keep silent, dashboard should remain usable without metrics
    }
  };

  const syncStorageNow = async () => {
    setSyncingStorage(true);
    try {
      const res = await fetch("/api/storage/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await res.json();
      if (!payload?.ok) throw new Error(payload?.error || "数据库同步失败");
      await fetchStorageMetrics();
    } catch (e: any) {
      setError(e?.message || "数据库同步失败");
    } finally {
      setSyncingStorage(false);
    }
  };

  useEffect(() => {
    void fetchStatus(true);
    void fetchStorageMetrics();
  }, [fetchStatus]);

  useEffect(() => {
    let cancelled = false;
    let sleepTimer: ReturnType<typeof setTimeout> | null = null;
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        sleepTimer = setTimeout(() => {
          sleepTimer = null;
          resolve();
        }, ms);
      });
    (async () => {
      while (!cancelled) {
        await fetchAgentActivity();
        if (cancelled) break;
        await sleep(30000);
      }
    })();
    return () => {
      cancelled = true;
      if (sleepTimer) clearTimeout(sleepTimer);
    };
  }, [fetchAgentActivity]);

  if (loading && !status) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <p className="text-[var(--text-muted)]">{t("common.loading")}</p>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="p-4 max-w-xl mx-auto">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={() => void fetchStatus()}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm"
        >
          {t("common.retry")}
        </button>
      </div>
    );
  }

  const s = status!;

  return (
    <div className="p-4 md:p-6 text-[var(--text)]">
      <div className="flex flex-col gap-2 mb-6 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-semibold text-[var(--text)]">
          {t("oneone.dashboardTitle")}
        </h1>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
            className="shrink-0 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--text)] text-sm font-medium hover:border-[var(--accent)] transition cursor-pointer"
            title="切换皮肤"
          >
            {THEME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                🎨 {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={runClawDiagnose}
            disabled={diagnosingClaw}
            className="shrink-0 px-4 py-2 rounded-lg bg-[var(--accent)] border border-[var(--accent)] text-[var(--bg)] text-sm font-medium hover:brightness-110 transition disabled:opacity-50 cursor-pointer"
          >
            {diagnosingClaw ? "诊断中..." : "CLAW诊断"}
          </button>
          <button
            onClick={restartOneOneClaw}
            disabled={restartingClaw}
            className="shrink-0 px-4 py-2 rounded-lg bg-[var(--accent)] border border-[var(--accent)] text-[var(--bg)] text-sm font-medium hover:brightness-110 transition disabled:opacity-50 cursor-pointer"
          >
            {restartingClaw ? "重启中..." : "重启 OneOneClaw"}
          </button>
          <button
            onClick={viewClawStatus}
            disabled={checkingClawStatus}
            className="shrink-0 px-4 py-2 rounded-lg bg-[var(--accent)] border border-[var(--accent)] text-[var(--bg)] text-sm font-medium hover:brightness-110 transition disabled:opacity-50 cursor-pointer"
          >
            {checkingClawStatus ? "查询中..." : "查看CLAW状态"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className={CARD_CLASS}>
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center text-xl shrink-0">
              🔧
            </span>
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-muted)]">
                {t("oneone.dashboardVersion")}
              </p>
              <p className="text-lg font-bold text-[var(--text)] mt-1">
                {s.version ?? "—"}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {s.version_date ?? ""}
              </p>
            </div>
          </div>
        </div>

        <div className={CARD_CLASS}>
          <div className="flex items-start gap-3">
            <span
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                s.gateway_online
                  ? "bg-green-500/20 border border-green-500"
                  : "bg-red-500/20 border border-red-500"
              }`}
            >
              {s.gateway_online ? "✓" : "○"}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-muted)]">
                {t("oneone.dashboardGatewayStatus")}
              </p>
              <p className="text-lg font-bold text-[var(--text)] mt-1">
                {s.gateway_online
                  ? t("oneone.dashboardOnline")
                  : t("oneone.dashboardOffline")}
              </p>
              <p className="text-xs text-[var(--text-muted)] truncate">
                {s.gateway_url ?? "—"}
              </p>
            </div>
          </div>
        </div>

        <div className={CARD_CLASS}>
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 rounded-xl bg-blue-500/20 flex items-center justify-center text-xl shrink-0">
              💬
            </span>
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-muted)]">
                {t("oneone.dashboardChannelsEnabled")}
              </p>
              <p className="text-lg font-bold text-[var(--text)] mt-1">
                {s.enabled_channels_count ?? 0}
              </p>
              <p className="text-xs text-[var(--text-muted)] truncate">
                {s.enabled_channels_sample || "—"}
              </p>
            </div>
          </div>
        </div>

        <div className={CARD_CLASS}>
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 rounded-xl bg-purple-500/20 flex items-center justify-center text-xl shrink-0">
              🧠
            </span>
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-muted)]">
                {t("oneone.dashboardModelsConfigured")}
              </p>
              <p className="text-lg font-bold text-[var(--text)] mt-1">
                {s.configured_models_count ?? 0}
              </p>
              <p className="text-xs text-[var(--text-muted)] truncate">
                {s.configured_models_sample || "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className={`${CARD_CLASS} mt-6`}>
        <h2 className="text-base font-semibold text-[var(--text)] mb-4">
          {t("oneone.dashboardSystemInfo")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[var(--text-muted)] mb-1">
              {t("oneone.dashboardConfigPath")}
            </p>
            <p className="text-[var(--text)] font-mono text-xs break-all">
              {s.config_path ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[var(--text-muted)] mb-1">
              {t("oneone.dashboardGatewayPort")}
            </p>
            <p className="text-[var(--text)]">
              {s.gateway_url
                ? s.gateway_url.replace(/^ws:\/\/[^:]+:/, "")
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-[var(--text-muted)] mb-1">
              {t("oneone.dashboardWorkspace")}
            </p>
            <p className="text-[var(--text)] font-mono text-xs break-all">
              {s.workspace ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[var(--text-muted)] mb-1">
              {t("oneone.dashboardMaxConcurrency")}
            </p>
            <p className="text-[var(--text)]">{s.max_concurrency ?? "—"}</p>
          </div>
          <div>
            <p className="text-[var(--text-muted)] mb-1">
              {t("oneone.dashboardSubMaxConcurrency")}
            </p>
            <p className="text-[var(--text)]">{s.sub_max_concurrency ?? "—"}</p>
          </div>
        </div>
      </div>

      {allStats && (
        <GlobalStatsTrend
          allStats={allStats}
          statsRange={statsRange}
          setStatsRange={setStatsRange}
        />
      )}

      <StorageInsights
        metrics={storageMetrics}
        syncing={syncingStorage}
        onSync={syncStorageNow}
      />

      <AgentTaskTracking
        agentActivity={agentActivity}
        t={t}
        locale={locale}
        className={`${CARD_CLASS} mt-6 mb-24 md:mb-28`}
      />

      <button
        type="button"
        onClick={() => void fetchStatus()}
        disabled={loading}
        className="fixed right-6 bottom-6 w-14 h-14 rounded-full bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white flex items-center justify-center text-xl shadow-lg hover:opacity-90 disabled:opacity-50"
        title={t("oneone.dashboardRefreshStatus")}
      >
        {loading ? "⟳" : "↻"}
      </button>

      {shellOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
              <div className="text-sm font-semibold">{shellTitle}</div>
              <button
                type="button"
                onClick={() => setShellOpen(false)}
                className="px-2 py-1 text-xs rounded border border-[var(--border)] hover:border-[var(--accent)]"
              >
                关闭
              </button>
            </div>
            <div className="px-4 py-3 bg-[#0b1220] text-green-300 font-mono text-xs max-h-[55vh] overflow-auto whitespace-pre-wrap">
              {shellLines.length === 0 ? "等待输出..." : shellLines.join("\n")}
              {shellRunning ? "\n\n..." : "\n\n[done]"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
