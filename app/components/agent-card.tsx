"use client";

import { useEffect, useState } from "react";
import { buildGatewayUrl } from "@/lib/gateway-url";

export interface AgentPlatform {
  name: string;
  accountId?: string;
  appId?: string;
  botOpenId?: string;
  botUserId?: string;
}

export interface AgentCardSession {
  lastActive: number | null;
  totalTokens: number;
  contextTokens: number;
  sessionCount: number;
  todayAvgResponseMs: number;
  messageCount: number;
  weeklyResponseMs: number[];
  weeklyTokens: number[];
}

export interface AgentCardAgent {
  id: string;
  name: string;
  emoji: string;
  model: string;
  platforms: AgentPlatform[];
  session?: AgentCardSession;
}

export interface AgentModelOptionGroup {
  providerId: string;
  providerName: string;
  accessMode?: "auth" | "api_key";
  models: Array<{ id: string; name: string }>;
}

export interface PlatformTestResult {
  ok: boolean;
  reply?: string;
  detail?: string;
  error?: string;
  elapsed: number;
}

export interface AgentModelTestResult {
  ok: boolean;
  text?: string;
  error?: string;
  elapsed: number;
}

export interface AgentSessionTestResult {
  ok: boolean;
  reply?: string;
  error?: string;
  elapsed: number;
}

interface SessionPreviewItem {
  key: string;
  type: string;
  updatedAt: number;
  totalTokens: number;
}

type TFunc = (key: string) => string;

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

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function ErrorStatusWithCopy({ error, className }: { error?: string; className?: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const errorText = (error || "Unknown error").trim() || "Unknown error";

  const onCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await copyText(errorText);
    setCopyState(ok ? "copied" : "failed");
  };

  return (
    <span
      className={`group relative inline-flex items-center ${className || ""}`}
      onMouseLeave={() => setCopyState("idle")}
    >
      <span className="text-red-400 text-sm cursor-help">❌</span>
      <span
        aria-hidden="true"
        className="absolute left-full top-1/2 z-40 hidden h-8 w-2 -translate-y-1/2 bg-transparent group-hover:block group-focus-within:block"
      />
      <span className="absolute left-full top-1/2 z-50 ml-2 hidden w-max max-w-[min(24rem,calc(100vw-1rem))] -translate-y-1/2 rounded-md border border-red-500/30 bg-[var(--card)] px-2 py-1.5 text-xs text-[var(--text)] shadow-lg group-hover:block group-focus-within:block">
        <span className="inline-flex items-start gap-1.5">
          <span className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={onCopy}
              className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--accent)]"
            >
              {copyState === "copied" ? "已复制" : "复制"}
            </button>
            {copyState === "failed" && (
              <span className="text-[10px] text-amber-300">复制失败</span>
            )}
          </span>
          <span className="whitespace-pre-wrap break-words">{errorText}</span>
        </span>
      </span>
    </span>
  );
}

