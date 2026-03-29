"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** 告警后台检查：在 /setup 页面跳过，避免与 precheck subprocess 竞争 */
const SKIP_PATHS = ["/setup"];
/** 页面加载后延迟多少毫秒再发起首次检查（给 precheck 让路） */
const INITIAL_DELAY_MS = 8000;

export function AlertMonitor() {
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // /setup 页面不运行：precheck 也在用 subprocess，并发会互相干扰
    if (SKIP_PATHS.some((p) => pathname?.startsWith(p))) return;

    let cancelled = false;

    const checkAlerts = () => {
      if (cancelled) return;
      fetch("/api/alerts/check", { method: "POST" })
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data.results && data.results.length > 0) {
            console.log("[AlertMonitor] Alerts triggered:", data.results);
          }
        })
        .catch(() => {/* silent */});
    };

    fetch("/api/alerts")
      .then((r) => r.json())
      .then((config) => {
        if (cancelled || !config.enabled) return;
        // 延迟首次检查，让页面其他初始化（precheck 等）优先完成
        initTimerRef.current = setTimeout(() => {
          checkAlerts();
          timerRef.current = setInterval(checkAlerts, (config.checkInterval || 10) * 60 * 1000);
        }, INITIAL_DELAY_MS);
      })
      .catch(() => {/* silent */});

    return () => {
      cancelled = true;
      if (initTimerRef.current) clearTimeout(initTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pathname]);

  return null;
}
