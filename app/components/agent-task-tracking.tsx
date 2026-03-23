"use client";

import { useEffect, useMemo, useRef } from "react";

export interface SubagentActivityEvent {
  key: string;
  text: string;
  at: number;
}

export interface SubagentInfo {
  toolId: string;
  label: string;
  activityEvents?: SubagentActivityEvent[];
}

export interface AgentActivityData {
  agentId: string;
  name: string;
  emoji: string;
  state: "idle" | "working" | "waiting" | "offline";
  lastActive: number;
  subagents?: SubagentInfo[];
  cronJobs?: Array<{
    key: string;
    jobId: string;
    label: string;
    isRunning: boolean;
    lastRunAt: number;
    nextRunAt?: number;
    durationMs?: number;
    lastStatus: "success" | "running" | "failed";
    lastSummary?: string;
    consecutiveFailures: number;
  }>;
}

type TFn = (key: string) => string;

function timeLocale(locale: string) {
  if (locale === "zh") return "zh-CN";
  if (locale === "zh-TW") return "zh-TW";
  if (locale === "ms") return "ms-MY";
  if (locale === "id") return "id-ID";
  if (locale === "th") return "th-TH";
  return "en-US";
}

/**
 * Agent 任务追踪：子任务 + 定时任务（数据来自 /api/agent-activity）
 */
export function AgentTaskTracking({
  agentActivity,
  t,
  locale,
  className = "mt-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]",
}: {
  agentActivity: AgentActivityData[] | null;
  t: TFn;
  locale: string;
  /** 外层容器 class，仪表盘可传入 CARD_CLASS */
  className?: string;
}) {
  /** 仅在有「非 offline」Agent 时刷新快照，便于在全部离线/长时间无任务时继续展示上一版有活动的界面 */
  const lastLiveSnapshotRef = useRef<AgentActivityData[] | null>(null);

  useEffect(() => {
    if (agentActivity && agentActivity.some((a) => a.state !== "offline")) {
      lastLiveSnapshotRef.current = agentActivity;
    }
  }, [agentActivity]);

  const { rows, showStaleHint } = useMemo(() => {
    const cur = agentActivity ?? null;
    const visible =
      cur && cur.length > 0 ? cur.filter((a) => a.state !== "offline") : [];

    if (visible.length > 0) {
      return { rows: visible, showStaleHint: false };
    }

    const snap = lastLiveSnapshotRef.current;
    if (snap && snap.length > 0) {
      return { rows: snap, showStaleHint: true };
    }

    if (cur && cur.length > 0) {
      return { rows: cur, showStaleHint: false };
    }

    return { rows: [], showStaleHint: false };
  }, [agentActivity]);

  const tl = timeLocale(locale);

  if (rows.length === 0) {
    return (
      <div className={className}>
        <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-3">
          📋 {t("home.agentTaskTracking")}
        </h2>
        <p className="text-xs text-[var(--text-muted)]">{t("common.noData")}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-3">
        📋 {t("home.agentTaskTracking")}
      </h2>
      {showStaleHint ? (
        <p className="text-[11px] text-amber-500/90 mb-3 leading-relaxed border border-amber-500/25 rounded-lg px-2.5 py-1.5 bg-amber-500/5">
          {t("home.agentTaskSnapshotHint")}
        </p>
      ) : null}
      <div className="space-y-2">
        {rows.map((agent) => (
            <div
              key={agent.agentId}
              className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
            >
              <span className="text-lg leading-none mt-0.5">{agent.emoji || "🤖"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-[var(--text)]">{agent.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      agent.state === "working"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : agent.state === "waiting"
                          ? "bg-amber-500/20 text-amber-400"
                          : agent.state === "offline"
                            ? "bg-zinc-600/30 text-zinc-400"
                            : "bg-[var(--border)] text-[var(--text-muted)]"
                    }`}
                  >
                    {agent.state === "working"
                      ? t("home.agentTaskState.working")
                      : agent.state === "waiting"
                        ? t("home.agentTaskState.waiting")
                        : agent.state === "offline"
                          ? t("agent.status.offline")
                          : t("home.agentTaskState.idle")}
                  </span>
                </div>
                {agent.subagents && agent.subagents.length > 0 ? (
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wide opacity-60">
                      {t("home.agentTaskSubtasks")}
                    </div>
                    {agent.subagents.map((sub, i) => (
                      <div key={i} className="text-xs text-[var(--text-muted)]">
                        <span className="text-[var(--accent)] mr-1">↳</span>
                        <span className="font-medium text-[var(--text)]">{sub.label}</span>
                        {sub.activityEvents && sub.activityEvents.length > 0 && (
                          <span className="ml-2 opacity-70">
                            — {sub.activityEvents[sub.activityEvents.length - 1].text}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-[var(--text-muted)] opacity-60">
                    {t("home.agentTaskNoSubtasks")}
                  </div>
                )}
                {agent.cronJobs && agent.cronJobs.length > 0 ? (
                  <div className="space-y-1 mt-2 pt-2 border-t border-[var(--border)]">
                    <div className="text-[10px] uppercase tracking-wide opacity-60">
                      {t("home.agentTaskCron")}
                    </div>
                    {agent.cronJobs.map((cron) => (
                      <div key={cron.key} className="text-xs text-[var(--text-muted)]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-yellow-400">⏰</span>
                          <span className="font-medium text-[var(--text)]">{cron.label}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              cron.lastStatus === "running"
                                ? "bg-sky-500/20 text-sky-400"
                                : cron.lastStatus === "failed"
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-emerald-500/20 text-emerald-400"
                            }`}
                          >
                            {cron.lastStatus === "running"
                              ? t("home.agentTaskCronState.running")
                              : cron.lastStatus === "failed"
                                ? t("home.agentTaskCronState.failed")
                                : t("home.agentTaskCronState.success")}
                          </span>
                          {cron.consecutiveFailures > 0 && (
                            <span className="text-[10px] text-red-400">
                              {t("home.agentTaskCronFailures")} {cron.consecutiveFailures}
                            </span>
                          )}
                        </div>
                        <div className="ml-5 opacity-70">
                          {cron.lastSummary || t("home.agentTaskCronNoSummary")}
                        </div>
                        <div className="ml-5 mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] opacity-60">
                          {cron.durationMs !== undefined && (
                            <span>
                              {t("home.agentTaskCronDuration")}{" "}
                              {Math.max(1, Math.round(cron.durationMs / 1000))}s
                            </span>
                          )}
                          {cron.nextRunAt ? (
                            <span>
                              {t("home.agentTaskCronNextRun")}{" "}
                              {new Date(cron.nextRunAt).toLocaleTimeString(tl, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-[var(--text-muted)] opacity-60 mt-2">
                    {t("home.agentTaskNoCron")}
                  </div>
                )}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                {agent.lastActive
                  ? new Date(agent.lastActive).toLocaleTimeString(tl, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