function PlatformBadge({
  platform,
  agentId,
  gatewayPort,
  gatewayToken,
  gatewayHost,
  t,
  testResult,
}: {
  platform: AgentPlatform;
  agentId: string;
  gatewayPort: number;
  gatewayToken?: string;
  gatewayHost?: string;
  t: TFunc;
  testResult?: PlatformTestResult | null;
}) {
  const pName = platform.name;
  const badgeWidthClass = "w-[8.25rem]";
  const knownMeta: Record<string, { remoteLogoSrc: string; logoFallbackSrc: string; badgeStyle: string; logoSizeClass?: string }> = {
    feishu: {
      remoteLogoSrc: "https://cdn.simpleicons.org/lark/2E5BFF",
      logoFallbackSrc: "/assets/platform-logos/feishu-favicon.png?v=1",
      badgeStyle: "bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/40 hover:border-blue-400",
      logoSizeClass: "w-[1.09375rem] h-[1.09375rem]",
    },
    yuanbao: {
      remoteLogoSrc: "https://cdn-hybrid-prod.hunyuan.tencent.com/manual/favicon.png",
      logoFallbackSrc: "/assets/platform-logos/yuanbao-favicon.png?v=1",
      badgeStyle: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/40 hover:border-cyan-400",
    },
    discord: {
      remoteLogoSrc: "https://cdn.simpleicons.org/discord/5865F2",
      logoFallbackSrc: "/assets/platform-logos/discord.svg",
      badgeStyle: "bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/40 hover:border-purple-400",
    },
    telegram: {
      remoteLogoSrc: "https://cdn.simpleicons.org/telegram/26A5E4",
      logoFallbackSrc: "/assets/platform-logos/telegram.svg",
      badgeStyle: "bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/40 hover:border-sky-400",
    },
    whatsapp: {
      remoteLogoSrc: "https://cdn.simpleicons.org/whatsapp/25D366",
      logoFallbackSrc: "/assets/platform-logos/whatsapp.svg",
      badgeStyle: "bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/40 hover:border-green-400",
    },
    qqbot: {
      remoteLogoSrc: "/assets/platform-logos/qq-favicon.ico?v=1",
      logoFallbackSrc: "/assets/platform-logos/qq-favicon.ico?v=1",
      badgeStyle: "bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/40 hover:border-blue-400",
    },
  };
  const meta = knownMeta[pName];
  const logoSizeClass = meta?.logoSizeClass || "w-3.5 h-3.5";

  let sessionKey: string;
  if (pName === "feishu" && platform.botOpenId) {
    sessionKey = `agent:${agentId}:feishu:direct:${platform.botOpenId}`;
  } else if (platform.botUserId) {
    sessionKey = `agent:${agentId}:${pName}:direct:${platform.botUserId}`;
  } else {
    sessionKey = `agent:${agentId}:main`;
  }
  let sessionUrl = buildGatewayUrl(gatewayPort, "/chat", { session: sessionKey }, gatewayHost);
  if (gatewayToken) sessionUrl = buildGatewayUrl(gatewayPort, "/chat", { session: sessionKey, token: gatewayToken }, gatewayHost);

  const badgeStyle = meta?.badgeStyle || "bg-gray-500/20 text-gray-300 border border-gray-500/30 hover:bg-gray-500/40 hover:border-gray-400";
  const translated = t(`platform.${pName}`);
  const labelRaw = translated !== `platform.${pName}` ? translated : pName;
  const label = labelRaw.replace(/^[^\p{L}\p{N}]+/u, "").trim() || pName;

  return (
    <div className="inline-flex items-center gap-1.5 max-w-full">
      <a
        href={sessionUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={t("agent.openChat")}
        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all hover:scale-105 hover:shadow-md min-w-0 ${badgeWidthClass} ${badgeStyle}`}
      >
        {meta ? (
          <img
            src={meta.remoteLogoSrc}
            alt={`${label} logo`}
            className={`${logoSizeClass} shrink-0`}
            onError={(e) => {
              if (e.currentTarget.dataset.fallbackApplied === "1") return;
              e.currentTarget.dataset.fallbackApplied = "1";
              e.currentTarget.src = meta.logoFallbackSrc;
            }}
          />
        ) : (
          <span className="inline-flex w-3.5 h-3.5 items-center justify-center rounded bg-white/10 text-[9px] font-semibold shrink-0">
            {pName.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="shrink-0">{label}</span>
        {pName === "feishu" && platform.accountId && (
          <span className="opacity-60 truncate max-w-[4.5rem]">({platform.accountId})</span>
        )}
        <span className="opacity-50 text-[10px]">↗</span>
      </a>
      {testResult === undefined ? (
        <span className="inline-flex w-5 justify-end text-xs text-[var(--text-muted)]">--</span>
      ) : testResult === null ? (
        <span className="inline-flex w-5 justify-end text-xs text-[var(--text-muted)] animate-pulse">⏳</span>
      ) : testResult.ok ? (
        <span className="inline-flex w-5 justify-end text-green-400 text-sm cursor-help" title={`${testResult.elapsed}ms${testResult.detail ? " · " + testResult.detail : testResult.reply ? " · " + testResult.reply : ""}`}>✅</span>
      ) : (
        <ErrorStatusWithCopy error={testResult.error} className="w-5 justify-end" />
      )}
    </div>
  );
}

export function ModelBadge({ model, accessMode }: { model: string; accessMode?: "auth" | "api_key" }) {
  const [provider, modelName] = model.includes("/")
    ? model.split("/", 2)
    : ["default", model];

  const colors: Record<string, string> = {
    "yunyi-claude": "bg-green-500/20 text-green-300 border-green-500/30",
    minimax: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    volcengine: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    bailian: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
        colors[provider] || "bg-gray-500/20 text-gray-300 border-gray-500/30"
      }`}
    >
      {modelName}{accessMode ? ` (${accessMode})` : ""}
    </span>
  );
}

