"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
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

export default function OneOneDashboardPage() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<OpenClawStatus | null>(null);
  const [agentActivity, setAgentActivity] = useState<AgentActivityData[] | null>(null);
  const [allStats, setAllStats] = useState<AllStats | null>(null);
  const [storageMetrics, setStorageMetrics] = useState<StorageMetricsData | null>(null);
  const [syncingStorage, setSyncingStorage] = useState(false);
  const [statsRange, setStatsRange] = useState<TimeRange>("daily");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgentActivity = useCallback(async () => {
    try {
      const r = await fetch("/api/agent-activity", { cache: "no-store" });
      const d = await r.json();
      if (Array.isArray(d.agents) && d.agents.length > 0) setAgentActivity(d.agents);
    } catch {
      /* 保留上次数据 */
    }
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, statsRes] = await Promise.all([
        fetch("/api/openclaw/status", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/stats-all", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (statusRes.error) throw new Error(statusRes.error || "获取状态失败");
      setStatus(statusRes);
      if (!statsRes.error && Array.isArray(statsRes.daily)) {
        setAllStats({
          daily: statsRes.daily,
          weekly: Array.isArray(statsRes.weekly) ? statsRes.weekly : [],
          monthly: Array.isArray(statsRes.monthly) ? statsRes.monthly : [],
        });
      } else setAllStats(null);
    } catch (e: any) {
      setError(e?.message ?? t("oneone.dashboardFetchFailed"));
      setStatus(null);
    } finally {
      setLoading(false);
      void fetchAgentActivity();
    }
  };

  const fetchStorageMetrics = async () => {
    try {
      const res = await fetch("/api/storage/metrics", { cache: "no-store" });
      const payload = await res.json();
      if (payload?.ok && payload.metrics) {
        setStorageMetrics(payload.metrics);
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
    fetchStatus();
    fetchStorageMetrics();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => void fetchAgentActivity(), 30000);
    return () => clearInterval(timer);
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
          onClick={fetchStatus}
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
      <h1 className="text-xl font-semibold text-[var(--text)] mb-6">
        {t("oneone.dashboardTitle")}
      </h1>

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
        onClick={fetchStatus}
        disabled={loading}
        className="fixed right-6 bottom-6 w-14 h-14 rounded-full bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white flex items-center justify-center text-xl shadow-lg hover:opacity-90 disabled:opacity-50"
        title={t("oneone.dashboardRefreshStatus")}
      >
        {loading ? "⟳" : "↻"}
      </button>
    </div>
  );
}
