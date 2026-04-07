"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { GatewayStatus } from "./gateway-status";
import {
  AgentCard,
  ModelBadge,
  type AgentModelOptionGroup,
  type PlatformTestResult,
  type AgentModelTestResult,
  type AgentSessionTestResult,
} from "./components/agent-card";
import {
  AgentTaskTracking,
  type AgentActivityData,
} from "./components/agent-task-tracking";

interface Platform {
  name: string;
  accountId?: string;
  appId?: string;
  botOpenId?: string;
  botUserId?: string;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  model: string;
  platforms: Platform[];
  session?: {
    lastActive: number | null;
    totalTokens: number;
    contextTokens: number;
    sessionCount: number;
    todayAvgResponseMs: number;
    messageCount: number;
    weeklyResponseMs: number[];
    weeklyTokens: number[];
  };
}

interface GroupChat {
  groupId: string;
  channel: string;
  agents: { id: string; emoji: string; name: string }[];
}

interface ConfigData {
  agents: Agent[];
  defaults: { model: string; fallbacks: string[] };
  providers?: Array<{
    id: string;
    accessMode?: "auth" | "api_key";
    models?: Array<{ id: string; name?: string }>;
  }>;
  gateway?: { port: number; token?: string; host?: string };
  groupChats?: GroupChat[];
}

let cachedHomeData: ConfigData | null = null;
let cachedHomeError: string | null = null;
let cachedHomeLastUpdated = "";
let cachedHomeRefreshInterval = 0;
let cachedHomeAgentStates: Record<string, string> = {};