function MiniSparkline({ data, width = 120, height = 24, color: fixedColor }: { data: number[]; width?: number; height?: number; color?: string }) {
  const hasData = data.some(v => v > 0);
  if (!hasData) return null;

  const validValues = data.filter(v => v > 0);
  let trending: "up" | "down" | "flat" = "flat";
  if (validValues.length >= 2) {
    const last = validValues[validValues.length - 1];
    const prev = validValues[validValues.length - 2];
    trending = last > prev ? "up" : last < prev ? "down" : "flat";
  }
  const color = fixedColor || (trending === "up" ? "#f87171" : trending === "down" ? "#4ade80" : "#f59e0b");

  const max = Math.max(...data);
  const min = Math.min(...data.filter(v => v > 0), max);
  const range = max - min || 1;
  const pad = 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = v === 0 ? height - pad : (height - pad) - ((v - min) / range) * (height - pad * 2 - 2);
    return { x, y, v };
  });
  const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${pts[0].x},${height} ${line} ${pts[pts.length - 1].x},${height}`;
  const id = `spark-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <span className="inline-flex items-center gap-1">
      <svg width={width} height={height} className="inline-block align-middle" aria-label={data.map(v => v ? formatMs(v) : "-").join(" → ")}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${id})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {pts.filter((p) => p.v > 0).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2} fill={color} opacity={0.9} />
        ))}
      </svg>
    </span>
  );
}

