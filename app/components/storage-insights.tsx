"use client";

type DistItem = { name: string; value: number };
type RunItem = {
  id: number;
  reason: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
};

export type StorageMetricsData = {
  overview: {
    agentCount: number;
    sessionCount: number;
    enabledChannelCount: number;
    lastSyncTime: string | null;
  };
  channelDistribution: DistItem[];
  chatTypeDistribution: DistItem[];
  topAgents: DistItem[];
  recentRuns: RunItem[];
};

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function DistBar({ title, data }: { title: string; data: DistItem[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
      <div className="text-xs text-[var(--text-muted)] mb-2">{title}</div>
      {data.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)]">暂无数据</div>
      ) : (
        <div className="space-y-2">
          {data.slice(0, 6).map((item) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <div key={item.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="truncate pr-2">{item.name}</span>
                  <span className="text-[var(--text-muted)]">{item.value}</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded">
                  <div
                    className="h-full rounded bg-[var(--accent)]"
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function StorageInsights({
  metrics,
  syncing,
  onSync,
}: {
  metrics: StorageMetricsData | null;
  syncing: boolean;
  onSync: () => void;
}) {
  return (
    <div className="mt-6 p-5 rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">数据库存储状态</h2>
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="px-3 py-1.5 rounded-lg text-xs bg-[var(--accent)] text-[var(--bg)] disabled:opacity-50"
        >
          {syncing ? "同步中..." : "立即同步数据库"}
        </button>
      </div>

      {!metrics ? (
        <div className="text-sm text-[var(--text-muted)]">正在读取数据库指标...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
              <div className="text-[10px] text-[var(--text-muted)]">Agent 数</div>
              <div className="text-lg font-bold">{metrics.overview.agentCount}</div>
            </div>
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
              <div className="text-[10px] text-[var(--text-muted)]">会话数</div>
              <div className="text-lg font-bold">{metrics.overview.sessionCount}</div>
            </div>
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
              <div className="text-[10px] text-[var(--text-muted)]">启用通道</div>
              <div className="text-lg font-bold">{metrics.overview.enabledChannelCount}</div>
            </div>
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
              <div className="text-[10px] text-[var(--text-muted)]">最近同步</div>
              <div className="text-xs font-medium">{formatTime(metrics.overview.lastSyncTime)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <DistBar title="渠道分布" data={metrics.channelDistribution} />
            <DistBar title="会话类型分布" data={metrics.chatTypeDistribution} />
            <DistBar title="Top Agents（按会话量）" data={metrics.topAgents} />
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
            <div className="text-xs text-[var(--text-muted)] mb-2">最近同步记录</div>
            <div className="space-y-2">
              {metrics.recentRuns.slice(0, 5).map((run) => (
                <div key={run.id} className="text-xs flex items-center justify-between gap-3">
                  <span className="truncate">
                    #{run.id} {run.reason}
                  </span>
                  <span
                    className={
                      run.status === "ok"
                        ? "text-green-400"
                        : run.status === "running"
                          ? "text-amber-400"
                          : "text-red-400"
                    }
                  >
                    {run.status}
                  </span>
                  <span className="text-[var(--text-muted)]">{formatTime(run.startedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

