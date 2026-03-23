"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface DayStat {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  messageCount: number;
  avgResponseMs: number;
}

interface StatsData {
  agentId: string;
  daily: DayStat[];
  weekly: DayStat[];
  monthly: DayStat[];
}

type TimeRange = "daily" | "weekly" | "monthly";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

function formatMs(ms: number): string {
  if (!ms) return "-";
  if (ms < 1000) return ms + "ms";
  return (ms / 1000).toFixed(1) + "s";
}

// SVG Bar Chart component
function BarChart({
  data,
  labelKey,
  bars,
  height = 220,
  noDataText,
}: {
  data: DayStat[];
  labelKey: "date";
  bars: { key: keyof DayStat; color: string; label: string }[];
  height?: number;
  noDataText: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-[var(--text-muted)] text-sm">
        {noDataText}
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 60, left: 60 };
  const width = Math.max(600, data.length * (bars.length * 24 + 16) + padding.left + padding.right);
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  let maxVal = 0;
  for (const d of data) {
    for (const b of bars) {
      const v = d[b.key] as number;
      if (v > maxVal) maxVal = v;
    }
  }
  if (maxVal === 0) maxVal = 1;

  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((maxVal / tickCount) * i));
  const groupWidth = chartW / data.length;
  const barWidth = Math.min(20, (groupWidth - 8) / bars.length);

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="text-[var(--text-muted)]">
        {ticks.map((tick, i) => {
          const y = padding.top + chartH - (tick / maxVal) * chartH;
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="currentColor" opacity={0.15} />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="currentColor">
                {formatTokens(tick)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const groupX = padding.left + i * groupWidth;
          return (
            <g key={d.date}>
              {bars.map((b, bi) => {
                const v = d[b.key] as number;
                const barH = (v / maxVal) * chartH;
                const x = groupX + (groupWidth - bars.length * barWidth) / 2 + bi * barWidth;
                const y = padding.top + chartH - barH;
                return (
                  <g key={b.key}>
                    <rect x={x} y={y} width={barWidth - 2} height={barH} fill={b.color} rx={2} opacity={0.85}>
                      <title>{`${b.label}: ${formatTokens(v)}`}</title>
                    </rect>
                  </g>
                );
              })}
              <text
                x={groupX + groupWidth / 2}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                fontSize={10}
                fill="currentColor"
                transform={`rotate(-30, ${groupX + groupWidth / 2}, ${height - padding.bottom + 16})`}
              >
                {d.date}
              </text>
            </g>
          );
        })}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartH} stroke="currentColor" opacity={0.3} />
        <line x1={padding.left} y1={padding.top + chartH} x2={width - padding.right} y2={padding.top + chartH} stroke="currentColor" opacity={0.3} />
      </svg>
    </div>
  );
}

// Response time chart (separate scale)
function ResponseTimeChart({ data, height = 220, noDataText }: { data: DayStat[]; height?: number; noDataText: string }) {
  const filtered = data.filter((d) => d.avgResponseMs > 0);
  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-[var(--text-muted)] text-sm">
        {noDataText}
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 60, left: 60 };
  const width = Math.max(600, filtered.length * 40 + padding.left + padding.right);
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...filtered.map((d) => d.avgResponseMs));
  const barWidth = Math.min(28, chartW / filtered.length - 8);

  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((maxVal / tickCount) * i));

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="text-[var(--text-muted)]">
        {ticks.map((tick, i) => {
          const y = padding.top + chartH - (tick / maxVal) * chartH;
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="currentColor" opacity={0.15} />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="currentColor">
                {formatMs(tick)}
              </text>
            </g>
          );
        })}
        {filtered.map((d, i) => {
          const groupW = chartW / filtered.length;
          const x = padding.left + i * groupW + (groupW - barWidth) / 2;
          const barH = (d.avgResponseMs / maxVal) * chartH;
          const y = padding.top + chartH - barH;
          return (
            <g key={d.date}>
              <rect x={x} y={y} width={barWidth} height={barH} fill="#f59e0b" rx={2} opacity={0.85}>
                <title>{`${d.date}: ${formatMs(d.avgResponseMs)}`}</title>
              </rect>
              <text
                x={padding.left + i * groupW + groupW / 2}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                fontSize={10}
                fill="currentColor"
                transform={`rotate(-30, ${padding.left + i * groupW + groupW / 2}, ${height - padding.bottom + 16})`}
              >
                {d.date}
              </text>
            </g>
          );
        })}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartH} stroke="currentColor" opacity={0.3} />
        <line x1={padding.left} y1={padding.top + chartH} x2={width - padding.right} y2={padding.top + chartH} stroke="currentColor" opacity={0.3} />
      </svg>
    </div>
  );
}

function StatsPageInner() {
  const searchParams = useSearchParams();
  const agentId = searchParams.get("agent") || "";

  if (!agentId) return <StatsAgentPicker />;
  return <StatsDetail agentId={agentId} />;
}