export default function Home() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<ConfigData | null>(cachedHomeData);
  const [error, setError] = useState<string | null>(cachedHomeError);
  const [configErrorCode, setConfigErrorCode] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(cachedHomeRefreshInterval);
  const [lastUpdated, setLastUpdated] = useState<string>(cachedHomeLastUpdated);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [testResults, setTestResults] = useState<Record<string, AgentModelTestResult | null> | null>(null);
  const [testing, setTesting] = useState(false);
  const [platformTestResults, setPlatformTestResults] = useState<Record<string, PlatformTestResult | null> | null>(null);
  const [testingPlatforms, setTestingPlatforms] = useState(false);
  const [sessionTestResults, setSessionTestResults] = useState<Record<string, AgentSessionTestResult | null> | null>(null);
  const [testingSessions, setTestingSessions] = useState(false);
  const [dmSessionResults, setDmSessionResults] = useState<Record<string, PlatformTestResult | null> | null>(null);
  const [testingDmSessions, setTestingDmSessions] = useState(false);
  const [shellOpen, setShellOpen] = useState(false);
  const [shellTitle, setShellTitle] = useState("命令输出");
  const [shellLines, setShellLines] = useState<string[]>([]);
  const [shellRunning, setShellRunning] = useState(false);
  const [agentStates, setAgentStates] = useState<Record<string, string>>(cachedHomeAgentStates);
  const [agentActivity, setAgentActivity] = useState<AgentActivityData[] | null>(null);

  const fetchAgentActivity = useCallback(async () => {
    try {
      const r = await fetch("/api/agent-activity", { cache: "no-store" });
      const d = await r.json();
      // 空数组不覆盖，避免冲掉快照；与 AgentTaskTracking 内 lastLive 快照配合
      if (Array.isArray(d.agents) && d.agents.length > 0) setAgentActivity(d.agents);
    } catch {
      /* 保留上次数据 */
    }
  }, []);

  const REFRESH_OPTIONS = [
    { label: t("refresh.manual"), value: 0 },
    { label: t("refresh.10s"), value: 10 },
    { label: t("refresh.30s"), value: 30 },
    { label: t("refresh.1m"), value: 60 },
    { label: t("refresh.5m"), value: 300 },
    { label: t("refresh.10m"), value: 600 },
  ];

  const openShell = useCallback((title: string, initial: string[] = []) => {
    setShellTitle(title);
    setShellLines(initial);
    setShellRunning(true);
    setShellOpen(true);
  }, []);

  const appendShell = useCallback((line: string) => {
    setShellLines((prev) => [...prev, line]);
  }, []);

  const parseApiPayload = useCallback(async (resp: Response) => {
    const raw = await resp.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {}
    const errorText = parsed?.error || raw || `HTTP ${resp.status}`;
    return { ok: resp.ok, status: resp.status, data: parsed, errorText };
  }, []);

  const callTestApi = useCallback(async (url: string) => {
    const requestWithMethod = async (method: "POST" | "GET") => {
      try {
        const resp = await fetch(url, { method, cache: "no-store" });
        return parseApiPayload(resp);
      } catch (err: unknown) {
        const raw = err instanceof Error ? err.message : String(err);
        const netFail = /failed to fetch|networkerror|load failed|network request failed/i.test(raw);
        const hint = netFail
          ? `无法连接面板接口 ${url}。常见原因：① 探测耗时过长被浏览器断开（已缩短单次超时并改为分批并行，请重试）；② 用局域网 IP 访问时需设置 CONFIG_ALLOW_LAN=1；③ Next 进程未运行或端口错误。(${raw})`
          : raw;
        return { ok: false as const, status: 0, data: null, errorText: hint };
      }
    };

    const first = await requestWithMethod("POST");
    if (first.ok) return first.data;

    const methodIssue = first.status === 405 || /method not allowed/i.test(first.errorText || "");
    if (!methodIssue) throw new Error(first.errorText);

    const fallback = await requestWithMethod("GET");
    if (fallback.ok) return fallback.data;
    throw new Error(fallback.errorText || first.errorText);
  }, [parseApiPayload]);

  const fetchData = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    fetch("/api/config")
      .then((r) => r.json())
      .then((configData) => {
        if (configData.error) {
          setError(configData.error);
          setConfigErrorCode(configData.errorCode || null);
          cachedHomeError = configData.error;
        } else {
          setData(configData);
          setError(null);
          setConfigErrorCode(null);
          cachedHomeData = configData;
          cachedHomeError = null;
        }
        const updated = new Date().toLocaleTimeString("zh-CN");
        setLastUpdated(updated);
        cachedHomeLastUpdated = updated;
      })
      .catch((e) => {
        setError(e.message);
        setConfigErrorCode(null);
        cachedHomeError = e.message;
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, []);

  const changeAgentModel = useCallback(
    async (agentId: string, model: string): Promise<string | void> => {
      const resp = await fetch("/api/config/agent-model", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, model }),
      });
      const payload = await parseApiPayload(resp);
      if (!payload.ok) {
        throw new Error(payload.errorText || t("agent.modelApplyFailed"));
      }
      fetchData(true);
      if (payload.data?.appliedViaFile) {
        return t("agent.modelSavedViaFile");
      }
    },
    [fetchData, parseApiPayload, t],
  );

  // 首次加载 - 从 localStorage 恢复测试状态
  useEffect(() => {
    fetchData(!!cachedHomeData);
    const savedTestResults = localStorage.getItem('agentTestResults');
    if (savedTestResults) {
      try {
        setTestResults(JSON.parse(savedTestResults));
      } catch (e) {
        console.error('Failed to parse testResults from localStorage', e);
      }
    }
    const savedPlatformTestResults = localStorage.getItem('platformTestResults');
    if (savedPlatformTestResults) {
      try {
        setPlatformTestResults(JSON.parse(savedPlatformTestResults));
      } catch (e) {
        console.error('Failed to parse platformTestResults from localStorage', e);
      }
    }
    const savedSessionTestResults = localStorage.getItem('sessionTestResults');
    if (savedSessionTestResults) {
      try {
        setSessionTestResults(JSON.parse(savedSessionTestResults));
      } catch (e) {
        console.error('Failed to parse sessionTestResults from localStorage', e);
      }
    }
    const savedDmSessionResults = localStorage.getItem('dmSessionResults');
    if (savedDmSessionResults) {
      try {
        setDmSessionResults(JSON.parse(savedDmSessionResults));
      } catch (e) {
        console.error('Failed to parse dmSessionResults from localStorage', e);
      }
    }
  }, [fetchData]);

  useEffect(() => {
    cachedHomeRefreshInterval = refreshInterval;
  }, [refreshInterval]);

  // 保存测试结果到 localStorage
  useEffect(() => {
    if (testResults) {
      localStorage.setItem('agentTestResults', JSON.stringify(testResults));
    }
  }, [testResults]);

  useEffect(() => {
    if (platformTestResults) {
      localStorage.setItem('platformTestResults', JSON.stringify(platformTestResults));
    }
  }, [platformTestResults]);

  useEffect(() => {
    if (sessionTestResults) {
      localStorage.setItem('sessionTestResults', JSON.stringify(sessionTestResults));
    }
  }, [sessionTestResults]);

  useEffect(() => {
    if (dmSessionResults) {
      localStorage.setItem('dmSessionResults', JSON.stringify(dmSessionResults));
    }
  }, [dmSessionResults]);

  const testAllAgents = useCallback(() => {
    setTesting(true);
    // Set all agents to null (testing indicator) so UI shows ⏳
    const pending: Record<string, any> = {};
    if (data) for (const a of data.agents) pending[a.id] = null;
    setTestResults(pending);
    callTestApi("/api/test-agents")
      .then((resp) => {
        if (resp.results) {
          const map: Record<string, { ok: boolean; text?: string; error?: string; elapsed: number }> = {};
          for (const r of resp.results) map[r.agentId] = r;
          setTestResults(map);
        }
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Request failed";
        const failed: Record<string, { ok: boolean; error: string; elapsed: number }> = {};
        if (data) for (const a of data.agents) failed[a.id] = { ok: false, error: msg, elapsed: 0 };
        setTestResults(failed);
      })
      .finally(() => setTesting(false));
  }, [data, callTestApi]);

  const testAllPlatforms = useCallback(() => {
    setTestingPlatforms(true);
    // Set all agent:platform combos to null (⏳)
    const pending: Record<string, any> = {};
    if (data) {
      for (const a of data.agents) {
        for (const p of a.platforms) {
          pending[`${a.id}:${p.name}`] = null;
        }
      }
    }
    setPlatformTestResults(pending);
    callTestApi("/api/test-platforms")
      .then((resp) => {
        if (resp.results) {
          const map: Record<string, PlatformTestResult> = {};
          for (const r of resp.results) map[`${r.agentId}:${r.platform}`] = r;
          setPlatformTestResults(map);
        }
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Request failed";
        const failed: Record<string, PlatformTestResult> = {};
        if (data) {
          for (const a of data.agents) {
            for (const p of a.platforms) {
              failed[`${a.id}:${p.name}`] = {
                ok: false,
                error: msg,
                elapsed: 0,
              };
            }
          }
        }
        setPlatformTestResults(failed);
      })
      .finally(() => setTestingPlatforms(false));
  }, [data, callTestApi]);

  const testAllSessions = useCallback(() => {
    setTestingSessions(true);
    openShell("测试 Agent", ["$ openclaw test agent-sessions", "正在测试所有 Agent 会话..."]);
    const pending: Record<string, any> = {};
    if (data) for (const a of data.agents) pending[a.id] = null;
    setSessionTestResults(pending);
    callTestApi("/api/test-sessions")
      .then((resp) => {
        if (resp.results) {
          const map: Record<string, { ok: boolean; reply?: string; error?: string; elapsed: number }> = {};
          for (const r of resp.results) map[r.agentId] = r;
          setSessionTestResults(map);
          const okCount = resp.results.filter((r: any) => r.ok).length;
          appendShell(`完成：成功 ${okCount} / 总计 ${resp.results.length}`);
          for (const r of resp.results.slice(0, 20)) {
            appendShell(`${r.ok ? "✓" : "✗"} ${r.agentId} (${r.elapsed}ms) ${r.error || r.reply || ""}`);
          }
        }
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Request failed";
        const failed: Record<string, { ok: boolean; error: string; elapsed: number }> = {};
        if (data) for (const a of data.agents) failed[a.id] = { ok: false, error: msg, elapsed: 0 };
        setSessionTestResults(failed);
        appendShell(`失败：${msg}`);
      })
      .finally(() => {
        setTestingSessions(false);
        setShellRunning(false);
      });
  }, [data, callTestApi, appendShell, openShell]);

  const testAllDmSessions = useCallback(() => {
    setTestingDmSessions(true);
    callTestApi("/api/test-dm-sessions")
      .then((resp) => {
        if (resp.results) {
          setDmSessionResults((prev) => {
            const next = { ...(prev || {}) };
            for (const r of resp.results) {
              next[`${r.agentId}:${r.platform}`] = {
                ok: r.ok,
                error: r.error,
                detail: r.detail,
                elapsed: r.elapsed,
              };
            }
            return next;
          });
        }
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Request failed";
        setDmSessionResults((prev) => {
          const next = { ...(prev || {}) };
          if (data) {
            for (const a of data.agents) {
              for (const p of a.platforms) {
                next[`${a.id}:${p.name}`] = { ok: false, error: msg, elapsed: 0 };
              }
            }
          }
          return next;
        });
      })
      .finally(() => setTestingDmSessions(false));
  }, [data, callTestApi]);

  // 定时刷新
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (refreshInterval > 0) {
      timerRef.current = setInterval(fetchData, refreshInterval * 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [refreshInterval, fetchData]);

  // Agent 状态轮询 (30秒)
  useEffect(() => {
    const fetchStatus = () => {
      fetch("/api/agent-status")
        .then(r => r.json())
        .then(d => {
          if (d.statuses) {
            const map: Record<string, string> = {};
            for (const s of d.statuses) map[s.agentId] = s.state;
            setAgentStates(map);
            cachedHomeAgentStates = map;
          }
        })
        .catch(() => {});
    };
    fetchStatus();
    const timer = setInterval(fetchStatus, 30000);
    return () => clearInterval(timer);
  }, []);

  // Agent 任务追踪（子任务 / 定时任务），与仪表盘同源数据
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

  if (error && !data) {
    const isConfigNotFound = configErrorCode === "CONFIG_NOT_FOUND";
    const isConfigParse = configErrorCode === "CONFIG_PARSE_ERROR";

    /* ── ONE CLAW 未安装 → 专属引导页，直接导向 /setup ── */
    if (isConfigNotFound) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#0c0f18] to-[#070910]">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-xl">
            {/* logo */}
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg)]/90 shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand-mark.png" alt="ONE Claw" className="max-h-14 w-auto max-w-[80%] object-contain" />
            </div>

            <h1 className="text-xl font-bold text-[var(--text)] mb-2">
              {t("home.notInstalledTitle")}
            </h1>
            <p className="text-sm text-[var(--text-muted)] mb-6 leading-relaxed">
              {t("home.notInstalledSub")}
            </p>

            {/* 主 CTA：去安装向导 */}
            <a
              href="/setup"
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold py-3 px-6 shadow-lg shadow-red-900/30 transition no-underline"
            >
              {t("home.notInstalledCta")}
              <span aria-hidden>→</span>
            </a>

            {/* 次要：重试（有时用户已安装但路径不对） */}
            <button
              onClick={() => fetchData(false)}
              disabled={loading}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] py-2.5 text-sm font-medium text-[var(--text-muted)] hover:border-[var(--accent)]/50 transition disabled:opacity-50"
            >
              {loading ? t("common.loading") : t("home.notInstalledRetry")}
            </button>

            {/* 折叠诊断信息 */}
            <details className="mt-5 text-left group rounded-xl border border-[var(--border)]/80 bg-[var(--bg)]/40 px-3 py-2">
              <summary className="text-xs text-[var(--text-muted)] cursor-pointer list-none flex items-center justify-between py-1">
                <span>{t("home.notInstalledDiag")}</span>
                <span className="text-[var(--text-muted)]/50 group-open:rotate-90 transition-transform">›</span>
              </summary>
              <div className="mt-2 pt-2 border-t border-[var(--border)]/60">
                <p className="font-mono text-[10px] text-red-300/80 break-all whitespace-pre-wrap max-h-32 overflow-auto">{error}</p>
                <p className="mt-2 text-[10px] text-[var(--text-muted)] leading-relaxed">
                  {t("home.configNotFoundHint")}
                </p>
              </div>
            </details>
          </div>
        </div>
      );
    }

    /* ── 其他错误（解析失败等） → 原有错误卡片 ── */
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <p className="text-[var(--text)] font-medium mb-2">{t("common.loadError")}</p>
          <p className="text-sm text-[var(--text-muted)] mb-3 break-words">{error}</p>
          {isConfigParse && (
            <p className="text-xs text-[var(--text-muted)] mb-4 text-left">
              {t("home.configParseErrorHint")}
            </p>
          )}
          <button
            onClick={() => fetchData(false)}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? t("common.loading") : t("common.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)]">{t("common.loading")}</p>
      </div>
    );
  }

  const providerAccessModeMap: Record<string, "auth" | "api_key"> = {};
  for (const p of data.providers || []) {
    if (!p?.id || !p.accessMode) continue;
    providerAccessModeMap[p.id] = p.accessMode;
  }
  const modelOptions: AgentModelOptionGroup[] = (data.providers || [])
    .filter((provider) => provider?.id && Array.isArray(provider.models) && provider.models.length > 0)
    .map((provider) => ({
      providerId: provider.id,
      providerName: provider.id,
      accessMode: provider.accessMode,
      models: (provider.models || []).map((model) => ({
        id: model.id,
        name: model.name || model.id,
      })),
    }));
  return (
    <div className="p-3 md:p-4 max-w-6xl mx-auto">
      {/* 头部 */}
      <div className="hidden md:block mb-3">
        <h1 className="text-xl font-bold flex items-center gap-2">
          🤖 {t("home.pageTitle")}
        </h1>
        <p className="text-[var(--text-muted)] text-xs mt-0.5">
          {t("models.totalPrefix")} {data.agents.length} {t("home.agentCount")} · {t("home.defaultModel")}: {data.defaults.model}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="shrink-0">
          <GatewayStatus hideIconOnMobile />
        </div>
        <div className="flex items-center gap-2 min-w-0 max-w-full overflow-x-auto pb-1 md:overflow-visible md:pb-0">
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="shrink-0 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--text)] cursor-pointer hover:border-[var(--accent)] transition"
          >
            {REFRESH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value === 0 ? `🔄 ${opt.label}` : `⏱️ ${opt.label}`}
              </option>
            ))}
          </select>
          {refreshInterval === 0 && (
            <button
              onClick={() => fetchData(false)}
              disabled={loading}
              className="shrink-0 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition disabled:opacity-50"
            >
              {loading ? "⏳" : "🔄"}
            </button>
          )}
          {lastUpdated && (
            <span className="shrink-0 text-xs text-[var(--text-muted)] whitespace-nowrap">
              {t("home.updatedAt")} {lastUpdated}
            </span>
          )}
          <button
            type="button"
            onClick={() => void testAllDmSessions()}
            disabled={testingDmSessions || !data?.agents?.length}
            className="shrink-0 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs hover:border-[var(--accent)] transition disabled:opacity-50"
            title={t("home.testDmSessions")}
          >
            {testingDmSessions ? t("home.testingDmSessions") : t("home.testDmSessions")}
          </button>
        </div>
      </div>

      {/* 卡片墙 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} gatewayPort={data.gateway?.port || 18789} gatewayToken={data.gateway?.token} gatewayHost={data.gateway?.host} t={t} testResult={testResults?.[agent.id]} platformTestResults={platformTestResults || undefined} sessionTestResult={sessionTestResults?.[agent.id]} agentState={agentStates[agent.id]} dmSessionResults={dmSessionResults || undefined} providerAccessModeMap={providerAccessModeMap} modelOptions={modelOptions} onModelChange={changeAgentModel} />
        ))}
      </div>

      {/* 群聊管理 */}
      {data.groupChats && data.groupChats.length > 0 && (
        <div className="mt-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-3">
            {t("home.groupTopology")}
          </h2>
          <div className="space-y-3">
            {data.groupChats.map((group, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                <span className="text-lg">{group.channel === "feishu" ? "📱" : "🎮"}</span>
                <div className="flex-1">
                  <div className="text-xs text-[var(--text-muted)] mb-1">
                    {group.channel === "feishu" ? t("home.feishuGroup") : t("home.discordChannel")} · {group.groupId.split(":")[1]}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.agents.map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--card)] border border-[var(--border)]">
                        {a.emoji} {a.name}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-[var(--text-muted)]">{group.agents.length} {t("home.bots")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback 信息 */}
      {data.defaults.fallbacks.length > 0 && (
        <div className="mt-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-2">
            {t("home.fallbackModels")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.defaults.fallbacks.map((f, i) => (
              <ModelBadge key={i} model={f} />
            ))}
          </div>
        </div>
      )}

      <AgentTaskTracking
        agentActivity={agentActivity}
        t={t}
        locale={locale}
        className="mt-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]"
      />

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
