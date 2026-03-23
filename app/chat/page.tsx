"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface AgentInfo {
  id: string;
  name: string;
  emoji: string;
}

interface SessionInfo {
  key: string;
  type: string;
  sessionId?: string | null;
  updatedAt: number;
}

interface ChatItem {
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
  /** 发送中占位，收到回复后整行移除 */
  pending?: boolean;
}

const CHAT_HISTORY_PREFIX = "openclaw-webchat-history-v1";
const MAX_HISTORY_MESSAGES = 300;

function timeText(ts: number): string {
  return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

/** 浏览器可打开的 Gateway 地址（避免 localhost / 0.0.0.0 在部分环境下歧义） */
function normalizeGatewayHost(host: string): string {
  const h = String(host || "").trim();
  if (!h || h === "localhost" || h === "0.0.0.0" || h === "::") return "127.0.0.1";
  return h;
}

export default function ChatPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [agentId, setAgentId] = useState("");
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionKey, setSessionKey] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [fastMode, setFastMode] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [gatewayWeb, setGatewayWeb] = useState<{ host: string; port: number }>({
    host: "127.0.0.1",
    port: 18789,
  });
  const historyKey = useMemo(
    () => (agentId && sessionKey ? `${CHAT_HISTORY_PREFIX}:${agentId}:${sessionKey}` : ""),
    [agentId, sessionKey],
  );

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) throw new Error(d.error);
        const list = Array.isArray(d?.agents) ? d.agents : [];
        setAgents(list);
        const firstAgent = list?.[0]?.id ? String(list[0].id) : "main";
        setAgentId(firstAgent);
        const gh = normalizeGatewayHost(String(d?.gateway?.host || ""));
        const gp = Number(d?.gateway?.port) || 18789;
        setGatewayWeb({ host: gh, port: gp });
      })
      .catch((e) => setError(e?.message || "加载配置失败"))
      .finally(() => setLoading(false));
  }, []);

  const connectSession = useCallback(async (silent = false): Promise<void> => {
    if (!agentId) return;
    setConnecting(true);
    if (!silent) setError(null);
    try {
      const res = await fetch("/api/chat/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }
      const list = Array.isArray(payload?.sessions) ? payload.sessions : [];
      setSessions(list);
      const baseSessionKey = String(payload?.sessionKey || list?.[0]?.key || `agent:${agentId}:main`);
      setSessionKey(baseSessionKey);
      setSessionId(payload?.sessionId ? String(payload.sessionId) : (list?.[0]?.sessionId || null));
      setSessionReady(Boolean(payload?.connected));
      setConnected(false);
      if (payload?.tokenReady === false) {
        setError("连接成功，但网关 token 未配置（gateway.auth.token）。");
      } else if (!silent) {
        setMessages((prev) => [
          ...prev,
          { role: "system", content: "会话已就绪，可开始对话。", ts: Date.now() },
        ]);
      }
    } catch (e: any) {
      setSessionReady(false);
      setConnected(false);
      setSessions([]);
      setSessionKey(`agent:${agentId}:main`);
      setSessionId(null);
      setError(e?.message || "连接会话失败");
    } finally {
      setConnecting(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (!agentId) return;
    setSessions([]);
    setSessionKey("");
    setSessionId(null);
    setSessionReady(false);
    setConnected(false);
    void connectSession(true);
  }, [agentId, connectSession]);

  // Load persisted history for current agent+session.
  useEffect(() => {
    if (!historyKey) {
      setMessages([]);
      return;
    }
    try {
      const raw = localStorage.getItem(historyKey);
      if (!raw) {
        setMessages([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setMessages([]);
        return;
      }
      const normalized: ChatItem[] = parsed
        .filter((x: any) => x && (x.role === "user" || x.role === "assistant" || x.role === "system"))
        .map((x: any) => ({
          role: x.role,
          content: String(x.content || ""),
          ts: Number(x.ts || Date.now()),
        }))
        .slice(-MAX_HISTORY_MESSAGES);
      setMessages(normalized);
    } catch {
      setMessages([]);
    }
  }, [historyKey]);

  // Persist history for current agent+session.
  useEffect(() => {
    if (!historyKey) return;
    try {
      const toSave = messages.filter((m) => !m.pending);
      if (toSave.length === 0) {
        localStorage.removeItem(historyKey);
        return;
      }
      localStorage.setItem(historyKey, JSON.stringify(toSave.slice(-MAX_HISTORY_MESSAGES)));
    } catch {
      // Ignore storage quota or serialization errors.
    }
  }, [historyKey, messages]);

  const sessionOptions = useMemo(() => {
    return sessions.map((s) => ({
      key: s.key,
      label: `${s.type || "unknown"} · ${s.sessionId || s.key}`,
    }));
  }, [sessions]);

  /** OpenClaw Control 内置网页聊天，与当前「选择会话」一致 */
  const webChatUrl = useMemo(() => {
    if (!agentId) return "";
    const session = sessionKey || `agent:${agentId}:main`;
    const q = new URLSearchParams({ session });
    return `http://${gatewayWeb.host}:${gatewayWeb.port}/chat?${q.toString()}`;
  }, [agentId, sessionKey, gatewayWeb.host, gatewayWeb.port]);

  async function sendMessage(): Promise<void> {
    const text = input.trim();
    const activeSessionKey = sessionKey;
    if (!text || !agentId || !activeSessionKey || sending) return;
    setSending(true);
    setError(null);
    setInput("");

    const nextHistory: ChatItem[] = [...messages, { role: "user", content: text, ts: Date.now() }];
    setMessages([
      ...nextHistory,
      { role: "assistant", content: "正在生成回复…", ts: Date.now(), pending: true },
    ]);

    try {
      const res = await fetch("/api/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          sessionKey: activeSessionKey,
          sessionId,
          fastMode,
          message: text,
          messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }
      setMessages((prev) => {
        const rest = prev.filter((m) => !m.pending);
        return [...rest, { role: "assistant", content: String(payload.reply || ""), ts: Date.now() }];
      });
      setConnected(true);
    } catch (e: any) {
      setMessages((prev) => {
        const rest = prev.filter((m) => !m.pending);
        return [
          ...rest,
          { role: "system", content: `请求失败：${e?.message || "未知错误"}`, ts: Date.now() },
        ];
      });
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">加载中...</div>;
  }

  return (
    <main className="min-h-screen p-3 md:p-4 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="text-lg font-semibold">💬 专家战队聊天</div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <a
            href={webChatUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            title={webChatUrl || "请先选择专家"}
            className={`px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm hover:border-[var(--accent)] transition ${
              !webChatUrl ? "pointer-events-none opacity-50" : ""
            }`}
            onClick={(e) => {
              if (!webChatUrl) e.preventDefault();
            }}
          >
            WEB聊天模式
          </a>
          <Link
            href="/"
            className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm hover:border-[var(--accent)] transition"
          >
            返回首页
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="text-sm">
            <span className="text-[var(--text-muted)]">选择专家</span>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.emoji || "🤖"} {a.name} ({a.id})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="text-[var(--text-muted)]">选择会话</span>
            <select
              value={sessionKey}
              onChange={(e) => {
                const nextKey = e.target.value;
                setSessionKey(nextKey);
                const hit = sessions.find((s) => s.key === nextKey);
                setSessionId(hit?.sessionId || null);
              }}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
            >
              {sessionOptions.length === 0 ? (
                <option value={sessionKey || `agent:${agentId}:main`}>{sessionKey || `agent:${agentId}:main`}</option>
              ) : (
                sessionOptions.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void connectSession(false)}
            disabled={!agentId || connecting}
            className="px-3 py-2 rounded-lg border border-[var(--accent)]/45 bg-[var(--accent)]/18 text-[var(--text)] text-sm hover:bg-[var(--accent)]/26 disabled:opacity-50"
          >
            {connecting ? "连接中..." : "连接会话"}
          </button>
          <label className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={fastMode}
              onChange={(e) => setFastMode(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            极速模式
          </label>
          <span
            className={`text-xs ${
              connected ? "text-green-300" : sessionReady ? "text-cyan-300" : "text-[var(--text-muted)]"
            }`}
          >
            {connected ? "已连接" : sessionReady ? "会话已就绪" : "未连接"}
          </span>
          {fastMode && (
            <span className="text-[10px] text-amber-300">轻量会话 · 短回复</span>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 h-[56vh] overflow-auto space-y-1.5">
          {messages.length === 0 ? (
            <div className="text-xs text-[var(--text-muted)]">开始对话吧，消息将通过 Gateway 直接发送到当前选中会话。</div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={`${m.ts}-${idx}`}
                className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs leading-5 whitespace-pre-wrap ${
                  m.role === "user"
                    ? "ml-auto bg-[var(--accent)]/20 border border-[var(--accent)]/40"
                    : m.role === "assistant"
                      ? m.pending
                        ? "mr-auto bg-[var(--card)] border border-dashed border-[var(--border)] text-[var(--text-muted)] animate-pulse"
                        : "mr-auto bg-[var(--card)] border border-[var(--border)]"
                      : "mx-auto bg-red-500/15 border border-red-400/30 text-red-200"
                }`}
              >
                <div className="text-[9px] opacity-70 mb-0.5">
                  {m.role === "user" ? "你" : m.role === "assistant" ? "专家" : "系统"} · {timeText(m.ts)}
                </div>
                <div>{m.content}</div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            className="flex-1 min-h-[60px] max-h-56 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text)] resize-y"
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={sending || !input.trim() || !agentId || !sessionKey || !sessionReady}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-medium disabled:opacity-50"
          >
            {sending ? "发送中..." : "发送"}
          </button>
        </div>
        {error && <div className="text-xs text-red-300">{error}</div>}
      </div>
    </main>
  );
}

