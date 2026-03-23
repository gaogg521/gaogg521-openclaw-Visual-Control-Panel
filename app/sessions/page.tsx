"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { buildGatewayUrl } from "@/lib/gateway-url";
import { useI18n } from "@/lib/i18n";

interface AgentInfo {
  id: string;
  name: string;
  emoji: string;
  model: string;
  session?: {
    lastActive: number | null;
    totalTokens: number;
    contextTokens: number;
    sessionCount: number;
  };
}

interface Session {
  key: string;
  type: string;
  target: string;
  sessionId: string | null;
  updatedAt: number;
  totalTokens: number;
  contextTokens: number;
  systemSent: boolean;
}

interface GatewayInfo {
  port: number;
  token?: string;
  host?: string;
}

const TYPE_EMOJI_COLOR: Record<string, { emoji: string; color: string }> = {
  main: { emoji: "🏠", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  "feishu-dm": { emoji: "📱", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  "feishu-group": { emoji: "👥", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  "discord-dm": { emoji: "🎮", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  "discord-channel": { emoji: "📢", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  "whatsapp-dm": { emoji: "💬", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  "whatsapp-group": { emoji: "👥", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  cron: { emoji: "⏰", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  unknown: { emoji: "❓", color: "bg-gray-500/20 text-gray-300 border-gray-500/30" },
};

function formatTime(ts: number): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("zh-CN");
}

/* ── Agent picker (no ?agent= param) ── */
function AgentPicker() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
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
          <h1 className="text-2xl font-bold">💬 {t("nav.sessions")}</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {t("sessions.selectAgent")}
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
            href={`/sessions?agent=${agent.id}`}
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
                  <span className="text-[var(--text)]">{(agent.session.totalTokens / 1000).toFixed(1)}k</span>
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

/* ── Session list (with ?agent= param) ── */
function SessionList({ agentId }: { agentId: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [gateway, setGateway] = useState<GatewayInfo>({ port: 18789 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, { status: string; elapsed?: number; reply?: string; error?: string }>>({});
  const [testingAll, setTestingAll] = useState(false);
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

  function getTypeLabel(type: string): { label: string; emoji: string; color: string } {
    const info = TYPE_EMOJI_COLOR[type] || TYPE_EMOJI_COLOR.unknown;
    const labelKey = `sessions.type.${type}` as const;
    const label = t(TYPE_EMOJI_COLOR[type] ? labelKey : "sessions.type.unknown");
    return { ...info, label };
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/sessions/${agentId}`).then((r) => r.json()),
      fetch("/api/config").then((r) => r.json()),
    ])
      .then(([sessData, configData]) => {
        if (sessData.error) setError(sessData.error);
        else setSessions(sessData.sessions || []);
        if (configData.gateway) setGateway(configData.gateway);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    // 从 localStorage 恢复测试结果
    const savedTestResults = localStorage.getItem('sessionTestResults');
    if (savedTestResults) {
      try {
        setTestResults(JSON.parse(savedTestResults));
      } catch (e) {
        console.error('Failed to parse sessionTestResults from localStorage', e);
      }
    }
  }, [agentId]);

  // 保存测试结果到 localStorage
  useEffect(() => {
    if (Object.keys(testResults).length > 0) {
      localStorage.setItem('sessionTestResults', JSON.stringify(testResults));
    }
  }, [testResults]);

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

  const totalTokens = sessions.reduce((sum, s) => sum + s.totalTokens, 0);

  async function testSession(sessionKey: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    setTestResults((prev) => ({ ...prev, [sessionKey]: { status: "testing" } }));
    try {
      const res = await fetch("/api/test-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey, agentId, port: gateway.port, token: gateway.token }),
      });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [sessionKey]: data }));
      return data;
    } catch (err: any) {
      const result = { status: "error", error: err.message };
      setTestResults((prev) => ({ ...prev, [sessionKey]: result }));
      return result;
    }
  }

  async function testAllSessions() {
    setTestingAll(true);
    const promises = sessions.map((s) => testSession(s.key));
    await Promise.all(promises);
    setTestingAll(false);
  }

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">📋 {agentId} {t("sessions.title")}</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {sessions.length} {t("sessions.sessionCount")} · {t("sessions.totalToken")}: {(totalTokens / 1000).toFixed(1)}k
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={testAllSessions}
            disabled={testingAll}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {testingAll ? t("sessions.testingAll") : t("sessions.testAll")}
          </button>
          <Link
            href="/sessions"
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition text-center"
          >
            {t("sessions.backToAgents")}
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        {sessions.map((s) => {
          const typeInfo = getTypeLabel(s.type);
          let chatUrl = buildGatewayUrl(gateway.port, "/chat", { session: s.key }, gateway.host);
          if (gateway.token) chatUrl = buildGatewayUrl(gateway.port, "/chat", { session: s.key, token: gateway.token }, gateway.host);
          return (
            <div
              key={s.key}
              onClick={() => window.open(chatUrl, "_blank")}
              title={t("agent.openChat")}
              className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] transition cursor-pointer"
            >
              <div className="flex flex-col gap-2 mb-2 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${typeInfo.color}`}
                  >
                    {typeInfo.emoji} {typeInfo.label}
                  </span>
                  {s.target && (
                    <code className="text-xs text-[var(--text-muted)] bg-[var(--bg)] px-2 py-0.5 rounded truncate max-w-[52vw] md:max-w-none">
                      {s.target}
                    </code>
                  )}
                </div>
                <div className="flex items-center gap-2 md:self-auto self-start">
                  <button
                    onClick={(e) => testSession(s.key, e)}
                    disabled={testResults[s.key]?.status === "testing"}
                    className="px-3 py-1 rounded-lg text-xs font-medium border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition disabled:opacity-50"
                  >
                    {testResults[s.key]?.status === "testing" ? t("sessions.testing") : t("sessions.test")}
                  </button>
                  <span className="text-xs text-[var(--text-muted)]">{formatTimeAgo(s.updatedAt)}</span>
                </div>
              </div>
              {/* Test result */}
              {testResults[s.key] && testResults[s.key].status !== "testing" && (
                <div className={`mb-2 px-3 py-2 rounded-lg text-xs ${
                  testResults[s.key].status === "ok"
                    ? "bg-green-500/10 border border-green-500/30 text-green-300"
                    : "bg-red-500/10 border border-red-500/30 text-red-300"
                }`}>
                  <span className="font-medium">
                    {testResults[s.key].status === "ok" ? t("sessions.testOk") : t("sessions.testFail")}
                  </span>
                  {testResults[s.key].elapsed && (
                    <span className="ml-2">{t("sessions.testTime")}: {(testResults[s.key].elapsed! / 1000).toFixed(1)}s</span>
                  )}
                  {testResults[s.key].reply && (
                    <span className="ml-2 opacity-80 break-all">{t("sessions.testReply")}: {testResults[s.key].reply}</span>
                  )}
                  {testResults[s.key].error && (
                    <span className="ml-2 opacity-80 break-all">{testResults[s.key].error}</span>
                  )}
                </div>
              )}
              {/* Context usage bar */}
              {s.contextTokens > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
                    <span>{t("sessions.context")}</span>
                    <span>
                      {(s.totalTokens / 1000).toFixed(1)}k / {(s.contextTokens / 1000).toFixed(0)}k
                      {" "}({(s.totalTokens / s.contextTokens * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[var(--bg)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        s.totalTokens / s.contextTokens > 0.9
                          ? "bg-red-500"
                          : s.totalTokens / s.contextTokens > 0.7
                            ? "bg-yellow-500"
                            : "bg-green-500"
                      }`}
                      style={{ width: `${Math.min(100, s.totalTokens / s.contextTokens * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                <span className="font-mono text-[10px] opacity-60 truncate max-w-[56vw] md:max-w-none">{s.key}</span>
                <span>{formatTime(s.updatedAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

/* ── Page entry ── */
function SessionsPageInner() {
  const searchParams = useSearchParams();
  const agentId = searchParams.get("agent") || "";

  if (!agentId) return <AgentPicker />;
  return <SessionList agentId={agentId} />;
}

export default function SessionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-[var(--text-muted)]">Loading...</p></div>}>
      <SessionsPageInner />
    </Suspense>
  );
}
