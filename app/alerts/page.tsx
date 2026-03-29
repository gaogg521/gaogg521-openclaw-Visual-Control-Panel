"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

type AlertCheckResultItem = {
  incidentKey: string;
  message: string;
  severity?: "critical" | "warning" | "info";
  agentId?: string;
  lastActiveAt?: number;
  sessionRecordMs?: number;
  dirMtimeMs?: number;
  gatewayActivityMs?: number;
};

type AlertIncident = {
  id: string;
  incidentKey: string;
  message: string;
  agentId?: string;
  severity: "critical" | "warning" | "info";
  status: "active" | "acknowledged" | "snoozed" | "recovered";
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
  lastStatusChangeAt: number;
  snoozeUntil?: number;
};

type AlertSummary = {
  active: number;
  acknowledged: number;
  snoozed: number;
  recovered: number;
  critical: number;
  warning: number;
  info: number;
};

function normalizeAlertCheckResults(raw: unknown): AlertCheckResultItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") return { incidentKey: `legacy:${item}`, message: item };
    if (
      item &&
      typeof item === "object" &&
      typeof (item as AlertCheckResultItem).message === "string"
    ) {
      const o = item as AlertCheckResultItem;
      return {
        incidentKey:
          typeof (o as AlertCheckResultItem).incidentKey === "string"
            ? (o as AlertCheckResultItem).incidentKey
            : `legacy:${o.message}`,
        message: o.message,
        ...(typeof (o as AlertCheckResultItem).severity === "string"
          ? { severity: (o as AlertCheckResultItem).severity }
          : {}),
        ...(typeof o.agentId === "string" ? { agentId: o.agentId } : {}),
        ...(typeof o.lastActiveAt === "number" ? { lastActiveAt: o.lastActiveAt } : {}),
        ...(typeof (o as AlertCheckResultItem).sessionRecordMs === "number"
          ? { sessionRecordMs: (o as AlertCheckResultItem).sessionRecordMs }
          : {}),
        ...(typeof (o as AlertCheckResultItem).dirMtimeMs === "number"
          ? { dirMtimeMs: (o as AlertCheckResultItem).dirMtimeMs }
          : {}),
        ...(typeof (o as AlertCheckResultItem).gatewayActivityMs === "number"
          ? { gatewayActivityMs: (o as AlertCheckResultItem).gatewayActivityMs }
          : {}),
      };
    }
    return { incidentKey: `legacy:${String(item)}`, message: String(item) };
  });
}

interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  threshold?: number;
  targetAgents?: string[];
}

interface AlertConfig {
  enabled: boolean;
  receiveAgent: string;
  rules: AlertRule[];
  checkInterval?: number;
  incidents?: AlertIncident[];
  summary?: AlertSummary;
  snoozeByRuleMinutes?: Record<string, number>;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
}

const RULE_DESCRIPTIONS: Record<string, Record<string, string>> = {
  "zh-TW": {
    model_unavailable: "模型不可用 - 當測試模型失敗時觸發",
    bot_no_response: "Bot 長時間無回應 - 當專家超過設定時間未回應時觸發",
    message_failure_rate: "訊息失敗率升高 - 當訊息失敗率超過閾值時觸發",
    cron连续_failure: "Cron 連續失敗 - 當定時任務連續失敗超過設定次數時觸發",
  },
  zh: {
    model_unavailable: "模型不可用 - 当测试模型失败时触发",
    bot_no_response: "Bot 长时间无响应 - 当专家超过设定时间未响应时触发",
    message_failure_rate: "消息失败率升高 - 当消息失败率超过阈值时触发",
    cron连续_failure: "Cron 连续失败 - 当定时任务连续失败超过设定次数时触发",
  },
  en: {
    model_unavailable: "Model Unavailable - Triggered when model test fails",
    bot_no_response: "Bot Long Time No Response - Triggered when bot is inactive for set period",
    message_failure_rate: "Message Failure Rate High - Triggered when failure rate exceeds threshold",
    cron连续_failure: "Cron Continuous Failure - Triggered when cron jobs fail multiple times in a row",
  },
  ms: {
    model_unavailable: "Model tidak tersedia — dicetus apabila ujian model gagal",
    bot_no_response: "Bot tidak respons lama — dicetus apabila pakar tidak respons melebihi tempoh tetap",
    message_failure_rate: "Kadar kegagalan mesej tinggi — dicetus apabila kadar melebihi ambang",
    cron连续_failure: "Kegagalan berterusan Cron — dicetus apabila kerja cron gagal berturut-turut melebihi had",
  },
  id: {
    model_unavailable: "Model tidak tersedia — dipicu ketika uji model gagal",
    bot_no_response: "Bot tidak merespons lama — dipicu saat ahli tidak merespons melebihi waktu yang ditetapkan",
    message_failure_rate: "Tingkat kegagalan pesan tinggi — dipicu saat melebihi ambang",
    cron连续_failure: "Kegagalan beruntun Cron — dipicu saat tugas cron gagal berturut-turut melebihi batas",
  },
  th: {
    model_unavailable: "โมเดลไม่พร้อมใช้ — ทริกเมื่อทดสอบโมเดลล้มเหลว",
    bot_no_response: "บอทไม่ตอบนาน — ทริกเมื่อผู้เชี่ยวชาญไม่ตอบเกินเวลาที่ตั้ง",
    message_failure_rate: "อัตราข้อความล้มเหลวสูง — ทริกเมื่อเกินเกณฑ์",
    cron连续_failure: "Cron ล้มเหลวต่อเนื่อง — ทริกเมื่องาน cron ล้มเหลวติดต่อกันเกินจำนวนที่ตั้ง",
  },
};