function AgentStatusBadge({ state, t }: { state?: string; t: TFunc }) {
  const config: Record<string, { dot: string; text: string; color: string; pulse?: boolean }> = {
    working: { dot: "bg-green-400", text: t("agent.status.working"), color: "text-green-400", pulse: true },
    online: { dot: "bg-green-400", text: t("agent.status.online"), color: "text-green-400" },
    idle: { dot: "bg-yellow-400", text: t("agent.status.idle"), color: "text-yellow-400" },
    offline: { dot: "bg-red-400", text: t("agent.status.offline"), color: "text-red-400" },
  };
  const c = config[state || "offline"] || config.offline;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${c.color}`}>
      <span className={`w-2.5 h-2.5 rounded-full ${c.dot} ${c.pulse ? "animate-pulse" : ""}`} />
      {c.text}
    </span>
  );
}

export function AgentCard({
  agent,
  gatewayPort,
  gatewayToken,
  gatewayHost,
  t,
  testResult,
  platformTestResults,
  sessionTestResult,
  agentState,
  dmSessionResults,
  providerAccessModeMap,
  modelOptions,
  onModelChange,
}: {
  agent: AgentCardAgent;
  gatewayPort: number;
  gatewayToken?: string;
  gatewayHost?: string;
  t: TFunc;
  testResult?: AgentModelTestResult | null;
  platformTestResults?: Record<string, PlatformTestResult | null>;
  sessionTestResult?: AgentSessionTestResult | null;
  agentState?: string;
  dmSessionResults?: Record<string, PlatformTestResult | null>;
  providerAccessModeMap?: Record<string, "auth" | "api_key">;
  modelOptions?: AgentModelOptionGroup[];
  onModelChange?: (agentId: string, model: string) => Promise<void>;
}) {
  const [isEditingModel, setIsEditingModel] = useState(false);
  const [draftModel, setDraftModel] = useState(agent.model);
  const [isSavingModel, setIsSavingModel] = useState(false);
  const [modelSaveError, setModelSaveError] = useState<string | null>(null);
  const [sessionPreviewOpen, setSessionPreviewOpen] = useState(false);
  const [sessionPreviewLoading, setSessionPreviewLoading] = useState(false);
  const [sessionPreviewError, setSessionPreviewError] = useState<string | null>(null);
  const [sessionPreviewItems, setSessionPreviewItems] = useState<SessionPreviewItem[] | null>(null);
  const sessionKey = `agent:${agent.id}:main`;
  let sessionUrl = buildGatewayUrl(gatewayPort, "/chat", { session: sessionKey }, gatewayHost);
  if (gatewayToken) sessionUrl = buildGatewayUrl(gatewayPort, "/chat", { session: sessionKey, token: gatewayToken }, gatewayHost);
  const modelProvider = agent.model.includes("/") ? agent.model.split("/", 1)[0] : "default";
  const modelAccessMode = providerAccessModeMap?.[modelProvider];
  const canSwitchModel = !!onModelChange && !!modelOptions && modelOptions.length > 0;
  const knownModelRefs = new Set(
    (modelOptions || []).flatMap((group) => group.models.map((model) => `${group.providerId}/${model.id}`)),
  );
  const currentModelKnown = knownModelRefs.has(agent.model);

  useEffect(() => {
    if (!isEditingModel) {
      setDraftModel(agent.model);
      setModelSaveError(null);
    }
  }, [agent.model, isEditingModel]);

  useEffect(() => {
    setSessionPreviewItems(null);
    setSessionPreviewError(null);
    setSessionPreviewOpen(false);
    setSessionPreviewLoading(false);
  }, [agent.id]);

  function formatTimeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("common.justNow");
    if (mins < 60) return `${mins} ${t("common.minutesAgo")}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ${t("common.hoursAgo")}`;
    const days = Math.floor(hours / 24);
    return `${days} ${t("common.daysAgo")}`;
  }

  async function handleModelSave(): Promise<void> {
    if (!onModelChange || !draftModel || draftModel === agent.model) return;
    setIsSavingModel(true);
    setModelSaveError(null);
    try {
      await onModelChange(agent.id, draftModel);
      setIsEditingModel(false);
    } catch (err: any) {
      setModelSaveError(err?.message || t("agent.modelApplyFailed"));
    } finally {
      setIsSavingModel(false);
    }
  }

  async function loadSessionPreview(): Promise<void> {
    if (sessionPreviewLoading || sessionPreviewItems) return;
    setSessionPreviewLoading(true);
    setSessionPreviewError(null);
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(agent.id)}`, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok || payload?.error) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }
      const list = Array.isArray(payload?.sessions) ? payload.sessions : [];
      setSessionPreviewItems(list.slice(0, 8).map((item: any) => ({
        key: String(item?.key || ""),
        type: String(item?.type || "unknown"),
        updatedAt: Number(item?.updatedAt || 0),
        totalTokens: Number(item?.totalTokens || 0),
      })));
    } catch (err: any) {
      setSessionPreviewError(err?.message || "读取会话失败");
      setSessionPreviewItems([]);
    } finally {
      setSessionPreviewLoading(false);
    }
  }

  return (
    <div
      className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5 hover:border-[var(--accent)] transition-colors"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xl">{agent.emoji}</span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[var(--text)]">{agent.name} <span className="font-normal text-[var(--text-muted)]">({agent.id})</span></h3>
        </div>
        <AgentStatusBadge state={agentState} t={t} />
      </div>

      <div className="space-y-1">
        <div>
          <span className="text-xs text-[var(--text-muted)] block">Agent ID</span>
          <div className="flex items-center gap-2">
            <span
              className="relative inline-flex"
              onMouseEnter={() => {
                setSessionPreviewOpen(true);
                void loadSessionPreview();
              }}
              onMouseLeave={() => setSessionPreviewOpen(false)}
            >
              <a href={sessionUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all hover:scale-105 hover:shadow-md bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30 hover:bg-[var(--accent)]/40">
                {agent.id}
                <span className="opacity-50 text-[10px]">↗</span>
              </a>
              {sessionPreviewOpen && (
                <div className="absolute left-0 top-[calc(100%+6px)] z-40 w-[20rem] max-w-[min(92vw,20rem)] rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 shadow-xl">
                  <div className="mb-1 text-[11px] font-semibold text-[var(--text-muted)]">
                    会话预览（{agent.id}）
                  </div>
                  {sessionPreviewLoading ? (
                    <div className="text-xs text-[var(--text-muted)]">加载中...</div>
                  ) : sessionPreviewError ? (
                    <div className="text-xs text-red-400">{sessionPreviewError}</div>
                  ) : !sessionPreviewItems || sessionPreviewItems.length === 0 ? (
                    <div className="text-xs text-[var(--text-muted)]">暂无会话</div>
                  ) : (
                    <div className="max-h-56 overflow-auto space-y-1">
                      {sessionPreviewItems.map((s) => (
                        <div key={s.key} className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                              {s.type}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {s.updatedAt ? formatTimeAgo(s.updatedAt) : "-"}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-[var(--text)] truncate" title={s.key}>
                            {s.key}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            tokens: {formatTokens(s.totalTokens || 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </span>
            {sessionTestResult === undefined ? (
              <span className="text-xs text-[var(--text-muted)]">--</span>
            ) : sessionTestResult === null ? (
              <span className="text-xs text-[var(--text-muted)] animate-pulse">⏳</span>
            ) : sessionTestResult.ok ? (
              <span className="text-green-400 text-sm cursor-help" title={`${sessionTestResult.elapsed}ms${sessionTestResult.reply ? " · " + sessionTestResult.reply : ""}`}>✅</span>
            ) : (
              <span
                className="text-xs text-[var(--text-muted)] cursor-help"
                title={sessionTestResult.error || "会话测试失败"}
              >
                --
              </span>
            )}
          </div>
        </div>
        <div>
          <span className="text-xs text-[var(--text-muted)] block">{t("agent.model")}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <ModelBadge model={agent.model} accessMode={modelAccessMode} />
            {testResult === undefined ? (
              <span className="text-xs text-[var(--text-muted)]">--</span>
            ) : testResult === null ? (
              <span className="text-xs text-[var(--text-muted)] animate-pulse">⏳</span>
            ) : testResult.ok ? (
              <span className="text-green-400 text-sm" title={`${testResult.elapsed}ms${testResult.text ? " · " + testResult.text : ""}`}>✅</span>
            ) : (
              <span
                className="text-xs text-[var(--text-muted)] cursor-help"
                title={testResult.error || "模型测试失败"}
              >
                --
              </span>
            )}
            {canSwitchModel && !isEditingModel && (
              <button
                type="button"
                onClick={() => {
                  setDraftModel(agent.model);
                  setModelSaveError(null);
                  setIsEditingModel(true);
                }}
                className="px-2 py-0.5 rounded-full text-xs border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition"
              >
                {t("agent.switchModel")}
              </button>
            )}
          </div>
          {canSwitchModel && isEditingModel && (
            <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 space-y-2">
              <select
                value={draftModel}
                onChange={(e) => setDraftModel(e.target.value)}
                disabled={isSavingModel}
                className="w-full px-2 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--text)]"
              >
                {!currentModelKnown && (
                  <option value={agent.model}>{`${t("agent.currentUnknownModel")}: ${agent.model}`}</option>
                )}
                {(modelOptions || []).map((group) => (
                  <optgroup key={group.providerId} label={group.providerName}>
                    {group.models.map((model) => (
                      <option key={`${group.providerId}/${model.id}`} value={`${group.providerId}/${model.id}`}>
                        {`${group.providerId} / ${model.name || model.id}`}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleModelSave()}
                  disabled={isSavingModel || !draftModel || draftModel === agent.model}
                  className="px-3 py-1.5 rounded-lg text-xs bg-[var(--accent)] text-[var(--bg)] disabled:opacity-50"
                >
                  {isSavingModel ? t("agent.modelSaving") : t("agent.saveModel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftModel(agent.model);
                    setModelSaveError(null);
                    setIsEditingModel(false);
                  }}
                  disabled={isSavingModel}
                  className="px-3 py-1.5 rounded-lg text-xs border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition disabled:opacity-50"
                >
                  {t("agent.cancelModel")}
                </button>
              </div>
              <p className="text-[10px] text-[var(--text-muted)]">
                {t("agent.modelApplyHint")}
              </p>
              {modelSaveError && (
                <p className="text-xs text-red-400">{modelSaveError}</p>
              )}
            </div>
          )}
        </div>

        <div>
          <span className="text-xs text-[var(--text-muted)] block">{t("agent.platform")}</span>
          <div className="flex flex-col gap-1">
            {agent.platforms.map((p, i) => {
              const pKey = `${agent.id}:${p.name}`;
              const pResult = platformTestResults ? platformTestResults[pKey] : undefined;
              const dmKey = `${agent.id}:${p.name}`;
              const dmResult = dmSessionResults ? dmSessionResults[dmKey] : undefined;
              return (
                <div key={i} className="grid grid-cols-2 items-center gap-2">
                  <PlatformBadge platform={p} agentId={agent.id} gatewayPort={gatewayPort} gatewayToken={gatewayToken} gatewayHost={gatewayHost} t={t} testResult={pResult} />
                  <div className="flex justify-end">
                    {dmResult === undefined ? (
                      <span className="text-sm text-[var(--text-muted)]">DM Session: --</span>
                    ) : dmResult === null ? (
                      <span className="text-sm text-[var(--text-muted)] animate-pulse">DM Session: ⏳</span>
                    ) : dmResult.ok ? (
                      <span className="text-green-400 text-sm cursor-help" title={`DM Session ${dmResult.elapsed}ms${dmResult.detail ? " · " + dmResult.detail : ""}`}>DM Session: ✅</span>
                    ) : (
                      <span className="text-red-400 text-sm inline-flex items-center gap-1">
                        DM Session:
                        <ErrorStatusWithCopy error={dmResult.error} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {agent.session && (
          <div className="pt-1 mt-1 border-t border-[var(--border)]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)]">{t("agent.sessionCount")}</span>
              <div className="flex items-center gap-2">
                <a
                  href={`/sessions?agent=${agent.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[var(--accent)] hover:underline cursor-pointer"
                >
                  {agent.session.sessionCount} →
                </a>
                <a
                  href={`/stats?agent=${agent.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[var(--accent)] hover:underline cursor-pointer text-[10px]"
                >
                  📊 {t("agent.stats")}
                </a>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-[var(--text-muted)]">{t("agent.messageCount")}</span>
              <span className="text-[var(--text)]">{agent.session.messageCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-[var(--text-muted)]">{t("agent.tokenUsage")}</span>
              {agent.session.weeklyTokens && <MiniSparkline data={agent.session.weeklyTokens} color="#4ade80" />}
              <span className="text-[var(--text)] cursor-help" title={t("agent.totalTokenTip")}>{formatTokens(agent.session.totalTokens)}</span>
            </div>
            {agent.session.lastActive && (
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-[var(--text-muted)]">{t("agent.lastActive")}</span>
                <span className="text-[var(--text)]">{formatTimeAgo(agent.session.lastActive)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-[var(--text-muted)]">{t("agent.todayAvgResponse")}</span>
              {agent.session.weeklyResponseMs && <MiniSparkline data={agent.session.weeklyResponseMs} />}
              {(() => {
                const val = agent.session.todayAvgResponseMs;
                const weekly = agent.session.weeklyResponseMs || [];
                const validVals = weekly.filter(v => v > 0);
                let arrow = "";
                if (validVals.length >= 2) {
                  const last = validVals[validVals.length - 1];
                  const prev = validVals[validVals.length - 2];
                  arrow = last > prev ? "↗" : last < prev ? "↘" : "";
                }
                const colorClass = !val ? "text-[var(--text-muted)]"
                  : val > 50000 ? "text-red-400"
                  : val > 30000 ? "text-yellow-400"
                  : "text-green-400";
                return (
                  <span title={t("agent.todayAvgResponseTip")} className={`font-mono cursor-help ${colorClass}`}>
                    {val ? formatMs(val) : "--"}{arrow && <span className="ml-0.5">{arrow}</span>}
                  </span>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
