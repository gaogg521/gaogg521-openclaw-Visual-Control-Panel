"use client";

import { useRef, useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";

export interface DayStat {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  messageCount: number;
  avgResponseMs: number;
}

export interface AllStats {
  daily: DayStat[];
  weekly: DayStat[];
  monthly: DayStat[];
}

export type TimeRange = "daily" | "weekly" | "monthly";

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

type TFunc = (key: string) => string;

function TrendChart({
  data,
  lines,
  height = 180,
  t,
  containerWidth,
}: {
  data: DayStat[];
  lines: { key: keyof DayStat; color: string; label: string }[];
  height?: number;
  t: TFunc;
  containerWidth?: number;
}) {
  if (data.length === 0)
    return (
      <div className="flex items-center justify-center h-32 text-[var(--text-muted)] text-sm">
        {t("common.noData")}
      </div>
    );

  const pad = { top: 16, right: 16, bottom: 50, left: 56 };
  const contentWidth = data.length * 56 + pad.left + pad.right;
  const width =
    containerWidth != null && containerWidth > 0
      ? Math.max(280, Math.floor(containerWidth))
      : Math.max(500, contentWidth);
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  let maxVal = 0;
  for (const d of data)
    for (const l of lines) {
      const v = d[l.key] as number;
      if (v > maxVal) maxVal = v;
    }
  if (maxVal === 0) maxVal = 1;

  const ticks = Array.from({ length: 5 }, (_, i) => Math.round((maxVal / 4) * i));

  function toX(i: number) {
    return pad.left + (i / (data.length - 1 || 1)) * chartW;
  }
  function toY(v: number) {
    return pad.top + chartH - (v / maxVal) * chartH;
  }

  return (
    <div className="w-full max-w-full overflow-x-auto">
      <svg width={width} height={height} className="text-[var(--text-muted)] min-w-0" style={{ maxWidth: "100%" }}>
        {ticks.map((tick, i) => (
          <g key={i}>
            <line
              x1={pad.left}
              y1={toY(tick)}
              x2={width - pad.right}
              y2={toY(tick)}
              stroke="currentColor"
              opacity={0.12}
            />
            <text x={pad.left - 8} y={toY(tick) + 4} textAnchor="end" fontSize={10} fill="currentColor">
              {formatTokens(tick)}
            </text>
          </g>
        ))}
        {lines.map((l) => {
          const points = data.map((d, i) => `${toX(i)},${toY(d[l.key] as number)}`).join(" ");
          return (
            <polyline
              key={l.key}
              points={points}
              fill="none"
              stroke={l.color}
              strokeWidth={2}
              opacity={0.85}
            />
          );
        })}
        {lines.map((l) =>
          data.map((d, i) => (
            <circle
              key={`${l.key}-${i}`}
              cx={toX(i)}
              cy={toY(d[l.key] as number)}
              r={3}
              fill={l.color}
              opacity={0.9}
            >
              <title>{`${d.date} ${l.label}: ${formatTokens(d[l.key] as number)}`}</title>
            </circle>
          ))
        )}
        {data.map((d, i) => (
          <text
            key={i}
            x={toX(i)}
            y={height - pad.bottom + 16}
            textAnchor="middle"
            fontSize={9}
            fill="currentColor"
            transform={`rotate(-30, ${toX(i)}, ${height - pad.bottom + 16})`}
          >
            {d.date.slice(5)}
          </text>
        ))}
        <line
          x1={pad.left}
          y1={pad.top}
          x2={pad.left}
          y2={pad.top + chartH}
          stroke="currentColor"
          opacity={0.25}
        />
        <line
          x1={pad.left}
          y1={pad.top + chartH}
          x2={width - pad.right}
          y2={pad.top + chartH}
          stroke="currentColor"
          opacity={0.25}
        />
      </svg>
    </div>
  );
}

function ResponseTrendChart({
  data,
  height = 180,
  t,
  containerWidth,
}: {
  data: DayStat[];
  height?: number;
  t: TFunc;
  containerWidth?: number;
}) {
  const filtered = data.filter((d) => d.avgResponseMs > 0);
  if (filtered.length === 0)
    return (
      <div className="flex items-center justify-center h-32 text-[var(--text-muted)] text-sm">
        {t("home.noResponseData")}
      </div>
    );

  const pad = { top: 16, right: 16, bottom: 50, left: 56 };
  const contentWidth = filtered.length * 56 + pad.left + pad.right;
  const width =
    containerWidth != null && containerWidth > 0
      ? Math.max(280, Math.floor(containerWidth))
      : Math.max(500, contentWidth);
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const maxVal = Math.max(...filtered.map((d) => d.avgResponseMs));

  const ticks = Array.from({ length: 5 }, (_, i) => Math.round((maxVal / 4) * i));
  function toX(i: number) {
    return pad.left + (i / (filtered.length - 1 || 1)) * chartW;
  }
  function toY(v: number) {
    return pad.top + chartH - (v / maxVal) * chartH;
  }

  const points = filtered.map((d, i) => `${toX(i)},${toY(d.avgResponseMs)}`).join(" ");

  return (
    <div className="w-full max-w-full overflow-x-auto">
      <svg width={width} height={height} className="text-[var(--text-muted)] min-w-0" style={{ maxWidth: "100%" }}>
        {ticks.map((tick, i) => (
          <g key={i}>
            <line
              x1={pad.left}
              y1={toY(tick)}
              x2={width - pad.right}
              y2={toY(tick)}
              stroke="currentColor"
              opacity={0.12}
            />
            <text x={pad.left - 8} y={toY(tick) + 4} textAnchor="end" fontSize={10} fill="currentColor">
              {formatMs(tick)}
            </text>
          </g>
        ))}
        <polyline points={points} fill="none" stroke="#f59e0b" strokeWidth={2} opacity={0.85} />
        {filtered.map((d, i) => (
          <circle key={i} cx={toX(i)} cy={toY(d.avgResponseMs)} r={3} fill="#f59e0b" opacity={0.9}>
            <title>{`${d.date}: ${formatMs(d.avgResponseMs)}`}</title>
          </circle>
        ))}
        {filtered.map((d, i) => (
          <text
            key={`l-${i}`}
            x={toX(i)}
            y={height - pad.bottom + 16}
            textAnchor="middle"
            fontSize={9}
            fill="currentColor"
            transform={`rotate(-30, ${toX(i)}, ${height - pad.bottom + 16})`}
          >
            {d.date.slice(5)}
          </text>
        ))}
        <line
          x1={pad.left}
          y1={pad.top}
          x2={pad.left}
          y2={pad.top + chartH}
          stroke="currentColor"
          opacity={0.25}
        />
        <line
          x1={pad.left}
          y1={pad.top + chartH}
          x2={width - pad.right}
          y2={pad.top + chartH}
          stroke="currentColor"
          opacity={0.25}
        />
      </svg>
    </div>
  );
}

export function GlobalStatsTrend({
  allStats,
  statsRange,
  setStatsRange,
}: {
  allStats: AllStats;
  statsRange: TimeRange;
  setStatsRange: (r: TimeRange) => void;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [layoutWidth, setLayoutWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setLayoutWidth(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const RANGE_LABELS: Record<TimeRange, string> = {
    daily: t("range.daily"),
    weekly: t("range.weekly"),
    monthly: t("range.monthly"),
  };

  const currentData = Array.isArray(allStats[statsRange]) ? allStats[statsRange] : [];
  const totalInput = currentData.reduce((s, d) => s + (d?.inputTokens ?? 0), 0);
  const totalOutput = currentData.reduce((s, d) => s + (d?.outputTokens ?? 0), 0);
  const totalMsgs = currentData.reduce((s, d) => s + (d?.messageCount ?? 0), 0);

  const chartWidth = layoutWidth > 0 ? layoutWidth : undefined;

  return (
    <div ref={containerRef} className="mt-8 p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] w-full max-w-full overflow-hidden">
      <div className="flex flex-col gap-2 mb-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">{t("home.globalTrend")}</h2>
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
          {(Object.keys(RANGE_LABELS) as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setStatsRange(r)}
              className={`px-3 py-1 text-xs transition ${
                statsRange === r
                  ? "bg-[var(--accent)] text-[var(--bg)] font-medium"
                  : "bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
          <div className="text-[10px] text-[var(--text-muted)]">{t("home.totalInputToken")}</div>
          <div className="text-lg font-bold text-blue-400">{formatTokens(totalInput)}</div>
        </div>
        <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
          <div className="text-[10px] text-[var(--text-muted)]">{t("home.totalOutputToken")}</div>
          <div className="text-lg font-bold text-emerald-400">{formatTokens(totalOutput)}</div>
        </div>
        <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
          <div className="text-[10px] text-[var(--text-muted)]">{t("home.totalMessages")}</div>
          <div className="text-lg font-bold text-purple-400">{totalMsgs}</div>
        </div>
      </div>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[var(--text-muted)]">{t("home.tokenTrend")}</span>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Input
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Output
            </span>
          </div>
        </div>
        <TrendChart
          data={currentData}
          lines={[
            { key: "inputTokens", color: "#3b82f6", label: "Input" },
            { key: "outputTokens", color: "#10b981", label: "Output" },
          ]}
          t={t}
          containerWidth={chartWidth}
        />
      </div>
      {statsRange === "daily" && (
        <div>
          <span className="text-xs text-[var(--text-muted)]">{t("home.avgResponseTrend")}</span>
          <ResponseTrendChart data={currentData} t={t} containerWidth={chartWidth} />
        </div>
      )}
    </div>
  );
}