function l10n6(
  locale: string,
  row: { en: string; zhTW: string; zh: string; ms: string; id: string; th: string }
) {
  switch (locale) {
    case "zh-TW":
      return row.zhTW;
    case "zh":
      return row.zh;
    case "ms":
      return row.ms;
    case "id":
      return row.id;
    case "th":
      return row.th;
    default:
      return row.en;
  }
}

export default function AlertsPage() {
  const { t, locale } = useI18n();
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResults, setCheckResults] = useState<AlertCheckResultItem[]>([]);
  const [incidents, setIncidents] = useState<AlertIncident[]>([]);
  const [summary, setSummary] = useState<AlertSummary>({
    active: 0,
    acknowledged: 0,
    snoozed: 0,
    recovered: 0,
    critical: 0,
    warning: 0,
    info: 0,
  });
  const [actingIncidentId, setActingIncidentId] = useState<string | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<string>("");
  const [checkInterval, setCheckInterval] = useState(10);
  const [snoozeByRuleMinutes, setSnoozeByRuleMinutes] = useState<Record<string, number>>({});

  // 从配置加载 checkInterval
  useEffect(() => {
    if (config?.checkInterval) {
      setCheckInterval(config.checkInterval);
    }
  }, [config?.checkInterval]);

  const ruleDescriptions =
    (RULE_DESCRIPTIONS as Record<string, Record<string, string>>)[locale] ?? RULE_DESCRIPTIONS.en;
  const timeLocale =
    locale === "zh-TW"
      ? "zh-TW"
      : locale === "zh"
        ? "zh-CN"
        : locale === "ms"
          ? "ms-MY"
          : locale === "id"
            ? "id-ID"
            : locale === "th"
              ? "th-TH"
              : "en-US";
  const ui = {
    minutes5: l10n6(locale, {
      en: "5 minutes",
      zhTW: "5 分鐘",
      zh: "5 分钟",
      ms: "5 minit",
      id: "5 menit",
      th: "5 นาที",
    }),
    minutes10: l10n6(locale, {
      en: "10 minutes",
      zhTW: "10 分鐘",
      zh: "10 分钟",
      ms: "10 minit",
      id: "10 menit",
      th: "10 นาที",
    }),
    minutes30: l10n6(locale, {
      en: "30 minutes",
      zhTW: "30 分鐘",
      zh: "30 分钟",
      ms: "30 minit",
      id: "30 menit",
      th: "30 นาที",
    }),
    hour1: l10n6(locale, {
      en: "1 hour",
      zhTW: "1 小時",
      zh: "1 小时",
      ms: "1 jam",
      id: "1 jam",
      th: "1 ชั่วโมง",
    }),
    hours2: l10n6(locale, {
      en: "2 hours",
      zhTW: "2 小時",
      zh: "2 小时",
      ms: "2 jam",
      id: "2 jam",
      th: "2 ชั่วโมง",
    }),
    hours5: l10n6(locale, {
      en: "5 hours",
      zhTW: "5 小時",
      zh: "5 小时",
      ms: "5 jam",
      id: "5 jam",
      th: "5 ชั่วโมง",
    }),
    checking: l10n6(locale, {
      en: "⏳ Checking...",
      zhTW: "⏳ 檢查中...",
      zh: "⏳ 检查中...",
      ms: "⏳ Menyemak...",
      id: "⏳ Memeriksa...",
      th: "⏳ กำลังตรวจสอบ...",
    }),
    checkNow: l10n6(locale, {
      en: "🔄 Check Now",
      zhTW: "🔄 立即檢查",
      zh: "🔄 立即检查",
      ms: "🔄 Semak sekarang",
      id: "🔄 Periksa sekarang",
      th: "🔄 ตรวจสอบทันที",
    }),
    alertsTriggered: l10n6(locale, {
      en: "⚠️ Alerts Triggered",
      zhTW: "⚠️ 警報觸發",
      zh: "⚠️ 告警触发",
      ms: "⚠️ Amaran dicetuskan",
      id: "⚠️ Peringatan dipicu",
      th: "⚠️ การแจ้งเตือนถูกทริก",
    }),
    checkingAlerts: l10n6(locale, {
      en: "⏳ Checking alerts...",
      zhTW: "⏳ 正在檢查警報...",
      zh: "⏳ 正在检查告警...",
      ms: "⏳ Menyemak amaran...",
      id: "⏳ Memeriksa peringatan...",
      th: "⏳ กำลังตรวจสอบการแจ้งเตือน...",
    }),
    timeout: l10n6(locale, {
      en: "Timeout (s):",
      zhTW: "超時 (秒):",
      zh: "超时 (秒):",
      ms: "Tamat masa (s):",
      id: "Batas waktu (dtk):",
      th: "หมดเวลา (วินาที):",
    }),
    failureRate: l10n6(locale, {
      en: "Failure rate (%):",
      zhTW: "失敗率 (%):",
      zh: "失败率 (%):",
      ms: "Kadar kegagalan (%):",
      id: "Tingkat kegagalan (%):",
      th: "อัตราความล้มเหลว (%):",
    }),
    maxFailures: l10n6(locale, {
      en: "Max failures:",
      zhTW: "最大失敗數:",
      zh: "最大失败数:",
      ms: "Kegagalan maks:",
      id: "Kegagalan maks:",
      th: "ความล้มเหลวสูงสุด:",
    }),
    threshold: l10n6(locale, {
      en: "Threshold:",
      zhTW: "閾值:",
      zh: "阈值:",
      ms: "Ambang:",
      id: "Ambang:",
      th: "เกณฑ์:",
    }),
    monitor: l10n6(locale, {
      en: "Monitor:",
      zhTW: "檢測專家戰隊:",
      zh: "检测专家战队:",
      ms: "Pantau skuad pakar:",
      id: "Pantau skuad ahli:",
      th: "ตรวจสอบทีมผู้เชี่ยวชาญ:",
    }),
    emptyMeansAll: l10n6(locale, {
      en: "(empty = all)",
      zhTW: "(不選則檢測所有)",
      zh: "(不选则检测所有)",
      ms: "(kosong = semua)",
      id: "(kosong = semua)",
      th: "(ว่าง = ทั้งหมด)",
    }),
    saved: l10n6(locale, {
      en: "Saved",
      zhTW: "已保存",
      zh: "已保存",
      ms: "Disimpan",
      id: "Disimpan",
      th: "บันทึกแล้ว",
    }),
  };

  // 加载配置
  useEffect(() => {
    Promise.all([
      fetch("/api/alerts").then((r) => r.json()),
      fetch("/api/config").then((r) => r.json()),
    ])
      .then(([alertData, configData]) => {
        setConfig(alertData);
        setAgents(configData.agents || []);
        setIncidents(Array.isArray(alertData?.incidents) ? alertData.incidents : []);
        setSnoozeByRuleMinutes(
          alertData?.snoozeByRuleMinutes && typeof alertData.snoozeByRuleMinutes === "object"
            ? alertData.snoozeByRuleMinutes
            : {}
        );
        if (alertData?.summary) {
          setSummary(alertData.summary);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // 定时检查告警（不自动触发，由用户点击按钮触发）
  useEffect(() => {
    if (!config?.enabled) return;
    
    const checkAlerts = () => {
      setChecking(true);
      fetch("/api/alerts/check", { method: "POST" })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setCheckResults(normalizeAlertCheckResults(data.results));
            setIncidents(Array.isArray(data.incidents) ? data.incidents : []);
            if (data.summary) setSummary(data.summary);
            setLastCheckTime(new Date().toLocaleTimeString(timeLocale));
          }
        })
        .catch(console.error)
        .finally(() => setChecking(false));
    };

    // 只设置定时器，不立即检查
    const timer = setInterval(checkAlerts, checkInterval * 60 * 1000);
    return () => clearInterval(timer);
  }, [config?.enabled, checkInterval, timeLocale]);

  const handleManualCheck = () => {
    setChecking(true);
    fetch("/api/alerts/check", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setCheckResults(normalizeAlertCheckResults(data.results));
          setIncidents(Array.isArray(data.incidents) ? data.incidents : []);
          if (data.summary) setSummary(data.summary);
          setLastCheckTime(new Date().toLocaleTimeString(timeLocale));
        }
      })
      .catch(console.error)
      .finally(() => setChecking(false));
  };

  const handleToggle = () => {
    if (!config) return;
    setSaving(true);
    fetch("/api/alerts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !config.enabled }),
    })
      .then((r) => r.json())
      .then((newConfig) => {
        setConfig(newConfig);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      })
      .finally(() => setSaving(false));
  };

  const handleAgentChange = (agentId: string) => {
    if (!config) return;
    setSaving(true);
    fetch("/api/alerts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiveAgent: agentId }),
    })
      .then((r) => r.json())
      .then((newConfig) => {
        setConfig(newConfig);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      })
      .finally(() => setSaving(false));
  };

  const handleIntervalChange = (value: number) => {
    if (!config) return;
    setCheckInterval(value);
    setSaving(true);
    fetch("/api/alerts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkInterval: value }),
    })
      .then((r) => r.json())
      .then((newConfig) => {
        setConfig(newConfig);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      })
      .finally(() => setSaving(false));
  };

  const handleRuleToggle = (ruleId: string) => {
    if (!config) return;
    const rules = config.rules.map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );
    setSaving(true);
    fetch("/api/alerts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules }),
    })
      .then((r) => r.json())
      .then((newConfig) => {
        setConfig(newConfig);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      })
      .finally(() => setSaving(false));
  };

  const handleThresholdChange = (ruleId: string, value: number) => {
    if (!config) return;
    const rules = config.rules.map((r) =>
      r.id === ruleId ? { ...r, threshold: value } : r
    );
    setSaving(true);
    fetch("/api/alerts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules }),
    })
      .then((r) => r.json())
      .then((newConfig) => {
        setConfig(newConfig);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      })
      .finally(() => setSaving(false));
  };

  const handleIncidentAction = async (
    incidentId: string,
    action: "ack" | "snooze" | "resolve" | "reopen",
    minutes?: number,
  ) => {
    setActingIncidentId(incidentId);
    try {
      const r = await fetch("/api/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentActions: [{ id: incidentId, action, ...(minutes ? { minutes } : {}) }],
        }),
      });
      if (!r.ok) return;
      const data = await r.json();
      setIncidents(Array.isArray(data.incidents) ? data.incidents : []);
      if (data.summary) setSummary(data.summary);
      if (config) setConfig({ ...config, incidents: data.incidents, summary: data.summary });
    } catch (err) {
      console.error(err);
    } finally {
      setActingIncidentId(null);
    }
  };

  const getRuleIdFromIncidentKey = (incidentKey: string) => {
    const idx = incidentKey.indexOf(":");
    return idx > 0 ? incidentKey.slice(0, idx) : incidentKey;
  };

  const handleRuleSnoozeMinutesChange = (ruleId: string, minutes: number) => {
    if (!config) return;
    const safe = Number.isFinite(minutes) ? Math.max(1, Math.floor(minutes)) : 30;
    const next = { ...snoozeByRuleMinutes, [ruleId]: safe };
    setSnoozeByRuleMinutes(next);
    setSaving(true);
    fetch("/api/alerts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snoozeByRuleMinutes: { [ruleId]: safe } }),
    })
      .then((r) => r.json())
      .then((newConfig) => {
        setConfig(newConfig);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      })
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)]">{t("common.loading")}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-400">{t("common.loadError")}</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-3 mb-6 md:mb-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            🔔 {t("alerts.title") || "Alert Center"}
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {t("alerts.subtitle") || "Configure system alerts and notifications"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* 检查间隔设置 */}
          {config.enabled && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">{t("alerts.checkInterval") || "Check Interval"}:</span>
              <select
                value={checkInterval}
                onChange={(e) => handleIntervalChange(Number(e.target.value))}
                className="px-2 py-1 text-sm rounded border border-[var(--border)] bg-[var(--card)] text-[var(--text)]"
              >
                <option value={5}>{ui.minutes5}</option>
                <option value={10}>{ui.minutes10}</option>
                <option value={30}>{ui.minutes30}</option>
                <option value={60}>{ui.hour1}</option>
                <option value={120}>{ui.hours2}</option>
                <option value={300}>{ui.hours5}</option>
              </select>
            </div>
          )}
          {/* 手动检查按钮 */}
          {config.enabled && (
            <button
              onClick={handleManualCheck}
              disabled={checking}
              className="px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition disabled:opacity-50"
            >
              {checking ? ui.checking : ui.checkNow}
            </button>
          )}
          <Link
            href="/expert-squad"
            className="px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition"
          >
            {t("common.backHome") || "Back"}
          </Link>
        </div>
      </div>

      {/* 检查结果展示 */}
      {config.enabled && checkResults.length > 0 && (
        <div className="p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-yellow-400">
              {ui.alertsTriggered} ({checkResults.length})
            </h3>
            {lastCheckTime && <span className="text-xs text-[var(--text-muted)]">{lastCheckTime}</span>}
          </div>
          {checkResults.some((r) => typeof r.lastActiveAt === "number" && r.lastActiveAt > 0) && (
            <p className="text-xs text-[var(--text-muted)] mb-2">{t("alerts.lastActiveNote")}</p>
          )}
          <ul className="space-y-2">
            {checkResults.map((result, i) => {
              const fmtTs = (ms?: number) =>
                ms && ms > 0
                  ? new Date(ms).toLocaleString(timeLocale, {
                      dateStyle: "short",
                      timeStyle: "medium",
                    })
                  : "—";
              const hasBreakdown = Boolean(result.agentId);
              return (
                <li key={i} className="text-sm text-yellow-300">
                  <span className="block">• {result.message}</span>
                  {typeof result.lastActiveAt === "number" && result.lastActiveAt > 0 && (
                    <span className="block mt-0.5 ml-3 text-xs text-yellow-200/85">
                      {t("alerts.lastActiveLabel")}{" "}
                      {fmtTs(result.lastActiveAt)}
                    </span>
                  )}
                  {hasBreakdown && (
                    <span className="block mt-1 ml-3 text-[11px] leading-snug text-[var(--text-muted)]">
                      {t("alerts.activitySources")}：{t("alerts.srcSession")}{" "}
                      {fmtTs(result.sessionRecordMs)} · {t("alerts.srcDirMtime")}{" "}
                      {fmtTs(result.dirMtimeMs)} · {t("alerts.srcGateway")}{" "}
                      {fmtTs(result.gatewayActivityMs)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {config.enabled && checking && (
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] mb-6 text-center text-[var(--text-muted)]">
          {ui.checkingAlerts}
        </div>
      )}

      {/* 告警闭环概览 */}
      {config.enabled && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10">
            <div className="text-xs text-[var(--text-muted)]">活跃</div>
            <div className="text-xl font-semibold text-red-300">{summary.active}</div>
          </div>
          <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10">
            <div className="text-xs text-[var(--text-muted)]">已确认</div>
            <div className="text-xl font-semibold text-blue-300">{summary.acknowledged}</div>
          </div>
          <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
            <div className="text-xs text-[var(--text-muted)]">静默中</div>
            <div className="text-xl font-semibold text-amber-300">{summary.snoozed}</div>
          </div>
          <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10">
            <div className="text-xs text-[var(--text-muted)]">已恢复</div>
            <div className="text-xl font-semibold text-green-300">{summary.recovered}</div>
          </div>
        </div>
      )}

      {/* 告警事件列表（确认 / 静默 / 恢复） */}
      {config.enabled && incidents.length > 0 && (
        <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] mb-6">
          <h2 className="text-lg font-semibold mb-3">告警事件闭环</h2>
          <div className="space-y-3 max-h-[360px] overflow-auto pr-1">
            {incidents.map((incident) => {
              const sevColor =
                incident.severity === "critical"
                  ? "text-red-300 border-red-500/30 bg-red-500/10"
                  : incident.severity === "warning"
                    ? "text-amber-300 border-amber-500/30 bg-amber-500/10"
                    : "text-blue-300 border-blue-500/30 bg-blue-500/10";
              const statusText =
                incident.status === "active"
                  ? "活跃"
                  : incident.status === "acknowledged"
                    ? "已确认"
                    : incident.status === "snoozed"
                      ? "静默中"
                      : "已恢复";
              return (
                <div key={incident.id} className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm">{incident.message}</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        状态：{statusText} · 触发次数：{incident.count} · 最近触发：
                        {new Date(incident.lastSeenAt).toLocaleString(timeLocale)}
                        {incident.agentId ? ` · Agent: ${incident.agentId}` : ""}
                      </div>
                      {incident.status === "snoozed" && incident.snoozeUntil ? (
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          静默至：{new Date(incident.snoozeUntil).toLocaleString(timeLocale)}
                        </div>
                      ) : null}
                    </div>
                    <span className={`text-[11px] px-2 py-1 rounded border ${sevColor}`}>
                      {incident.severity}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => void handleIncidentAction(incident.id, "ack")}
                      disabled={actingIncidentId === incident.id}
                      className="px-2.5 py-1.5 text-xs rounded border border-[var(--border)] hover:border-[var(--accent)]"
                    >
                      确认
                    </button>
                    <button
                      onClick={() =>
                        void handleIncidentAction(
                          incident.id,
                          "snooze",
                          snoozeByRuleMinutes[getRuleIdFromIncidentKey(incident.incidentKey)] || 30,
                        )
                      }
                      disabled={actingIncidentId === incident.id}
                      className="px-2.5 py-1.5 text-xs rounded border border-[var(--border)] hover:border-[var(--accent)]"
                    >
                      静默（按规则）
                    </button>
                    <button
                      onClick={() =>
                        void handleIncidentAction(
                          incident.id,
                          incident.status === "recovered" ? "reopen" : "resolve",
                        )
                      }
                      disabled={actingIncidentId === incident.id}
                      className="px-2.5 py-1.5 text-xs rounded border border-[var(--border)] hover:border-[var(--accent)]"
                    >
                      {incident.status === "recovered" ? "重新打开" : "标记恢复"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 告警总开关 */}
      <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("alerts.enableAlerts") || "Enable Alerts"}</h2>
            <p className="text-[var(--text-muted)] text-sm mt-1">
              {t("alerts.enableDesc") || "Turn on/off all alert notifications"}
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={saving}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              config.enabled ? "bg-green-500" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                config.enabled ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* 接收告警的机器人 */}
      <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] mb-6">
        <h2 className="text-lg font-semibold mb-3">{t("alerts.receiveAgent") || "Receive Alert Agent"}</h2>
        <div className="flex flex-wrap gap-2">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => handleAgentChange(agent.id)}
              disabled={!config.enabled || saving}
              className={`px-4 py-2 rounded-lg border transition ${
                config.receiveAgent === agent.id
                  ? "bg-[var(--accent)] text-[var(--bg)] border-[var(--accent)]"
                  : "bg-[var(--bg)] border-[var(--border)] hover:border-[var(--accent)]"
              } ${!config.enabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {agent.emoji} {agent.name}
            </button>
          ))}
        </div>
      </div>

      {/* 告警规则列表 */}
      <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <h2 className="text-lg font-semibold mb-3">{t("alerts.rules") || "Alert Rules"}</h2>
        <p className="text-[var(--text-muted)] text-sm mb-4">
          {t("alerts.rulesDesc") || "Configure which conditions trigger alerts"}
        </p>
        <div className="space-y-4">
          {config.rules.map((rule) => (
            <div
              key={rule.id}
              className="p-4 rounded-lg border border-[var(--border)] bg-[var(--bg)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleRuleToggle(rule.id)}
                    disabled={!config.enabled || saving}
                    className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                      rule.enabled ? "bg-green-500" : "bg-gray-600"
                    } ${!config.enabled ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        rule.enabled ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <div>
                    <h3 className="font-medium">{rule.name}</h3>
                    <p className="text-[var(--text-muted)] text-xs">
                      {ruleDescriptions[rule.id] || rule.id}
                    </p>
                  </div>
                </div>
                {rule.threshold !== undefined && rule.id !== "bot_no_response" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-muted)]">
                      {rule.id === "bot_no_response" ? ui.timeout :
                       rule.id === "message_failure_rate" ? ui.failureRate :
                       rule.id === "cron连续_failure" ? ui.maxFailures :
                       ui.threshold}
                    </span>
                    <input
                      type="number"
                      value={rule.threshold}
                      onChange={(e) => handleThresholdChange(rule.id, Number(e.target.value))}
                      disabled={!config.enabled || !rule.enabled || saving}
                      className="w-20 px-2 py-1 text-sm rounded border border-[var(--border)] bg-[var(--card)] text-[var(--text)] disabled:opacity-50"
                    />
                  </div>
                )}
                {rule.id === "bot_no_response" && rule.threshold !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-muted)]">
                      {ui.timeout}
                    </span>
                    <input
                      type="number"
                      value={rule.threshold}
                      onChange={(e) => handleThresholdChange(rule.id, Number(e.target.value))}
                      disabled={!config.enabled || !rule.enabled || saving}
                      className="w-20 px-2 py-1 text-sm rounded border border-[var(--border)] bg-[var(--card)] text-[var(--text)] disabled:opacity-50"
                    />
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span>静默时长（分钟）:</span>
                <input
                  type="number"
                  min={1}
                  value={snoozeByRuleMinutes[rule.id] ?? 30}
                  onChange={(e) => handleRuleSnoozeMinutesChange(rule.id, Number(e.target.value))}
                  disabled={!config.enabled || saving}
                  className="w-20 px-2 py-1 text-sm rounded border border-[var(--border)] bg-[var(--card)] text-[var(--text)] disabled:opacity-50"
                />
              </div>
              {/* bot_no_response 规则：选择要检测的机器人 */}
              {rule.id === "bot_no_response" && rule.enabled && (
                <div className="mt-3 pt-3 border-t border-[var(--border)]">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-[var(--text-muted)]">
                      {ui.monitor}
                    </span>
                    {agents.map((agent) => {
                      const selected = rule.targetAgents?.includes(agent.id) ?? true;
                      return (
                        <button
                          key={agent.id}
                          onClick={() => {
                            const currentAgents = rule.targetAgents || [];
                            const newAgents = selected
                              ? currentAgents.filter((id) => id !== agent.id)
                              : [...currentAgents, agent.id];
                            const finalAgents = newAgents.length === 0 && !rule.targetAgents 
                              ? agents.map(a => a.id)
                              : newAgents;
                            
                            const rules = config.rules.map((r) =>
                              r.id === rule.id ? { ...r, targetAgents: finalAgents } : r
                            );
                            setSaving(true);
                            fetch("/api/alerts", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ rules }),
                            })
                              .then((r) => r.json())
                              .then((newConfig) => {
                                setConfig(newConfig);
                                setSaved(true);
                                setTimeout(() => setSaved(false), 2000);
                              })
                              .finally(() => setSaving(false));
                          }}
                          disabled={!config.enabled || saving}
                          className={`px-2 py-1 text-xs rounded border transition ${
                            selected
                              ? "bg-[var(--accent)] text-[var(--bg)] border-[var(--accent)]"
                              : "bg-[var(--bg)] border-[var(--border)] hover:border-[var(--accent)]"
                          } disabled:opacity-50`}
                        >
                          {agent.emoji} {agent.name}
                        </button>
                      );
                    })}
                    <span className="text-xs text-[var(--text-muted)] ml-2">
                      {ui.emptyMeansAll}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 保存提示 */}
      {saved && (
        <div className="fixed bottom-8 right-8 px-4 py-2 rounded-lg bg-green-500 text-white text-sm animate-fade-in">
          ✓ {ui.saved}
        </div>
      )}
    </main>
  );
}
