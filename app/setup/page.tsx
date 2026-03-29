"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

const SETUP_BRAND_LOGO = "/brand-mark.png";

/** CLI 仍可能回傳 “OpenClaw x.y.z”，展示時統一為產品名 ONE CLAW */
function brandCliVersionLine(version: string): string {
  return version.replace(/\bOpenClaw\b/gi, "ONE CLAW");
}

type Step = 0 | 1 | 2 | 3 | 4;
type ProviderId = "anthropic" | "openai" | "google" | "kimi" | "custom" | "ollama";

type PrecheckState = "loading" | "ok" | "missing" | "blocked";

type PrecheckMissingPayload = {
  resolvedExecutable?: string | null;
  resolvedMjs?: boolean;
  hintEnv?: string;
  docsUrl?: string;
  error?: string;
  detail?: string;
  reason?: string;
  configReady?: boolean;
  configPath?: string;
};

type OneClickInstallResult = {
  ok?: boolean;
  message?: string;
  error?: string;
  stdout?: string;
  stderr?: string;
  command?: string;
  manualCommand?: string;
  downloadPathHints?: string[];
};
type InstallPhase = "idle" | "preparing" | "installing" | "detecting" | "done" | "failed";
type SetupFunnelStats = {
  viewMissing: number;
  oneClickOpenConsent: number;
  oneClickConsentAgree: number;
  oneClickConsentCancel: number;
  oneClickInstallStart: number;
  oneClickInstallSuccess: number;
  oneClickInstallFail: number;
  oneClickDetectSuccess: number;
  oneClickDetectPending: number;
  nextActionClick: number;
  lastEventAt: number | null;
};

const FUNNEL_STORAGE_KEY = "oneclaw.setup.funnel.v1";
const EMPTY_FUNNEL: SetupFunnelStats = {
  viewMissing: 0,
  oneClickOpenConsent: 0,
  oneClickConsentAgree: 0,
  oneClickConsentCancel: 0,
  oneClickInstallStart: 0,
  oneClickInstallSuccess: 0,
  oneClickInstallFail: 0,
  oneClickDetectSuccess: 0,
  oneClickDetectPending: 0,
  nextActionClick: 0,
  lastEventAt: null,
};

function readFunnelStats(): SetupFunnelStats {
  if (typeof window === "undefined") return { ...EMPTY_FUNNEL };
  try {
    const raw = localStorage.getItem(FUNNEL_STORAGE_KEY);
    if (!raw) return { ...EMPTY_FUNNEL };
    const parsed = JSON.parse(raw) as Partial<SetupFunnelStats>;
    return { ...EMPTY_FUNNEL, ...parsed };
  } catch {
    return { ...EMPTY_FUNNEL };
  }
}

function writeFunnelStats(next: SetupFunnelStats): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FUNNEL_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
}

const OFFICIAL_CMD_WINDOWS = "iwr -useb https://openclaw.ai/install.ps1 | iex";
const OFFICIAL_CMD_UNIX = "curl -fsSL https://openclaw.ai/install.sh | bash";
const PKG_SCRIPT_WIN = "packaging/openclaw-oneclick/scripts/install-openclaw-windows.ps1";
const PKG_SCRIPT_UNIX = "packaging/openclaw-oneclick/scripts/install-openclaw-macos-linux.sh";
const PRECHECK_TIMEOUT_MS = 12000;

const PROVIDERS: { id: ProviderId; labelKey: string }[] = [
  { id: "anthropic", labelKey: "setup.providerAnthropic" },
  { id: "kimi", labelKey: "setup.providerKimi" },
  { id: "openai", labelKey: "setup.providerOpenAI" },
  { id: "google", labelKey: "setup.providerGoogle" },
  { id: "custom", labelKey: "setup.providerCustom" },
  { id: "ollama", labelKey: "setup.providerOllama" },
];

function WizardProgress({ step, t }: { step: Step; t: (key: string) => string }) {
  const items: { n: Step; key: string }[] = [
    { n: 0, key: "setup.progress.start" },
    { n: 1, key: "setup.progress.provider" },
    { n: 2, key: "setup.progress.credentials" },
    { n: 3, key: "setup.progress.confirm" },
    { n: 4, key: "setup.progress.done" },
  ];
  return (
    <nav
      aria-label="Setup"
      className="mb-6 flex flex-wrap items-center justify-center gap-y-2 gap-x-0.5 sm:gap-x-1.5 text-[9px] sm:text-[11px]"
    >
      {items.map((it, idx) => (
        <div key={it.n} className="flex items-center gap-1 sm:gap-2">
          {idx > 0 ? <span className="text-[var(--text-muted)]/35 select-none" aria-hidden>→</span> : null}
          <span
            className={`rounded-full px-2 py-1 sm:px-2.5 font-medium transition ${
              step === it.n
                ? "bg-red-600/25 text-red-100 ring-1 ring-red-500/45"
                : step > it.n
                  ? "text-emerald-400/95"
                  : "text-[var(--text-muted)]/65"
            }`}
          >
            {step > it.n ? "✓ " : ""}
            {t(it.key)}
          </span>
        </div>
      ))}
    </nav>
  );
}

function CopyCmdRow({
  id,
  label,
  cmd,
  copiedId,
  copyLabel,
  copiedLabel,
  recommendedBadge,
  onCopy,
}: {
  id: string;
  label: string;
  cmd: string;
  copiedId: string | null;
  copyLabel: string;
  copiedLabel: string;
  recommendedBadge?: string;
  onCopy: (id: string, text: string) => void;
}) {
  return (
    <div className="text-left mb-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <span className="flex flex-wrap items-center gap-2 min-w-0">
          {recommendedBadge ? (
            <span className="shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-300/95 ring-1 ring-emerald-500/25">
              {recommendedBadge}
            </span>
          ) : null}
          <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">{label}</span>
        </span>
        <button
          type="button"
          onClick={() => onCopy(id, cmd)}
          className="shrink-0 min-h-[28px] min-w-[52px] rounded-md border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-[10px] text-[var(--accent)] hover:border-[var(--accent)]/40"
          aria-label={`${copyLabel}: ${label}`}
        >
          {copiedId === id ? `✓ ${copiedLabel}` : copyLabel}
        </button>
      </div>
      <pre
        className="rounded-lg border border-[var(--border)] bg-[#0a0d14] p-3 text-[11px] text-emerald-200/90 overflow-x-auto whitespace-pre-wrap break-all"
        tabIndex={0}
      >
        {cmd}
      </pre>
    </div>
  );
}

function useClientHints() {
  const [preferWin, setPreferWin] = useState<boolean | null>(null);
  const [localSetupUrl, setLocalSetupUrl] = useState("");
  const [currentHost, setCurrentHost] = useState("");

  useEffect(() => {
    setPreferWin(/Windows|Win32|Win64|wow64/i.test(navigator.userAgent));
    setCurrentHost(window.location.host);
    const p = window.location.port;
    setLocalSetupUrl(p ? `http://localhost:${p}/setup` : "http://localhost/setup");
  }, []);

  return { preferWin, localSetupUrl, currentHost };
}

function evaluateConfigPathConsistency(configPath: string | null | undefined): { label: string; ok: boolean | null } {
  const raw = (configPath || "").trim();
  if (!raw) return { label: "未知（尚未返回）", ok: null };
  const norm = raw.replace(/\\/g, "/").toLowerCase();
  const isStandard = /\/\.openclaw\/openclaw\.json$/.test(norm);
  return isStandard
    ? { label: "标准路径（推荐）", ok: true }
    : { label: "非标准路径（请核对 OPENCLAW_HOME）", ok: false };
}

