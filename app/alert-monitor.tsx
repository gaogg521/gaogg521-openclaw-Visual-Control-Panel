"use client";

import { useEffect, useState } from "react";

// 后台告警检查组件 - 服务启动时自动开始
export function AlertMonitor() {
  const [enabled, setEnabled] = useState(false);
  const [checkInterval, setCheckInterval] = useState(10);
  const [lastResults, setLastResults] = useState<string[]>([]);

  useEffect(() => {
    // 加载配置并启动检查
    fetch("/api/alerts")
      .then(r => r.json())
      .then(config => {
        if (config.enabled) {
          setEnabled(true);
          // 检查函数
          const checkAlerts = () => {
            fetch("/api/alerts/check", { method: "POST" })
              .then(r => r.json())
              .then(data => {
                if (data.results && data.results.length > 0) {
                  setLastResults(data.results);
                  console.log("[AlertMonitor] Alerts triggered:", data.results);
                }
              })
              .catch(console.error);
          };
          
          // 立即检查一次
          checkAlerts();
          
          // 设置定时器
          const timer = setInterval(checkAlerts, (config.checkInterval || 10) * 60 * 1000);
          return () => clearInterval(timer);
        }
      })
      .catch(console.error);
  }, []);

  // 不渲染任何内容，只在后台运行
  return null;
}