export default function StatsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-[var(--text-muted)]">Loading...</p></div>}>
      <StatsPageInner />
    </Suspense>
  );
}

/* ── Agent picker (no ?agent= param) ── */
function StatsAgentPicker() {
  const [agents, setAgents] = useState<{ id: string; name: string; emoji: string; session?: { lastActive: number | null; totalTokens: number; sessionCount: number } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  function formatTimeAgo(ts: number): string {
    if (!ts) return "-";
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("common.justNow");
    if (mins < 60) return `${mins} ${t("common.minutesAgo")}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ${t("common.hoursAgo")}`;
    const days = Math.floor(hours / 24);
    return `${days} ${t("common.daysAgo")}`;
  }

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setAgents(data.agents || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)]">{t("common.loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-400">{t("common.loadError")}: {error}</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">📊 {t("stats.title")}</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {t("stats.selectAgent")}
          </p>
        </div>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition"
        >
          {t("common.backHome")}
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            href={`/stats?agent=${agent.id}`}
            className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] transition cursor-pointer block"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{agent.emoji}</span>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)]">{agent.name}</h3>
                {agent.name !== agent.id && (
                  <span className="text-xs text-[var(--text-muted)]">{agent.id}</span>
                )}
              </div>
            </div>
            {agent.session && (
              <div className="space-y-1 text-xs text-[var(--text-muted)]">
                <div className="flex justify-between">
                  <span>{t("agent.sessionCount")}</span>
                  <span className="text-[var(--text)]">{agent.session.sessionCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("agent.tokenUsage")}</span>
                  <span className="text-[var(--text)]">{formatTokens(agent.session.totalTokens)}</span>
                </div>
                {agent.session.lastActive && (
                  <div className="flex justify-between">
                    <span>{t("agent.lastActive")}</span>
                    <span className="text-[var(--text)]">{formatTimeAgo(agent.session.lastActive)}</span>
                  </div>
                )}
              </div>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}

/* ── Stats detail (with ?agent= param) ── */
function StatsDetail({ agentId }: { agentId: string }) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("daily");
  const { t } = useI18n();

  const getRangeLabel = (r: TimeRange): string => {
    const labels: Record<TimeRange, string> = {
      daily: t("range.daily"),
      weekly: t("range.weekly"),
      monthly: t("range.monthly"),
    };
    return labels[r];
  };

  useEffect(() => {
    fetch(`/api/stats/${agentId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setStats(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)]">{t("common.loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-400">{t("common.loadError")}: {error}</p>
      </div>
    );
  }

  if (!stats) return null;

  const currentData = stats[range];
  const totalInput = currentData.reduce((s, d) => s + d.inputTokens, 0);
  const totalOutput = currentData.reduce((s, d) => s + d.outputTokens, 0);
  const totalMessages = currentData.reduce((s, d) => s + d.messageCount, 0);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{`📊 ${agentId} ${t("stats.title")}`}</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {t("stats.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Time range selector */}
          <div className="max-w-full overflow-x-auto rounded-lg border border-[var(--border)]">
            <div className="flex min-w-max">
            {(["daily", "weekly", "monthly"] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-2 text-xs md:text-sm transition ${
                  range === r
                    ? "bg-[var(--accent)] text-[var(--bg)] font-medium"
                    : "bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {getRangeLabel(r)}
              </button>
            ))}
            </div>
          </div>
          <Link
            href={`/sessions?agent=${agentId}`}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition text-center"
          >
            {t("stats.sessionList")}
          </Link>
          <Link
            href={`/stats`}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition text-center"
          >
            {t("stats.backToAgents")}
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">{t("stats.totalInputToken")}</div>
          <div className="text-xl font-bold text-blue-400">{formatTokens(totalInput)}</div>
        </div>
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">{t("stats.totalOutputToken")}</div>
          <div className="text-xl font-bold text-emerald-400">{formatTokens(totalOutput)}</div>
        </div>
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">{t("stats.totalMessages")}</div>
          <div className="text-xl font-bold text-purple-400">{totalMessages}</div>
        </div>
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">{t("stats.dataPeriod")}</div>
          <div className="text-xl font-bold text-[var(--text)]">{currentData.length}</div>
        </div>
      </div>

      {/* Token chart */}
      <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] mb-6">
        <div className="flex flex-col gap-2 mb-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-sm font-semibold text-[var(--text)]">{t("stats.tokenConsumption")}</h2>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Input</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Output</span>
          </div>
        </div>
        <BarChart
          data={currentData}
          labelKey="date"
          bars={[
            { key: "inputTokens", color: "#3b82f6", label: "Input" },
            { key: "outputTokens", color: "#10b981", label: "Output" },
          ]}
          noDataText={t("common.noData")}
        />
      </div>

      {/* Response time chart */}
      {range === "daily" && (
        <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="text-sm font-semibold text-[var(--text)] mb-4">{t("stats.avgResponseTime")}</h2>
          <ResponseTimeChart data={currentData} noDataText={t("stats.noResponseData")} />
        </div>
      )}
    </main>
  );
}
