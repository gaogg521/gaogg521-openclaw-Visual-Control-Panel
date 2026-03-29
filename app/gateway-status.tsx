"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface HealthResult {
  ok: boolean;
  error?: string;
  data?: any;
  webUrl?: string;
  openclawVersion?: string;
}

interface GatewayStatusProps {
  compact?: boolean;
  className?: string;
  hideIconOnMobile?: boolean;
}

export function GatewayStatus({ compact = false, className = "", hideIconOnMobile = false }: GatewayStatusProps) {
  const { t } = useI18n();
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [showError, setShowError] = useState(false);
  const [showVersionTip, setShowVersionTip] = useState(false);

  // 串行轮询：单次 /api/gateway-health 常 >10s，setInterval 会堆叠请求并重复 exec openclaw。
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
        try {
          const r = await fetch("/api/gateway-health");
          const d = await r.json();
          if (!cancelled) setHealth(d);
        } catch {
          if (!cancelled) setHealth({ ok: false, error: t("gateway.fetchError") });
        }
        if (cancelled) break;
        await sleep(10000);
      }
    })();
    return () => {
      cancelled = true;
      if (sleepTimer) clearTimeout(sleepTimer);
    };
  }, [t]);

  const gatewayTitle = health?.openclawVersion
    ? `ONE CLAW ${String(health.openclawVersion).replace(/\bOpenClaw\s*/gi, "").trim()}`
    : "ONE CLAW";
  const chatIcon = (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={compact ? "h-3.5 w-3.5" : "h-4 w-4"}
      fill="#22c55e"
    >
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2h11A2.5 2.5 0 0 1 20 4.5v8A2.5 2.5 0 0 1 17.5 15H10l-4.2 3.2c-.66.5-1.6.03-1.6-.8V15A2.5 2.5 0 0 1 2 12.5v-8A2.5 2.5 0 0 1 4.5 2Z" />
    </svg>
  );

  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className}`.trim()}>
      <a
        href="/chat"
        title={gatewayTitle}
        onMouseEnter={() => setShowVersionTip(true)}
        onMouseLeave={() => setShowVersionTip(false)}
        onFocus={() => setShowVersionTip(true)}
        onBlur={() => setShowVersionTip(false)}
        className={`inline-flex items-center gap-1 rounded-lg font-medium border transition-colors cursor-pointer whitespace-nowrap ${
          compact ? "px-2 py-1 text-[10px]" : "px-4 py-1.5 text-sm"
        } ${
          health?.ok
            ? "bg-amber-400/28 border-amber-300/80 text-amber-100 hover:bg-amber-300/38 hover:border-amber-200 shadow-[0_0_0_1px_rgba(251,191,36,0.15)]"
            : "bg-red-500/18 border-red-400/65 text-red-200 hover:bg-red-500/25 hover:border-red-300"
        }`}
      >
        <span className="inline-flex items-center gap-1 leading-none">
          {chatIcon}
          <span>{compact ? "聊" : "我要聊天"}</span>
        </span>
        <span className="opacity-50 text-[10px]">↗</span>
      </a>
      {showVersionTip && (
        <div className="absolute top-full left-0 mt-1 z-50 px-2 py-1 rounded-md bg-black/80 border border-white/10 text-white text-[10px] whitespace-nowrap shadow-lg pointer-events-none">
          {gatewayTitle}
        </div>
      )}
      {!health ? (
        <span
          className={compact
            ? "text-[10px] text-[var(--text-muted)]"
            : "inline-flex items-center justify-center min-w-[7.75rem] px-4 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--text-muted)] whitespace-nowrap"}
        >
          --
        </span>
      ) : health.ok ? (
        <span
          className={compact
            ? "text-green-400 text-xs cursor-help"
            : "inline-flex items-center justify-center gap-1 min-w-[7.75rem] px-4 py-1.5 rounded-lg border border-green-400/70 bg-green-500/20 text-green-200 text-sm cursor-help whitespace-nowrap"}
          title={t("gateway.healthy")}
        >
          ✅ 在线
        </span>
      ) : (
        <span
          className={compact
            ? "text-red-400 text-xs cursor-pointer"
            : "inline-flex items-center justify-center gap-1 min-w-[7.75rem] px-4 py-1.5 rounded-lg border border-red-400/70 bg-red-500/20 text-red-200 text-sm cursor-pointer whitespace-nowrap"}
          title={health.error || t("gateway.unhealthy")}
          onClick={() => setShowError((v) => !v)}
        >
          ❌ 异常
        </span>
      )}
      {showError && health && !health.ok && health.error && (
        <div className="absolute top-full left-0 mt-1 z-50 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs max-w-64 whitespace-pre-wrap shadow-lg">
          {health.error}
        </div>
      )}
    </div>
  );
}