async function fetchPrecheckWithTimeout(signal: AbortSignal, timeoutMs = PRECHECK_TIMEOUT_MS): Promise<Response> {
  const ac = new AbortController();
  let timedOut = false;
  const timeoutTimer = window.setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, timeoutMs);
  const onAbort = () => ac.abort();
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    return await fetch("/api/setup/precheck", { signal: ac.signal, cache: "no-store" });
  } catch (e: unknown) {
    if (timedOut) throw new Error("PRECHECK_TIMEOUT");
    if (signal.aborted) throw new Error("PRECHECK_CANCELLED");
    throw e;
  } finally {
    window.clearTimeout(timeoutTimer);
    signal.removeEventListener("abort", onAbort);
  }
}

export default function SetupPage() {
  const { t } = useI18n();
  const { preferWin, localSetupUrl, currentHost } = useClientHints();
  const [precheck, setPrecheck] = useState<PrecheckState>("loading");
  const [cliVersion, setCliVersion] = useState<string | null>(null);
  const [missingInfo, setMissingInfo] = useState<PrecheckMissingPayload | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installPhase, setInstallPhase] = useState<InstallPhase>("idle");
  const [installStartedAt, setInstallStartedAt] = useState<number | null>(null);
  const [installElapsedSec, setInstallElapsedSec] = useState(0);
  const [readyForNextAction, setReadyForNextAction] = useState(false);
  const [funnel, setFunnel] = useState<SetupFunnelStats>(EMPTY_FUNNEL);
  const [showInstallConsent, setShowInstallConsent] = useState(false);
  const [installResult, setInstallResult] = useState<OneClickInstallResult | null>(null);
  const [needsOnboard, setNeedsOnboard] = useState(false);
  const [resolvedConfigPath, setResolvedConfigPath] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [openingPathId, setOpeningPathId] = useState<string | null>(null);
  const [openPathError, setOpenPathError] = useState<string | null>(null);
  const [showLoadingEscape, setShowLoadingEscape] = useState(true);

  const [step, setStep] = useState<Step>(0);
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("https://api.openai.com/v1");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [gwPort, setGwPort] = useState(18789);
  const [gwToken, setGwToken] = useState("");
  const [gwHealth, setGwHealth] = useState<{
    ok?: boolean;
    status?: string;
    error?: string;
    webUrl?: string;
    responseMs?: number;
  } | null>(null);
  const [gwRefreshing, setGwRefreshing] = useState(false);

  const fetchGatewayHealth = useCallback(
    async (silent: boolean) => {
      if (!silent) setGwRefreshing(true);
      try {
        const r = await fetch("/api/gateway-health", { cache: "no-store" });
        const d = (await r.json()) as {
          ok?: boolean;
          status?: string;
          error?: string;
          webUrl?: string;
          responseMs?: number;
        };
        setGwHealth(d);
      } catch {
        setGwHealth({ ok: false, error: t("gateway.fetchError") });
      } finally {
        if (!silent) setGwRefreshing(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (step !== 4 || precheck !== "ok") return;
    setGwHealth(null);
    let cancelled = false;
    // DOM timer id is a number; Node typings merge can make ReturnType<typeof setTimeout> = Timeout
    let sleepTimer: number | null = null;
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        sleepTimer = window.setTimeout(() => {
          sleepTimer = null;
          resolve();
        }, ms) as number;
      });
    void (async () => {
      await fetchGatewayHealth(false);
      while (!cancelled) {
        await sleep(15000);
        if (cancelled) break;
        await fetchGatewayHealth(true);
      }
    })();
    return () => {
      cancelled = true;
      if (sleepTimer) window.clearTimeout(sleepTimer);
    };
  }, [step, precheck, fetchGatewayHealth]);

  const copyText = useCallback((id: string, text: string) => {
    setCopyFailed(false);
    void navigator.clipboard.writeText(text).then(
      () => {
        setCopiedId(id);
        window.setTimeout(() => setCopiedId(null), 2000);
      },
      () => {
        setCopyFailed(true);
        window.setTimeout(() => setCopyFailed(false), 5000);
      },
    );
  }, []);

  const openInstallPath = useCallback(async (id: string, targetPath: string) => {
    const p = (targetPath || "").trim();
    if (!p) return;
    setOpenPathError(null);
    setOpeningPathId(id);
    try {
      const resp = await fetch("/api/setup/open-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPath: p }),
      });
      const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${resp.status}`);
      }
    } catch (e: unknown) {
      setOpenPathError(e instanceof Error ? e.message : String(e));
    } finally {
      setOpeningPathId(null);
    }
  }, []);

  // 防并发：同一时刻只允许一个 precheck 在跑
  const precheckAbortRef = useRef<AbortController | null>(null);
  const precheckRunning = useRef(false);
  const missingViewedRef = useRef(false);
  const nextActionBtnRef = useRef<HTMLButtonElement | null>(null);

  const bumpFunnel = useCallback((key: keyof SetupFunnelStats) => {
    if (key === "lastEventAt") return;
    setFunnel((prev) => {
      const next = {
        ...prev,
        [key]: (prev[key] as number) + 1,
        lastEventAt: Date.now(),
      } as SetupFunnelStats;
      writeFunnelStats(next);
      return next;
    });
  }, []);

  const runPrecheck = useCallback(async (): Promise<boolean> => {
    if (precheckRunning.current) return false; // 已有在途请求，直接忽略
    if (precheckAbortRef.current) precheckAbortRef.current.abort();
    const ac = new AbortController();
    precheckAbortRef.current = ac;
    precheckRunning.current = true;
    let detected = false;

    setPrecheck("loading");
    setMissingInfo(null);
    setNeedsOnboard(false);
    setResolvedConfigPath(null);
    const guardTimer = window.setTimeout(() => {
      if (!ac.signal.aborted) {
        precheckRunning.current = false;
        ac.abort();
        setCliVersion(null);
        setPrecheck("missing");
        setMissingInfo({
          reason: "precheck_guard_timeout",
          error: "precheck exceeded guard timeout",
        });
      }
    }, PRECHECK_TIMEOUT_MS + 1200);

    try {
      // 最多重试 2 次（subprocess 在高负载时可能偶发 ENOENT）
      for (let attempt = 0; attempt < 3; attempt++) {
        if (ac.signal.aborted) return detected;
        try {
          const r = await fetchPrecheckWithTimeout(ac.signal);
          const d = (await r.json().catch(() => ({}))) as PrecheckMissingPayload & {
            ok?: boolean;
            blocked?: boolean;
            version?: string;
          };
          if (r.status === 403 && d.blocked) {
            setPrecheck("blocked");
            return detected;
          }
          if (d.ok && typeof d.version === "string" && d.version.trim()) {
            setCliVersion(d.version.trim());
            setPrecheck("ok");
            setNeedsOnboard(d.configReady === false);
            setResolvedConfigPath(typeof d.configPath === "string" ? d.configPath : null);
            setReadyForNextAction(false);
            detected = true;
            return detected;
          }
          // 首次失败时等 1.5s 再试（给刚安装好的 openclaw PATH 让路）
          if (attempt < 1) {
            await new Promise((res) => setTimeout(res, 1500));
            continue;
          }
          setCliVersion(null);
          setPrecheck("missing");
          setMissingInfo({
            resolvedExecutable: d.resolvedExecutable,
            resolvedMjs: d.resolvedMjs,
            configPath: d.configPath,
            hintEnv: d.hintEnv,
            docsUrl: d.docsUrl,
            error: d.error,
            detail: d.detail,
            reason: d.reason,
          });
          break;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg === "PRECHECK_CANCELLED") return detected;
          if (msg !== "PRECHECK_TIMEOUT" && attempt < 1) {
            await new Promise((res) => setTimeout(res, 1500));
            continue;
          }
          setCliVersion(null);
          setPrecheck("missing");
          setMissingInfo({
            reason: msg === "PRECHECK_TIMEOUT" ? "precheck_timeout" : "precheck_fetch_error",
            error: msg === "PRECHECK_TIMEOUT" ? "precheck request timeout" : msg,
          });
          break;
        }
      }
    } finally {
      window.clearTimeout(guardTimer);
      precheckRunning.current = false;
    }
    return detected;
  }, []);

  const runOneClickInstall = useCallback(async () => {
    setInstallResult(null);
    setInstalling(true);
    setInstallStartedAt(Date.now());
    setInstallElapsedSec(0);
    setInstallPhase("preparing");
    bumpFunnel("oneClickInstallStart");
    try {
      // 给用户一个稳定可见的“准备中”反馈，避免误以为点击无效
      await new Promise((res) => setTimeout(res, 350));
      setInstallPhase("installing");
      const r = await fetch("/api/setup/oneclick-install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const d = (await r.json().catch(() => ({}))) as OneClickInstallResult;
      if (!r.ok || !d.ok) {
        setInstallPhase("failed");
        bumpFunnel("oneClickInstallFail");
        setInstallResult({
          ok: false,
          error: d.error || `HTTP ${r.status}`,
          stdout: d.stdout || "",
          stderr: d.stderr || "",
          command: d.command,
          manualCommand: d.manualCommand,
          downloadPathHints: Array.isArray(d.downloadPathHints) ? d.downloadPathHints : [],
        });
        return;
      }
      setShowInstallConsent(false);
      setInstallResult({
        ok: true,
        message: d.message || t("setup.precheck.oneClickSuccess"),
        stdout: d.stdout || "",
        stderr: d.stderr || "",
        command: d.command,
        manualCommand: d.manualCommand,
        downloadPathHints: Array.isArray(d.downloadPathHints) ? d.downloadPathHints : [],
      });
      bumpFunnel("oneClickInstallSuccess");
      setInstallPhase("detecting");
      // 安装后做短轮询：自动检测 CLI 是否就绪，尽量减少用户手动操作
      let ok = false;
      for (let i = 0; i < 6; i++) {
        try {
          const resp = await fetch("/api/setup/precheck", { cache: "no-store" });
          const pre = (await resp.json().catch(() => ({}))) as PrecheckMissingPayload & {
            ok?: boolean;
            blocked?: boolean;
            version?: string;
          };
          if (resp.status === 403 && pre.blocked) {
            setPrecheck("blocked");
            break;
          }
          if (pre.ok && typeof pre.version === "string" && pre.version.trim()) {
            setCliVersion(pre.version.trim());
            setPrecheck("ok");
            setNeedsOnboard(pre.configReady === false);
            setResolvedConfigPath(typeof pre.configPath === "string" ? pre.configPath : null);
            ok = true;
            break;
          }
        } catch {
          // ignore transient errors in detection loop
        }
        await new Promise((res) => setTimeout(res, 1200));
      }
      if (!ok) {
        setInstallPhase("done");
        bumpFunnel("oneClickDetectPending");
        setInstallResult((prev) => ({
          ...prev,
          ok: true,
          message: t("setup.precheck.oneClickSuccessPending"),
        }));
      } else {
        setInstallPhase("done");
        bumpFunnel("oneClickDetectSuccess");
        setReadyForNextAction(true);
      }
    } catch (e: unknown) {
      setInstallPhase("failed");
      bumpFunnel("oneClickInstallFail");
      setInstallResult({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setInstalling(false);
      setInstallStartedAt(null);
    }
  }, [bumpFunnel, t]);

  useEffect(() => {
    void runPrecheck();
  }, [runPrecheck]);

  useEffect(() => {
    document.title = `${t("setup.title")} · 1one`;
  }, [t]);

  useEffect(() => {
    setFunnel(readFunnelStats());
  }, []);

  useEffect(() => {
    if (!installing || !installStartedAt) return;
    const tick = () => setInstallElapsedSec(Math.max(0, Math.floor((Date.now() - installStartedAt) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [installing, installStartedAt]);

  useEffect(() => {
    if (!readyForNextAction || precheck !== "ok" || step !== 0) return;
    const timer = window.setTimeout(() => {
      nextActionBtnRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      nextActionBtnRef.current?.focus();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [readyForNextAction, precheck, step]);

  useEffect(() => {
    if (precheck === "missing" && !missingViewedRef.current) {
      missingViewedRef.current = true;
      bumpFunnel("viewMissing");
    }
    if (precheck !== "missing") {
      missingViewedRef.current = false;
    }
  }, [precheck, bumpFunnel]);

  useEffect(() => {
    setShowLoadingEscape(precheck === "loading");
  }, [precheck]);

  const refreshGatewayMeta = useCallback(async () => {
    try {
      const r = await fetch("/api/config");
      const d = await r.json();
      if (d.gateway?.port) setGwPort(Number(d.gateway.port));
      if (d.gateway?.auth?.token) setGwToken(String(d.gateway.auth.token));
    } catch {
      /* ignore */
    }
  }, []);

  const tryAdvanceToReview = () => {
    setErr(null);
    if (provider !== "ollama" && !apiKey.trim()) {
      setErr(t("setup.errorApiKeyRequired"));
      return;
    }
    setStep(3);
  };

  const submit = async () => {
    setErr(null);
    if (provider !== "ollama" && !apiKey.trim()) {
      setErr(t("setup.errorApiKeyRequired"));
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/setup/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: provider === "ollama" ? "" : apiKey,
          modelId: modelId.trim() || undefined,
          customBaseUrl:
            provider === "custom"
              ? customBaseUrl.trim()
              : provider === "ollama"
                ? customBaseUrl.trim() || undefined
                : undefined,
          gatewayPort: 18789,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = typeof d.detail === "string" ? d.detail : d.error || `HTTP ${r.status}`;
        throw new Error(msg.slice(0, 800));
      }
      await refreshGatewayMeta();
      setStep(4);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const openOpenclaw = () => {
    const q = gwToken ? `?token=${encodeURIComponent(gwToken)}` : "";
    window.open(`http://127.0.0.1:${gwPort}/chat${q}`, "_blank", "noopener,noreferrer");
  };

  const openDashboard = () => {
    window.open(`${window.location.origin}/oneone-dashboard`, "_blank", "noopener,noreferrer");
  };

  const btnPrimary =
    "w-full max-w-sm rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold py-3.5 px-6 shadow-lg shadow-red-900/30 transition disabled:opacity-50 disabled:pointer-events-none min-h-[48px]";
  const btnSecondary =
    "w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg)] py-3 font-medium text-[var(--text)] hover:border-[var(--accent)]/40 transition mx-auto min-h-[44px]";
  const card = "w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-xl";
  const cardWide = "w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-xl";
  const docsHref = missingInfo?.docsUrl?.trim() || "https://docs.openclaw.ai/install";

  const detailsCls =
    "group rounded-xl border border-[var(--border)]/80 bg-[var(--bg)]/40 px-3 py-2 text-left [&_summary]:cursor-pointer [&_summary]:list-none [&_summary::-webkit-details-marker]:hidden";

  const badge = t("setup.precheck.recommendedBadge");
  const progressPct =
    installPhase === "preparing"
      ? 15
      : installPhase === "installing"
        ? 62
        : installPhase === "detecting"
          ? 88
          : installPhase === "done"
            ? 100
            : installPhase === "failed"
              ? 100
              : 0;
  const showSlowHint = installing && installElapsedSec >= 90 && (installPhase === "installing" || installPhase === "detecting");
  const installErrorSummary = useMemo(() => {
    if (!installResult || installResult.ok) return "";
    const stderrTail = (installResult.stderr || "").trim().slice(-800);
    const stdoutTail = (installResult.stdout || "").trim().slice(-500);
    const lines = [
      "[ONE CLAW Setup] One-click install failed",
      `Phase: ${installPhase}`,
      `Error: ${installResult.error || "unknown error"}`,
      installResult.command ? `Command: ${installResult.command}` : "",
      stderrTail ? `stderr_tail:\n${stderrTail}` : "",
      !stderrTail && stdoutTail ? `stdout_tail:\n${stdoutTail}` : "",
      `Time: ${new Date().toLocaleString()}`,
    ].filter(Boolean);
    return lines.join("\n\n");
  }, [installResult, installPhase]);
  const configPathCheck = useMemo(
    () => evaluateConfigPathConsistency(missingInfo?.configPath || resolvedConfigPath),
    [missingInfo?.configPath, resolvedConfigPath],
  );

  return (
    <div className="min-h-[calc(100vh-3.5rem)] md:min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-gradient-to-b from-[#0c0f18] to-[#070910]">
      <div
        className={`${precheck === "missing" || precheck === "blocked" || precheck === "ok" ? cardWide : card} text-center`}
        role={precheck === "loading" ? "status" : undefined}
        aria-busy={precheck === "loading"}
        aria-live={precheck === "loading" || precheck === "missing" ? "polite" : undefined}
      >
        {precheck === "loading" && (
          <div className="py-12">
            <div
              className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500"
              aria-hidden
            />
            <p className="text-sm text-[var(--text-muted)]">{t("setup.precheck.loading")}</p>
            <p className="mt-2 text-[10px] text-[var(--text-muted)]/55">{t("setup.footerHint")}</p>
            {showLoadingEscape ? (
              <button
                type="button"
                className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text)] hover:border-[var(--accent)]/45"
                onClick={() => {
                  setPrecheck("missing");
                  setMissingInfo({
                    reason: "manual_escape_from_loading",
                    error: "user manually switched to install options",
                  });
                }}
              >
                {t("setup.precheck.loadingEscape")}
              </button>
            ) : null}
          </div>
        )}

        {precheck === "blocked" && (
          <div className="text-left space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 mb-1">
                {t("setup.title")}
              </p>
              <h1 className="text-xl font-bold text-[var(--text)]">{t("setup.precheck.blockedHeadline")}</h1>
            </div>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">{t("setup.precheck.blocked")}</p>
            <p className="text-xs text-[var(--text-muted)]/85 leading-relaxed border-l-2 border-amber-500/40 pl-3">
              {t("setup.precheck.securityWhy")}
            </p>

            <div className="rounded-xl border border-[var(--border)] bg-[#0a0d14]/80 p-3 space-y-2">
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
                {t("setup.precheck.youAreHere")}
              </p>
              <p className="font-mono text-xs text-amber-100/90 break-all">{currentHost || "…"}</p>
              {localSetupUrl ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" className={btnSecondary + " !max-w-none flex-1 min-w-[140px]"} onClick={() => copyText("localurl", localSetupUrl)}>
                    {t("setup.precheck.copyLocalSetup")}
                  </button>
                  <code className="flex-1 min-w-0 self-center text-[10px] text-emerald-200/80 break-all px-1">{localSetupUrl}</code>
                </div>
              ) : null}
            </div>

            <Link href="/" className={`${btnSecondary} inline-flex items-center justify-center no-underline`}>
              {t("setup.precheck.backHome")}
            </Link>
          </div>
        )}

        {precheck === "missing" && (
          <div className="text-left">
            <h1 className="text-xl font-bold text-[var(--text)] mb-2">{t("setup.precheck.missingTitle")}</h1>
            <p className="text-sm text-[var(--text-muted)] mb-5 leading-relaxed">{t("setup.precheck.missingSub")}</p>
            <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg)]/55 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-[var(--text)] mb-1">快速诊断</p>
              <p className="text-[11px] text-[var(--text-muted)] break-all">
                openclaw 路径：<span className="font-mono text-[var(--text)]">{missingInfo?.resolvedExecutable || "—"}</span>
              </p>
              <p className="text-[11px] text-[var(--text-muted)] break-all mt-0.5">
                配置文件：<span className="font-mono text-[var(--text)]">{missingInfo?.configPath || "—"}</span>
              </p>
              {preferWin === true && missingInfo?.configPath ? (
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => void openInstallPath("quick-config-path", missingInfo.configPath || "")}
                    disabled={openingPathId === "quick-config-path"}
                    className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[10px] text-[var(--text)] hover:border-[var(--accent)]/45 disabled:opacity-60"
                  >
                    {openingPathId === "quick-config-path" ? "打开中..." : "打开配置位置"}
                  </button>
                </div>
              ) : null}
              <p
                className={`text-[11px] mt-1 ${
                  configPathCheck.ok === true
                    ? "text-emerald-300/95"
                    : configPathCheck.ok === false
                      ? "text-red-300/95"
                      : "text-[var(--text-muted)]"
                }`}
              >
                路径一致性：{configPathCheck.label}
              </p>
              {openPathError ? (
                <p className="mt-1 text-[10px] text-red-200/90">打开失败：{openPathError}</p>
              ) : null}
            </div>

            <a
              href={docsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent)]/35 bg-[var(--accent)]/10 py-3 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/15 transition no-underline"
            >
              {t("setup.precheck.docsLink")}
              <span aria-hidden>↗</span>
            </a>

            <h2 className="text-xs font-semibold text-[var(--text)] mb-2">{t("setup.precheck.officialInstall")}</h2>

            {installPhase !== "idle" ? (
              <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 p-3" role="status" aria-live="polite">
                <p className="text-xs font-semibold text-[var(--text)] mb-2">{t("setup.precheck.oneClickProgressTitle")}</p>
                <div className="mb-2.5 h-2 w-full overflow-hidden rounded-full bg-[var(--card)]">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      installPhase === "failed" ? "bg-red-500/80" : "bg-emerald-500/80"
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="mb-2 text-[11px] text-[var(--text-muted)]">
                  {t("setup.precheck.elapsed")}: {installElapsedSec}s
                </p>
                <div className="space-y-1.5 text-[11px]">
                  {[
                    { key: "setup.precheck.stagePreparing", active: installPhase === "preparing", done: installPhase !== "preparing" },
                    { key: "setup.precheck.stageInstalling", active: installPhase === "installing", done: installPhase === "detecting" || installPhase === "done" || installPhase === "failed" },
                    { key: "setup.precheck.stageDetecting", active: installPhase === "detecting", done: installPhase === "done" || installPhase === "failed" },
                  ].map((s) => (
                    <div key={s.key} className="flex items-center gap-2">
                      <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                        s.done
                          ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/35"
                          : s.active
                            ? "bg-red-500/20 text-red-200 ring-1 ring-red-500/40"
                            : "bg-[var(--card)] text-[var(--text-muted)] ring-1 ring-[var(--border)]"
                      }`}>
                        {s.done ? "✓" : s.active ? "…" : "·"}
                      </span>
                      <span className={s.active ? "text-[var(--text)]" : "text-[var(--text-muted)]"}>{t(s.key)}</span>
                    </div>
                  ))}
                </div>
                <p className={`mt-2 text-[11px] ${
                  installPhase === "failed" ? "text-red-200/90" : "text-[var(--text-muted)]"
                }`}>
                  {installPhase === "preparing" && t("setup.precheck.stagePreparingDesc")}
                  {installPhase === "installing" && t("setup.precheck.stageInstallingDesc")}
                  {installPhase === "detecting" && t("setup.precheck.stageDetectingDesc")}
                  {installPhase === "done" && t("setup.precheck.stageDoneDesc")}
                  {installPhase === "failed" && t("setup.precheck.stageFailedDesc")}
                </p>
                {showSlowHint ? (
                  <p className="mt-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-100/95">
                    {t("setup.precheck.slowHint")}
                  </p>
                ) : null}
              </div>
            ) : null}

            {!showInstallConsent ? (
              <button
                type="button"
                disabled={installing}
                onClick={() => {
                  setShowInstallConsent(true);
                  bumpFunnel("oneClickOpenConsent");
                }}
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold py-3 px-4 shadow-lg shadow-red-900/30 transition disabled:opacity-60 disabled:pointer-events-none min-h-[46px]"
              >
                {installing ? t("setup.precheck.oneClickInstalling") : t("setup.precheck.oneClickInstall")}
              </button>
            ) : (
              <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 p-3">
                <p className="text-sm font-semibold text-[var(--text)]">{t("setup.precheck.oneClickConsentTitle")}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">{t("setup.precheck.oneClickConfirm")}</p>
                <p className="mt-1 text-[11px] text-amber-200/90">{t("setup.precheck.oneClickEstimatedTime")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInstallConsent(false);
                      bumpFunnel("oneClickConsentCancel");
                    }}
                    disabled={installing}
                    className="flex-1 min-w-[132px] rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:border-[var(--accent)]/45 disabled:opacity-50"
                  >
                    {t("setup.precheck.oneClickConsentCancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      bumpFunnel("oneClickConsentAgree");
                      void runOneClickInstall();
                    }}
                    disabled={installing}
                    className="flex-1 min-w-[132px] rounded-lg bg-red-600 hover:bg-red-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {installing ? t("setup.precheck.oneClickInstalling") : t("setup.precheck.oneClickConsentAgree")}
                  </button>
                </div>
              </div>
            )}

            {installResult ? (
              <div
                className={`mb-4 rounded-xl border px-3 py-2 text-xs whitespace-pre-wrap break-all ${
                  installResult.ok
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                    : "border-red-500/40 bg-red-500/10 text-red-100"
                }`}
                role="status"
                aria-live="polite"
              >
                <p className="font-medium mb-1">
                  {installResult.ok
                    ? installResult.message || t("setup.precheck.oneClickSuccess")
                    : `${t("setup.precheck.oneClickFailed")}：${installResult.error || "-"}`}
                </p>
                {!installResult.ok ? (
                  <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/5 px-2.5 py-2">
                    <p className="mb-2 text-[11px] text-red-100/90">{t("setup.precheck.failureActionsTitle")}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => copyText("install-error-summary", installErrorSummary)}
                        className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-[11px] text-[var(--text)] hover:border-[var(--accent)]/45"
                      >
                        {copiedId === "install-error-summary"
                          ? `✓ ${t("setup.precheck.copied")}`
                          : t("setup.precheck.copyErrorSummary")}
                      </button>
                      <button
                        type="button"
                        disabled={installing}
                        onClick={() => void runOneClickInstall()}
                        className="rounded-md bg-red-600 hover:bg-red-500 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
                      >
                        {installing ? t("setup.precheck.oneClickInstalling") : t("setup.precheck.retryOneClick")}
                      </button>
                      <a
                        href={docsHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-[11px] text-[var(--accent)] hover:border-[var(--accent)]/45 no-underline"
                      >
                        {t("setup.precheck.openInstallDocs")} ↗
                      </a>
                    </div>
                  </div>
                ) : null}
                {installResult.command || installResult.manualCommand || (installResult.downloadPathHints || []).length > 0 ? (
                  <div className="mb-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/45 px-2.5 py-2 text-[11px] text-[var(--text-muted)]">
                    <p className="mb-1 font-semibold text-[var(--text)]">安装可见信息（非黑盒）</p>
                    {installResult.command ? (
                      <div className="mb-2">
                        <p className="mb-1">自动执行命令：</p>
                        <pre className="rounded-md border border-[var(--border)] bg-[#0a0d14] p-2 text-[10px] text-emerald-200/90 whitespace-pre-wrap break-all">
                          {installResult.command}
                        </pre>
                      </div>
                    ) : null}
                    {installResult.downloadPathHints && installResult.downloadPathHints.length > 0 ? (
                      <div className="mb-2">
                        <p className="mb-1">已下载/缓存路径（候选）：</p>
                        <div className="space-y-1">
                          {installResult.downloadPathHints.map((p, idx) => (
                            <div key={`${p}-${idx}`} className="flex items-start gap-2">
                              <code className="flex-1 rounded-md border border-[var(--border)] bg-[#0a0d14] px-2 py-1 text-[10px] text-amber-200/90 break-all">
                                {p}
                              </code>
                              {preferWin === true ? (
                                <button
                                  type="button"
                                  onClick={() => void openInstallPath(`dlopen-${idx}`, p)}
                                  disabled={openingPathId === `dlopen-${idx}`}
                                  className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[10px] text-[var(--text)] hover:border-[var(--accent)]/45 disabled:opacity-60"
                                >
                                  {openingPathId === `dlopen-${idx}` ? "打开中..." : "打开"}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => copyText(`dlpath-${idx}`, p)}
                                className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[10px] text-[var(--accent)] hover:border-[var(--accent)]/45"
                              >
                                {copiedId === `dlpath-${idx}` ? `✓ ${t("setup.precheck.copied")}` : t("setup.precheck.copy")}
                              </button>
                            </div>
                          ))}
                        </div>
                        {openPathError ? (
                          <p className="mt-1 text-[10px] text-red-200/90">打开失败：{openPathError}</p>
                        ) : null}
                      </div>
                    ) : null}
                    {installResult.manualCommand ? (
                      <div>
                        <p className="mb-1">如自动安装失败，可手动执行：</p>
                        <div className="flex items-start gap-2">
                          <pre className="flex-1 rounded-md border border-[var(--border)] bg-[#0a0d14] p-2 text-[10px] text-emerald-200/90 whitespace-pre-wrap break-all">
                            {installResult.manualCommand}
                          </pre>
                          <button
                            type="button"
                            onClick={() => copyText("install-manual-cmd", installResult.manualCommand || "")}
                            className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[10px] text-[var(--accent)] hover:border-[var(--accent)]/45"
                          >
                            {copiedId === "install-manual-cmd" ? `✓ ${t("setup.precheck.copied")}` : t("setup.precheck.copy")}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {installResult.stdout || installResult.stderr ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[11px] text-[var(--text-muted)]">{t("setup.precheck.oneClickShowLogs")}</summary>
                    {installResult.stdout ? (
                      <pre className="mt-2 max-h-44 overflow-auto rounded-lg border border-[var(--border)] bg-[#0a0d14] p-2 text-[10px] text-emerald-200/90">{installResult.stdout}</pre>
                    ) : null}
                    {installResult.stderr ? (
                      <pre className="mt-2 max-h-32 overflow-auto rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[10px] text-red-200/90">{installResult.stderr}</pre>
                    ) : null}
                  </details>
                ) : null}
              </div>
            ) : null}

            <details className={detailsCls + " mb-4"}>
              <summary className="text-xs font-medium text-[var(--text-muted)] py-1 flex items-center justify-between gap-2">
                <span>{t("setup.precheck.funnelTitle")}</span>
                <span className="text-[var(--text-muted)]/50 group-open:rotate-90 transition-transform">›</span>
              </summary>
              <div className="pt-3 border-t border-[var(--border)]/60 mt-2">
                <p className="text-[11px] text-[var(--text-muted)] mb-2">{t("setup.precheck.funnelDesc")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <p>{t("setup.precheck.funnelViewMissing")}: <span className="text-[var(--text)]">{funnel.viewMissing}</span></p>
                  <p>{t("setup.precheck.funnelOpenConsent")}: <span className="text-[var(--text)]">{funnel.oneClickOpenConsent}</span></p>
                  <p>{t("setup.precheck.funnelConsentAgree")}: <span className="text-[var(--text)]">{funnel.oneClickConsentAgree}</span></p>
                  <p>{t("setup.precheck.funnelInstallStart")}: <span className="text-[var(--text)]">{funnel.oneClickInstallStart}</span></p>
                  <p>{t("setup.precheck.funnelInstallSuccess")}: <span className="text-emerald-300">{funnel.oneClickInstallSuccess}</span></p>
                  <p>{t("setup.precheck.funnelInstallFail")}: <span className="text-red-300">{funnel.oneClickInstallFail}</span></p>
                  <p>{t("setup.precheck.funnelDetectSuccess")}: <span className="text-emerald-300">{funnel.oneClickDetectSuccess}</span></p>
                  <p>{t("setup.precheck.funnelNextActionClick")}: <span className="text-[var(--text)]">{funnel.nextActionClick}</span></p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] text-[var(--text-muted)]/80">
                    {t("setup.precheck.funnelLastEvent")}: {funnel.lastEventAt ? new Date(funnel.lastEventAt).toLocaleString() : "—"}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFunnel({ ...EMPTY_FUNNEL });
                      writeFunnelStats({ ...EMPTY_FUNNEL });
                    }}
                    className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[10px] text-[var(--text-muted)] hover:border-[var(--accent)]/45"
                  >
                    {t("setup.precheck.funnelReset")}
                  </button>
                </div>
              </div>
            </details>

            {preferWin === null && (
              <>
                <CopyCmdRow
                  id="win"
                  label={t("setup.precheck.cmdWindows")}
                  cmd={OFFICIAL_CMD_WINDOWS}
                  copiedId={copiedId}
                  copyLabel={t("setup.precheck.copy")}
                  copiedLabel={t("setup.precheck.copied")}
                  onCopy={copyText}
                />
                <CopyCmdRow
                  id="unix"
                  label={t("setup.precheck.cmdUnix")}
                  cmd={OFFICIAL_CMD_UNIX}
                  copiedId={copiedId}
                  copyLabel={t("setup.precheck.copy")}
                  copiedLabel={t("setup.precheck.copied")}
                  onCopy={copyText}
                />
              </>
            )}

            {preferWin === true && (
              <>
                <CopyCmdRow
                  id="win"
                  label={t("setup.precheck.forYourOS")}
                  cmd={OFFICIAL_CMD_WINDOWS}
                  copiedId={copiedId}
                  copyLabel={t("setup.precheck.copy")}
                  copiedLabel={t("setup.precheck.copied")}
                  recommendedBadge={badge}
                  onCopy={copyText}
                />
                <details className={detailsCls + " mb-3"}>
                  <summary className="text-xs font-medium text-[var(--text-muted)] py-1 flex items-center justify-between gap-2">
                    <span>{t("setup.precheck.otherPlatforms")}</span>
                    <span className="text-[var(--text-muted)]/50 group-open:rotate-90 transition-transform">›</span>
                  </summary>
                  <div className="pt-2 border-t border-[var(--border)]/60 mt-2">
                    <CopyCmdRow
                      id="unix"
                      label={t("setup.precheck.cmdUnix")}
                      cmd={OFFICIAL_CMD_UNIX}
                      copiedId={copiedId}
                      copyLabel={t("setup.precheck.copy")}
                      copiedLabel={t("setup.precheck.copied")}
                      onCopy={copyText}
                    />
                  </div>
                </details>
              </>
            )}

            {preferWin === false && (
              <>
                <CopyCmdRow
                  id="unix"
                  label={t("setup.precheck.forYourOS")}
                  cmd={OFFICIAL_CMD_UNIX}
                  copiedId={copiedId}
                  copyLabel={t("setup.precheck.copy")}
                  copiedLabel={t("setup.precheck.copied")}
                  recommendedBadge={badge}
                  onCopy={copyText}
                />
                <details className={detailsCls + " mb-3"}>
                  <summary className="text-xs font-medium text-[var(--text-muted)] py-1 flex items-center justify-between gap-2">
                    <span>{t("setup.precheck.otherPlatforms")}</span>
                    <span className="text-[var(--text-muted)]/50 group-open:rotate-90 transition-transform">›</span>
                  </summary>
                  <div className="pt-2 border-t border-[var(--border)]/60 mt-2">
                    <CopyCmdRow
                      id="win"
                      label={t("setup.precheck.cmdWindows")}
                      cmd={OFFICIAL_CMD_WINDOWS}
                      copiedId={copiedId}
                      copyLabel={t("setup.precheck.copy")}
                      copiedLabel={t("setup.precheck.copied")}
                      onCopy={copyText}
                    />
                  </div>
                </details>
              </>
            )}

            <details className={detailsCls + " mb-4"}>
              <summary className="text-xs font-semibold text-[var(--text)] py-1 flex items-center justify-between gap-2">
                <span>{t("setup.precheck.advancedTitle")}</span>
                <span className="text-[var(--text-muted)]/50 group-open:rotate-90 transition-transform">›</span>
              </summary>
              <div className="pt-3 space-y-1 border-t border-[var(--border)]/60 mt-2">
                <CopyCmdRow
                  id="pkg-win"
                  label={t("setup.precheck.packagingWin")}
                  cmd={PKG_SCRIPT_WIN}
                  copiedId={copiedId}
                  copyLabel={t("setup.precheck.copy")}
                  copiedLabel={t("setup.precheck.copied")}
                  onCopy={copyText}
                />
                <CopyCmdRow
                  id="pkg-unix"
                  label={t("setup.precheck.packagingUnix")}
                  cmd={PKG_SCRIPT_UNIX}
                  copiedId={copiedId}
                  copyLabel={t("setup.precheck.copy")}
                  copiedLabel={t("setup.precheck.copied")}
                  onCopy={copyText}
                />
                {missingInfo?.hintEnv?.trim() ? (
                  <CopyCmdRow
                    id="env"
                    label={t("setup.precheck.envTitle")}
                    cmd={missingInfo.hintEnv.trim()}
                    copiedId={copiedId}
                    copyLabel={t("setup.precheck.copy")}
                    copiedLabel={t("setup.precheck.copied")}
                    onCopy={copyText}
                  />
                ) : null}
              </div>
            </details>

            <details className={detailsCls + " mb-5"}>
              <summary className="text-xs font-medium text-[var(--text-muted)] py-1 flex items-center justify-between gap-2">
                <span>{t("setup.precheck.diagnosticsTitle")}</span>
                <span className="text-[var(--text-muted)]/50 group-open:rotate-90 transition-transform">›</span>
              </summary>
              <div className="pt-3 border-t border-[var(--border)]/60 mt-2 space-y-3">
                <p className="text-[11px] text-[var(--text-muted)] font-mono break-all">
                  <span className="text-[var(--text-muted)]/80">{t("setup.precheck.detectedPath")}: </span>
                  {missingInfo?.resolvedExecutable ?? "—"} · {t("setup.precheck.mjsLine")}:{" "}
                  {missingInfo?.resolvedMjs ? t("setup.precheck.mjsYes") : t("setup.precheck.mjsNo")}
                </p>
                {(missingInfo?.error || missingInfo?.detail) && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200/90 whitespace-pre-wrap break-all max-h-40 overflow-auto font-mono">
                    {missingInfo?.reason ? `[${missingInfo.reason}] ` : ""}
                    {missingInfo?.error}
                    {missingInfo?.detail ? `\n${missingInfo.detail}` : ""}
                  </div>
                )}
              </div>
            </details>

            {copyFailed ? (
              <p className="mb-3 text-center text-[11px] text-amber-300/95" role="alert">
                {t("setup.precheck.copyFailed")}
              </p>
            ) : null}

            <button type="button" className={btnPrimary} onClick={() => void runPrecheck()}>
              {t("setup.precheck.retry")}
            </button>
          </div>
        )}

        {precheck === "ok" && (
          <>
            <WizardProgress step={step} t={t} />

            {step === 0 && (
              <>
                {needsOnboard ? (
                  <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left">
                    <p className="text-xs font-semibold text-amber-100">已安装 CLI，但尚未完成初始化</p>
                    <p className="mt-1 text-[11px] text-amber-100/90 leading-relaxed">
                      检测到 `openclaw --version` 已可执行，但配置文件尚未生成（通常为首次安装后的正常状态）。请继续下一步完成提供商和密钥配置。
                    </p>
                    {resolvedConfigPath ? (
                      <>
                        <p className="mt-1 text-[10px] font-mono text-amber-200/85 break-all">config: {resolvedConfigPath}</p>
                        {preferWin === true ? (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => void openInstallPath("onboard-config-path", resolvedConfigPath)}
                              disabled={openingPathId === "onboard-config-path"}
                              className="rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-100 hover:border-amber-300/45 disabled:opacity-60"
                            >
                              {openingPathId === "onboard-config-path" ? "打开中..." : "打开配置位置"}
                            </button>
                          </div>
                        ) : null}
                        <p
                          className={`mt-1 text-[10px] ${
                            configPathCheck.ok === true
                              ? "text-emerald-200/90"
                              : configPathCheck.ok === false
                                ? "text-amber-100/90"
                                : "text-amber-100/80"
                          }`}
                        >
                          路径一致性：{configPathCheck.label}
                        </p>
                      </>
                    ) : null}
                  </div>
                ) : null}
                {readyForNextAction ? (
                  <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-left">
                    <p className="text-xs font-semibold text-emerald-100">{t("setup.nextActionTitle")}</p>
                    <p className="mt-1 text-[11px] text-emerald-200/90">{t("setup.nextActionSub")}</p>
                  </div>
                ) : null}
                {cliVersion ? (
                  <p className="mb-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-300/95">
                    <span aria-hidden>✓</span> {t("setup.precheck.okBadge")}:{" "}
                    <code className="font-mono">{brandCliVersionLine(cliVersion)}</code>
                  </p>
                ) : null}
                <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg)]/90 p-2 shadow-md shadow-black/25">
                  <Image
                    src={SETUP_BRAND_LOGO}
                    alt=""
                    width={57}
                    height={56}
                    className="max-h-[5rem] w-auto max-w-[90%] object-contain drop-shadow-sm"
                    priority
                    style={{ width: "auto", height: "auto", maxHeight: "5rem" }}
                  />
                </div>
                <h1 className="text-2xl font-bold text-[var(--text)] mb-2">{t("setup.stepWelcome")}</h1>
                <p className="text-sm text-[var(--text-muted)] mb-8 leading-relaxed">{t("setup.stepWelcomeSub")}</p>
                <p className="text-xs text-[var(--text-muted)]/80 mb-6">{t("setup.localOnlyHint")}</p>
                <button
                  ref={nextActionBtnRef}
                  type="button"
                  className={`${btnPrimary} ${readyForNextAction ? "ring-2 ring-emerald-400/70 animate-pulse" : ""}`}
                  onClick={() => {
                    if (readyForNextAction) bumpFunnel("nextActionClick");
                    setReadyForNextAction(false);
                    setStep(1);
                  }}
                >
                  {readyForNextAction ? t("setup.nextActionCta") : t("setup.ctaStart")}
                </button>
              </>
            )}

            {step === 1 && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-xl font-bold text-[var(--text)] text-left flex-1">{t("setup.stepProviderTitle")}</h1>
                  <button
                    type="button"
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] min-h-[36px] px-1"
                    onClick={() => setStep(0)}
                  >
                    {t("setup.back")}
                  </button>
                </div>
                <p className="text-sm text-[var(--text-muted)] text-left mb-5">{t("setup.stepProviderSub")}</p>

                <div className="flex flex-wrap gap-2 justify-center mb-8">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProvider(p.id)}
                      className={`rounded-lg px-3 py-2.5 text-xs font-medium border transition min-h-[40px] ${
                        provider === p.id
                          ? "bg-red-600 border-red-500 text-white"
                          : "bg-[var(--bg)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/50"
                      }`}
                    >
                      {t(p.labelKey)}
                    </button>
                  ))}
                </div>

                <button type="button" className={btnPrimary} onClick={() => setStep(2)}>
                  {t("setup.next")}
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-xl font-bold text-[var(--text)] text-left flex-1">{t("setup.stepCredentialsTitle")}</h1>
                  <button
                    type="button"
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] min-h-[36px] px-1"
                    onClick={() => setStep(1)}
                  >
                    {t("setup.back")}
                  </button>
                </div>
                <p className="text-sm text-[var(--text-muted)] text-left mb-5">{t("setup.stepCredentialsSub")}</p>

                {(provider === "custom" || provider === "ollama") && (
                  <div className="text-left mb-4">
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t("setup.customBaseUrl")}</label>
                    <input
                      type="url"
                      value={customBaseUrl}
                      onChange={(e) => setCustomBaseUrl(e.target.value)}
                      placeholder={provider === "ollama" ? "http://127.0.0.1:11434" : "https://..."}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text)] min-h-[44px]"
                    />
                  </div>
                )}

                {provider !== "ollama" && (
                  <div className="text-left mb-4">
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t("setup.apiKey")}</label>
                    <input
                      type="password"
                      autoComplete="off"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text)] font-mono min-h-[44px]"
                      placeholder="sk-..."
                    />
                  </div>
                )}

                <div className="text-left mb-6">
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                    {t("setup.model")}
                  </label>
                  <input
                    type="text"
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    placeholder="gpt-4o / claude-3-5-sonnet / qwen2.5 ..."
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text)] min-h-[44px]"
                  />
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">{t("setup.modelHint")}</p>
                </div>

                {err && (
                  <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-left text-xs text-red-200 whitespace-pre-wrap break-all max-h-40 overflow-auto">
                    {err}
                  </div>
                )}

                <button type="button" className={btnPrimary} onClick={tryAdvanceToReview}>
                  {t("setup.next")}
                </button>
              </>
            )}

            {step === 3 && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-xl font-bold text-[var(--text)] text-left flex-1">{t("setup.stepConfirmTitle")}</h1>
                  <button
                    type="button"
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] min-h-[36px] px-1"
                    onClick={() => setStep(2)}
                  >
                    {t("setup.back")}
                  </button>
                </div>
                <p className="text-sm text-[var(--text-muted)] text-left mb-5">{t("setup.stepConfirmSub")}</p>

                <dl className="mb-6 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 px-4 py-4 text-left text-sm">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                    <dt className="text-[var(--text-muted)] shrink-0">{t("setup.confirmSummaryProvider")}</dt>
                    <dd className="font-medium text-[var(--text)] break-all">
                      {t(PROVIDERS.find((p) => p.id === provider)!.labelKey)}
                    </dd>
                  </div>
                  {(provider === "custom" || provider === "ollama") && (
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                      <dt className="text-[var(--text-muted)] shrink-0">{t("setup.confirmSummaryBaseUrl")}</dt>
                      <dd className="font-mono text-xs text-[var(--text)] break-all">{customBaseUrl.trim() || "—"}</dd>
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                    <dt className="text-[var(--text-muted)] shrink-0">{t("setup.confirmSummaryApiKey")}</dt>
                    <dd className="font-mono text-xs text-[var(--text)]">
                      {provider === "ollama"
                        ? "—"
                        : apiKey.trim()
                          ? t("setup.confirmApiKeyMasked")
                          : t("setup.confirmApiKeyUnset")}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                    <dt className="text-[var(--text-muted)] shrink-0">{t("setup.confirmSummaryModel")}</dt>
                    <dd className="font-mono text-xs text-[var(--text)] break-all">{modelId.trim() || "—"}</dd>
                  </div>
                </dl>

                {err && (
                  <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-left text-xs text-red-200 whitespace-pre-wrap break-all max-h-40 overflow-auto">
                    {t("setup.error")}: {err}
                  </div>
                )}

                <button type="button" className={btnPrimary} disabled={loading} onClick={() => void submit()}>
                  {loading ? t("setup.submitting") : t("setup.ctaConfirmSubmit")}
                </button>
              </>
            )}

            {step === 4 && (
              <>
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-400/50 shadow-[0_0_36px_rgba(52,211,153,0.25)]">
                  <span className="text-3xl text-emerald-400" aria-hidden>
                    ✓
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-[var(--text)] mb-2">{t("setup.stepDoneTitle")}</h1>
                <p className="text-sm text-[var(--text-muted)] mb-5">{t("setup.stepDoneSub")}</p>

                {(() => {
                  const variant: "checking" | "ok" | "degraded" | "down" =
                    !gwHealth && gwRefreshing
                      ? "checking"
                      : !gwHealth
                        ? "checking"
                        : gwHealth.ok && gwHealth.status === "degraded"
                          ? "degraded"
                          : gwHealth.ok
                            ? "ok"
                            : "down";
                  const box =
                    variant === "ok"
                      ? "border-emerald-500/45 bg-emerald-500/[0.08]"
                      : variant === "degraded"
                        ? "border-amber-500/45 bg-amber-500/[0.08]"
                        : variant === "down"
                          ? "border-red-500/40 bg-red-500/[0.07]"
                          : "border-[var(--border)] bg-[var(--bg)]/60";
                  const titleColor =
                    variant === "ok"
                      ? "text-emerald-200"
                      : variant === "degraded"
                        ? "text-amber-100"
                        : variant === "down"
                          ? "text-red-100"
                          : "text-[var(--text)]";
                  const body =
                    variant === "checking"
                      ? t("setup.done.gatewayChecking")
                      : variant === "ok"
                        ? t("setup.done.gatewayOnline")
                        : variant === "degraded"
                          ? t("setup.done.gatewaySlow")
                          : gwHealth?.error
                            ? `${t("setup.done.gatewayOffline")} (${gwHealth.error})`
                            : t("setup.done.gatewayOffline");
                  return (
                    <div
                      className={`mb-6 rounded-xl border px-4 py-3 text-left ${box}`}
                      role="status"
                      aria-live="polite"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p
                            className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${titleColor}`}
                          >
                            {variant === "checking" ? (
                              <span
                                className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border border-[var(--border)] border-t-emerald-400"
                                aria-hidden
                              />
                            ) : null}
                            {t("setup.done.gatewayTitle")}
                          </p>
                          <p className="mt-1.5 text-xs text-[var(--text-muted)] leading-relaxed">{body}</p>
                          {variant === "down" ? (
                            <p className="mt-2 text-[11px] text-[var(--text-muted)]/90 leading-relaxed">
                              {t("setup.done.gatewayHintDown")}
                            </p>
                          ) : null}
                          {gwHealth?.webUrl && variant !== "down" && variant !== "checking" ? (
                            <p className="mt-2 text-[10px] font-mono text-emerald-200/75 break-all">
                              <span className="text-[var(--text-muted)]">{t("setup.done.gatewayChatUrl")}: </span>
                              {gwHealth.webUrl}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          disabled={gwRefreshing}
                          onClick={() => void fetchGatewayHealth(false)}
                          className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[11px] font-medium text-[var(--accent)] hover:border-[var(--accent)]/45 disabled:opacity-50 min-h-[40px] self-start"
                        >
                          {gwRefreshing ? "…" : t("setup.done.gatewayRecheck")}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex flex-wrap gap-2 justify-center mb-8 text-[10px] text-emerald-400/90">
                  <span className="rounded-full border border-emerald-500/30 px-2 py-1">
                    💬 {t("setup.done.brandPillChat")}
                  </span>
                  <span className="rounded-full border border-emerald-500/30 px-2 py-1">🖥 Gateway</span>
                  <span className="rounded-full border border-emerald-500/30 px-2 py-1">📊 {t("nav.oneoneDashboard")}</span>
                </div>

                <div className="flex flex-col gap-3">
                  <button type="button" className={btnPrimary} onClick={openOpenclaw}>
                    {t("setup.openOpenclaw")}
                  </button>
                  <button type="button" className={btnSecondary} onClick={openDashboard}>
                    {t("setup.openDashboard")}
                  </button>
                  <Link
                    href="/"
                    className="text-sm text-[var(--accent)] hover:underline mt-2"
                  >
                    {t("setup.startUsing")}
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {precheck !== "loading" && precheck !== "blocked" && (
        <p className="mt-6 text-center text-[10px] text-[var(--text-muted)]/60 max-w-md leading-relaxed">{t("setup.footerHint")}</p>
      )}
      {precheck === "blocked" && (
        <p className="mt-6 text-center text-[10px] text-[var(--text-muted)]/50 max-w-md leading-relaxed">{t("setup.footerHint")}</p>
      )}
    </div>
  );
}
