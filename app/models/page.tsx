"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { suggestModelCapacity } from "@/lib/model-defaults";

interface Model {
  id: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
  reasoning: boolean;
  input: string[];
  /** 配置中把该 provider/model 设为主模型的 Agent（agents.list[].model 解析后） */
  usedBy?: { id: string; emoji: string; name: string }[];
}

interface Provider {
  id: string;
  api: string;
  accessMode?: "api_key" | "auth";
  models: Model[];
  /** @deprecated 由每行 model.usedBy 替代；保留兼容旧缓存 */
  usedBy?: { id: string; emoji: string; name: string }[];
}

interface ModelStat {
  modelId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  messageCount: number;
  avgResponseMs: number;
}

interface ConfigAgentBrief {
  id: string;
  name?: string;
  emoji?: string;
  /** 解析后的主模型 ref，与 /api/config 中 agents 一致 */
  model?: string;
}

interface ConfigData {
  providers: Provider[];
  defaults: { model: string; fallbacks: string[] };
  agents?: ConfigAgentBrief[];
}

type AddProbeMode = "openclaw" | "custom_http";

interface TestResult {
  ok: boolean;
  text?: string;
  error?: string;
  /** 服务端根据常见错误补充的可读说明 */
  errorHint?: string;
  elapsed: number;
  model?: string;
}

interface ProbePresetItem {
  id: string;
  label: string;
  baseUrl: string;
  protocol: string;
  keyHint: string;
}

// 格式化数字
function formatNum(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}

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

function agentsForModelRef(
  agents: ConfigAgentBrief[] | undefined,
  ref: string,
): { id: string; emoji: string; name: string }[] {
  if (!agents?.length) return [];
  const r = ref.trim();
  return agents
    .filter((a) => typeof a.model === "string" && a.model.trim() === r)
    .map((a) => ({ id: a.id, emoji: a.emoji || "🤖", name: a.name || a.id }));
}

function resolveModelUsedBy(
  agents: ConfigAgentBrief[] | undefined,
  providerId: string,
  modelId: string,
  usedByFromApi?: { id: string; emoji: string; name: string }[],
): { id: string; emoji: string; name: string }[] {
  if (usedByFromApi && usedByFromApi.length > 0) return usedByFromApi;
  return agentsForModelRef(agents, `${providerId}/${modelId}`);
}

export default function ModelsPage() {
  const { t } = useI18n();

  const renderModelUsedBy = (
    list: { id: string; emoji: string; name: string }[],
    compact?: boolean,
  ) => {
    if (!list.length) {
      return (
        <span className={`text-[var(--text-muted)] ${compact ? "text-[10px]" : "text-xs"}`}>
          {t("models.agentsPrimaryNone")}
        </span>
      );
    }
    return (
      <div className={`flex flex-wrap gap-1 ${compact ? "" : "max-w-[14rem] md:max-w-[18rem]"}`}>
        {list.map((a) => (
          <span
            key={a.id}
            title={`${a.id} → ${a.name || a.id}`}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[var(--bg)] border border-[var(--border)] text-[10px] font-medium text-[var(--text)]"
          >
            <span aria-hidden>{a.emoji}</span>
            <span className="max-w-[7rem] truncate">{a.name || a.id}</span>
          </span>
        ))}
      </div>
    );
  };

  const [data, setData] = useState<ConfigData | null>(null);
  const [modelStats, setModelStats] = useState<Record<string, ModelStat>>({});
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  /** 添加模型写入目标：与顶部探测配置同一卡片，由下拉选择 provider */
  const [addTargetProviderId, setAddTargetProviderId] = useState("");
  const [addDraft, setAddDraft] = useState({
    id: "",
    name: "",
    /** 模型提供商名（model_provider），写入配置时可作为显示名的一部分 */
    modelProvider: "",
    contextWindow: "",
    maxTokens: "",
    reasoning: false,
    inputText: true,
    inputImage: false,
  });
  const [addDraftTest, setAddDraftTest] = useState<TestResult | null>(null);
  const [addDraftTesting, setAddDraftTesting] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addBanner, setAddBanner] = useState<{ ok: boolean; text: string } | null>(null);
  /** 仅发往服务端做本次探测，不写入配置、不存 localStorage */
  const [probeOverrideApiKey, setProbeOverrideApiKey] = useState("");
  /** 来自 model-probe-presets.json / openclaw 内嵌；与当前模型 ID 组合走直连探测 */
  const [probePresets, setProbePresets] = useState<ProbePresetItem[]>([]);
  const [probePresetId, setProbePresetId] = useState("");
  /** 探测时合并 agents/<id>/agent/models.json；空字符串表示「不绑定 Agent」，写入时仅追加全局 fallbacks */
  const [probeAgentId, setProbeAgentId] = useState("");
  const [addProbeMode, setAddProbeMode] = useState<AddProbeMode>("openclaw");
  const [addCustomBaseUrl, setAddCustomBaseUrl] = useState("");
  const [addCustomProtocol, setAddCustomProtocol] = useState<"anthropic" | "openai">("anthropic");

  const resetAddDraft = useCallback(() => {
    setAddProbeMode("openclaw");
    setAddCustomBaseUrl("");
    setAddCustomProtocol("anthropic");
    setAddDraft({
      id: "",
      name: "",
      modelProvider: "",
      contextWindow: "",
      maxTokens: "",
      reasoning: false,
      inputText: true,
      inputImage: false,
    });
    setAddDraftTest(null);
    setAddBanner(null);
  }, []);

  useEffect(() => {
    if (!data?.providers?.length) return;
    setAddTargetProviderId((prev) => {
      const ids = data.providers.map((p) => p.id);
      if (prev && ids.includes(prev)) return prev;
      return ids[0]!;
    });
  }, [data]);

  useEffect(() => {
    setAddDraftTest(null);
  }, [addDraft.id, addTargetProviderId, addProbeMode, addCustomBaseUrl, addCustomProtocol, probePresetId]);

  const capacitySuggest = useMemo(() => suggestModelCapacity(addDraft.id), [addDraft.id]);

  const testDraftModel = useCallback(async () => {
    const providerId = addTargetProviderId.trim();
    const modelId = addDraft.id.trim();
    if (!modelId) return;
    if (addProbeMode === "openclaw" && !providerId) return;
    if (addProbeMode === "custom_http" && !addCustomBaseUrl.trim()) return;

    setAddDraftTesting(true);
    setAddDraftTest(null);
    setAddBanner(null);
    const probeCtx = probeAgentId.trim();
    try {
      let body: Record<string, unknown> = { modelId, ...(probeCtx ? { agentId: probeCtx } : {}) };
      if (addProbeMode === "custom_http") {
        body = {
          ...body,
          customHttp: {
            baseUrl: addCustomBaseUrl.trim(),
            protocol: addCustomProtocol,
          },
          ...(providerId ? { provider: providerId } : {}),
          ...(probeOverrideApiKey.trim() ? { overrideApiKey: probeOverrideApiKey.trim() } : {}),
        };
      } else {
        body = {
          ...body,
          provider: providerId!,
          ...(probeOverrideApiKey.trim() ? { overrideApiKey: probeOverrideApiKey.trim() } : {}),
          ...(probePresetId.trim() ? { probePresetId: probePresetId.trim() } : {}),
        };
      }

      const resp = await fetch("/api/test-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await resp.json();
      setAddDraftTest(result);
    } catch (err: any) {
      setAddDraftTest({ ok: false, error: err?.message || "Network error", elapsed: 0 });
    } finally {
      setAddDraftTesting(false);
    }
  }, [
    addTargetProviderId,
    addDraft.id,
    addProbeMode,
    addCustomBaseUrl,
    addCustomProtocol,
    probeOverrideApiKey,
    probePresetId,
    probeAgentId,
  ]);

  const saveDraftModel = useCallback(async () => {
    const providerId = addTargetProviderId.trim();
    if (!providerId || !addDraftTest?.ok) return;
    const id = addDraft.id.trim();
    if (!id) return;
    setAddSaving(true);
    setAddBanner(null);
    const input: string[] = [];
    if (addDraft.inputText) input.push("text");
    if (addDraft.inputImage) input.push("image");
    const contextWindow = addDraft.contextWindow.trim()
      ? parseInt(addDraft.contextWindow, 10)
      : undefined;
    const maxTokens = addDraft.maxTokens.trim() ? parseInt(addDraft.maxTokens, 10) : undefined;
    try {
      const resp = await fetch("/api/config/add-provider-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          model: {
            id,
            ...(addDraft.name.trim() || addDraft.modelProvider.trim()
              ? { name: addDraft.name.trim() || addDraft.modelProvider.trim() }
              : {}),
            ...(contextWindow !== undefined && !Number.isNaN(contextWindow) && contextWindow > 0
              ? { contextWindow }
              : {}),
            ...(maxTokens !== undefined && !Number.isNaN(maxTokens) && maxTokens > 0 ? { maxTokens } : {}),
            ...(addDraft.reasoning ? { reasoning: true } : {}),
            ...(input.length > 0 ? { input } : {}),
          },
          ...(probeAgentId.trim() ? { targetAgentId: probeAgentId.trim() } : {}),
          ...(probeOverrideApiKey.trim() ? { overrideApiKey: probeOverrideApiKey.trim() } : {}),
        }),
      });
      const data = await resp.json();
      if (data.ok) {
        const cfg = await fetch("/api/config").then((r) => r.json());
        if (!cfg.error) setData(cfg);
        resetAddDraft();
        const p = data.configPathPosix || data.configPath;
        const mid = data.model && typeof data.model === "object" && data.model !== null ? (data.model as { id?: string }).id : "";
        const ref = data.providerId && mid ? `${data.providerId}/${mid}` : "";
        const line1 = p ? `${t("models.saveSuccess")} → ${p}` : t("models.saveSuccess");
        const line2 = ref ? t("models.saveSuccessBindHint").replace("{ref}", ref) : "";
        const fb = Array.isArray(data.agentsDefaultsFallbacks) ? data.agentsDefaultsFallbacks : null;
        const line3 =
          data.appendedToDefaultsFallbacks && fb?.length
            ? t("models.saveSuccessFallbacksList").replace("{list}", fb.join(", "))
            : "";
        const line4 =
          data.agentListModelUpdated && data.targetAgentId && ref
            ? t("models.saveSuccessAgentHint")
                .replace("{agentId}", String(data.targetAgentId))
                .replace("{ref}", ref)
            : "";
        setAddBanner({
          ok: true,
          text: [line1, line2, line3, line4].filter(Boolean).join("\n"),
        });
      } else {
        const msg = [data.error, data.errorHint].filter(Boolean).join(" — ");
        const p = data.configPathPosix || data.configPath;
        setAddBanner({
          ok: false,
          text: [msg || t("models.saveFailed"), p ? t("models.configPathRead").replace("{path}", p) : ""]
            .filter(Boolean)
            .join(" "),
        });
      }
    } catch (err: any) {
      setAddBanner({ ok: false, text: err?.message || t("models.saveFailed") });
    } finally {
      setAddSaving(false);
    }
  }, [addTargetProviderId, addDraft, addDraftTest, probeOverrideApiKey, resetAddDraft, t]);

  const testModel = async (providerId: string, modelId: string) => {
    const key = `${providerId}/${modelId}`;
    setTesting((prev) => ({ ...prev, [key]: true }));
    setTestResults((prev) => { const n = { ...prev }; delete n[key]; return n; });
    try {
      const resp = await fetch("/api/test-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          modelId,
          ...(probeAgentId.trim() ? { agentId: probeAgentId.trim() } : {}),
          ...(probeOverrideApiKey.trim() ? { overrideApiKey: probeOverrideApiKey.trim() } : {}),
          ...(probePresetId.trim() ? { probePresetId: probePresetId.trim() } : {}),
        }),
      });
      const result = await resp.json();
      setTestResults((prev) => ({ ...prev, [key]: result }));
    } catch (err: any) {
      setTestResults((prev) => ({ ...prev, [key]: { ok: false, error: err.message, elapsed: 0 } }));
    } finally {
      setTesting((prev) => ({ ...prev, [key]: false }));
    }
  };

  // 首次加载 - 从 localStorage 恢复测试状态
  useEffect(() => {
    Promise.all([
      fetch("/api/config").then((r) => r.json()),
      fetch("/api/stats-models").then((r) => r.json()),
    ])
      .then(([configData, statsData]) => {
        if (configData.error) setError(configData.error);
        else setData(configData);
        if (!statsData.error && statsData.models) {
          const map: Record<string, ModelStat> = {};
          for (const m of statsData.models) {
            map[`${m.provider}/${m.modelId}`] = m;
          }
          setModelStats(map);
        }
      })
      .catch((e) => setError(e.message));

    fetch("/api/model-probe-presets")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error && Array.isArray(d.presets)) setProbePresets(d.presets);
      })
      .catch(() => {});

    // 从 localStorage 恢复测试结果
    const savedTestResults = localStorage.getItem('modelTestResults');
    if (savedTestResults) {
      try {
        setTestResults(JSON.parse(savedTestResults));
      } catch (e) {
        console.error('Failed to parse modelTestResults from localStorage', e);
      }
    }
  }, []);

  // 保存测试结果到 localStorage
  useEffect(() => {
    if (Object.keys(testResults).length > 0) {
      localStorage.setItem('modelTestResults', JSON.stringify(testResults));
    }
  }, [testResults]);

  const probeAgentOptions = useMemo(() => {
    const none = { id: "", name: t("models.probeAgentNone"), emoji: undefined as string | undefined };
    const list = data?.agents;
    if (!list?.length) {
      return [none, { id: "main", name: "main", emoji: "🤖" as string | undefined }];
    }
    return [none, ...list.map((a) => ({
      id: a.id,
      name: a.name || a.id,
      emoji: a.emoji,
    }))];
  }, [data?.agents, t]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-400">{t("common.loadError")}: {error}</p>
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

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-3 mb-6 md:mb-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {t("models.title")}
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {t("models.totalPrefix")} {data.providers.length} {t("models.providerCount")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-[var(--bg)]"
            role="status"
          >
            {t("models.testAll")}
          </span>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)] transition"
          >
            {t("common.backOverview")}
          </Link>
        </div>
      </div>

      {/* 主模型和 Fallback 模型 */}
      <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{t("models.defaultModel")}:</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-green-500/20 text-green-300 border-green-500/30">
            🧠 {data.defaults.model}
          </span>
        </div>
        {data.defaults.fallbacks.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">{t("models.fallbackModels")}:</span>
            {data.defaults.fallbacks.map((f, i) => (
              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                🔄 {f}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--text-muted)]">{t("models.probeAgentLabel")}</span>
          <select
            value={probeAgentId}
            onChange={(e) => setProbeAgentId(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text)]"
          >
            {probeAgentOptions.map((a) => (
              <option key={a.id || "__none__"} value={a.id}>
                {(a.emoji ? `${a.emoji} ` : "") + a.name}
                {a.id ? ` (${a.id})` : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{t("models.probeAgentHint")}</p>
        <p className="text-[11px] text-amber-200/90 leading-relaxed border-l-2 border-amber-400/50 pl-3 py-1 rounded-r bg-amber-500/5">
          {t("models.probeAgentWriteHint")}
        </p>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--text-muted)]">{t("models.probePresetLabel")}</span>
          <select
            value={probePresetId}
            onChange={(e) => setProbePresetId(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text)]"
          >
            <option value="">{t("models.probePresetNone")}</option>
            {probePresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} · {p.protocol} · {p.keyHint}
              </option>
            ))}
          </select>
        </label>
        {probePresets.length === 0 ? (
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{t("models.probePresetEmptyHint")}</p>
        ) : (
          <p className="text-[11px] text-amber-200/75 leading-relaxed">{t("models.probePresetBatchNote")}</p>
        )}
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{t("models.probePresetNoInlineEditHint")}</p>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--text-muted)]">{t("models.probeOverrideKeyLabel")}</span>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <input
              type="password"
              value={probeOverrideApiKey}
              onChange={(e) => setProbeOverrideApiKey(e.target.value)}
              className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 font-mono text-sm text-[var(--text)]"
              placeholder={t("models.probeOverrideKeyPlaceholder")}
              autoComplete="off"
              spellCheck={false}
            />
            {probeOverrideApiKey.trim() ? (
              <button
                type="button"
                onClick={() => setProbeOverrideApiKey("")}
                className="shrink-0 px-3 py-1.5 rounded-md border border-[var(--border)] text-xs text-[var(--text-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--text)]"
              >
                {t("models.clearProbeKey")}
              </button>
            ) : null}
          </div>
        </label>
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{t("models.probeOverrideKeyHint")}</p>

        <div className="border-t border-[var(--border)] pt-4 mt-4 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text)]">{t("models.addModelSectionTitle")}</h3>
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{t("models.saveWritesViaGatewayHint")}</p>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[var(--text-muted)]">{t("models.addTargetProviderLabel")}</span>
            <select
              value={addTargetProviderId}
              onChange={(e) => {
                setAddTargetProviderId(e.target.value);
                setAddDraftTest(null);
                setAddBanner(null);
              }}
              disabled={!data.providers.length}
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm font-mono text-[var(--text)] disabled:opacity-50"
            >
              {data.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.api || "—"}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)]/90 p-4 space-y-3">
            <p className="text-xs text-[var(--text-muted)]">{t("models.addModelDesc")}</p>
            <p className="text-[11px] text-[var(--accent)]/90 font-medium">
              {t("models.addFormUsesAgent")}{" "}
              <span className="font-mono">
                {(() => {
                  const a = probeAgentOptions.find((x) => x.id === probeAgentId);
                  return (a?.emoji ? `${a.emoji} ` : "") + (a?.name || probeAgentId);
                })()}
              </span>
              {t("models.addFormUsesAgentSuffix")}
            </p>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[var(--text-muted)]">{t("models.addProbeModeLabel")}</span>
              <select
                value={addProbeMode}
                onChange={(e) => setAddProbeMode(e.target.value as AddProbeMode)}
                className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--text)]"
              >
                <option value="openclaw">{t("models.addProbeModeOpenClaw")}</option>
                <option value="custom_http">{t("models.addProbeModeCustomHttp")}</option>
              </select>
            </label>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{t("models.addProbeModeHint")}</p>
            {addProbeMode === "openclaw" ? (
              <details className="text-xs text-[var(--text-muted)] rounded-md border border-[var(--border)]/60 bg-[var(--card)]/40 px-3 py-2">
                <summary className="cursor-pointer text-[var(--text)] select-none">{t("models.openClawGatewayHelpTitle")}</summary>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed">{t("models.openClawGatewayHelpBody")}</p>
              </details>
            ) : null}
            {addProbeMode === "custom_http" ? (
              <>
                <details className="text-xs text-[var(--text-muted)] rounded-md border border-[var(--border)]/60 bg-[var(--card)]/40 px-3 py-2">
                  <summary className="cursor-pointer text-[var(--text)] select-none">{t("models.customHttpHelpTitle")}</summary>
                  <p className="mt-2 whitespace-pre-wrap leading-relaxed">{t("models.customHttpHelpBody")}</p>
                </details>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-[var(--text-muted)]">{t("models.customHttpBaseUrl")} *</span>
                  <input
                    value={addCustomBaseUrl}
                    onChange={(e) => setAddCustomBaseUrl(e.target.value)}
                    className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 font-mono text-sm text-[var(--text)]"
                    placeholder="https://your-gateway.example.com"
                    autoComplete="off"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-[var(--text-muted)]">{t("models.customHttpProtocol")}</span>
                  <select
                    value={addCustomProtocol}
                    onChange={(e) => setAddCustomProtocol(e.target.value as "anthropic" | "openai")}
                    className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--text)]"
                  >
                    <option value="anthropic">anthropic（/v1/messages）</option>
                    <option value="openai">openai（/chat/completions）</option>
                  </select>
                </label>
              </>
            ) : null}
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[var(--text-muted)]">
                {t("models.fieldModel")} <span className="text-red-400">*</span>
              </span>
              <input
                value={addDraft.id}
                onChange={(e) => setAddDraft((d) => ({ ...d, id: e.target.value }))}
                className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 font-mono text-sm text-[var(--text)]"
                placeholder={t("models.fieldModelPlaceholder")}
                autoComplete="off"
              />
            </label>
            {!addDraft.id.trim() ? (
              <p className="text-xs text-[var(--text-muted)] border-l-2 border-[var(--accent)]/40 pl-3 py-1 leading-relaxed">
                {t("models.enterIdForSuggest")}
              </p>
            ) : capacitySuggest ? (
              <div className="rounded-md border border-[var(--border)]/80 bg-[var(--card)]/35 px-3 py-2 space-y-2">
                {capacitySuggest.isGeneric ? (
                  <p className="text-[11px] text-amber-300/90 leading-snug">{t("models.suggestedGenericNote")}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[var(--text-muted)]">{t("models.suggestedDefaults")}</span>
                  <span className="font-mono text-[var(--accent)]">
                    ctx {capacitySuggest.contextWindow.toLocaleString()} · max {capacitySuggest.maxTokens.toLocaleString()}
                  </span>
                  <span className="text-[var(--text-muted)]">({capacitySuggest.label})</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAddDraft((d) => ({
                        ...d,
                        contextWindow: String(capacitySuggest.contextWindow),
                        maxTokens: String(capacitySuggest.maxTokens),
                      }))
                    }
                    className={`px-2 py-0.5 rounded border text-xs font-medium transition ${
                      capacitySuggest.isGeneric
                        ? "border-amber-400/40 text-amber-200/90 hover:border-amber-400/60"
                        : "border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent)]/50"
                    }`}
                  >
                    {capacitySuggest.isGeneric ? t("models.applyReference") : t("models.applySuggested")}
                  </button>
                </div>
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs sm:col-span-2">
                <span className="text-[var(--text-muted)]">{t("models.fieldModelProvider")}</span>
                <input
                  value={addDraft.modelProvider}
                  onChange={(e) => setAddDraft((d) => ({ ...d, modelProvider: e.target.value }))}
                  className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--text)]"
                  placeholder={t("models.fieldModelProviderPlaceholder")}
                  autoComplete="off"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs sm:col-span-2">
                <span className="text-[var(--text-muted)]">{t("models.addModelName")}</span>
                <input
                  value={addDraft.name}
                  onChange={(e) => setAddDraft((d) => ({ ...d, name: e.target.value }))}
                  className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--text)]"
                  placeholder={addDraft.id.trim() || "—"}
                  autoComplete="off"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-[var(--text-muted)]">{t("models.addContext")}</span>
                <input
                  type="number"
                  min={1}
                  value={addDraft.contextWindow}
                  onChange={(e) => setAddDraft((d) => ({ ...d, contextWindow: e.target.value }))}
                  className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--text)]"
                  placeholder={
                    capacitySuggest ? String(capacitySuggest.contextWindow) : t("models.fillIdFirstPlaceholder")
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-[var(--text-muted)]">{t("models.addMaxOut")}</span>
                <input
                  type="number"
                  min={1}
                  value={addDraft.maxTokens}
                  onChange={(e) => setAddDraft((d) => ({ ...d, maxTokens: e.target.value }))}
                  className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--text)]"
                  placeholder={
                    capacitySuggest ? String(capacitySuggest.maxTokens) : t("models.fillIdFirstPlaceholder")
                  }
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addDraft.reasoning}
                  onChange={(e) => setAddDraft((d) => ({ ...d, reasoning: e.target.checked }))}
                />
                {t("models.addReasoning")}
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addDraft.inputText}
                  onChange={(e) => setAddDraft((d) => ({ ...d, inputText: e.target.checked }))}
                />
                {t("models.addInputText")}
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addDraft.inputImage}
                  onChange={(e) => setAddDraft((d) => ({ ...d, inputImage: e.target.checked }))}
                />
                {t("models.addInputImage")}
              </label>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={() => void testDraftModel()}
                disabled={
                  addDraftTesting ||
                  !addDraft.id.trim() ||
                  (addProbeMode === "openclaw" && !addTargetProviderId.trim()) ||
                  (addProbeMode === "custom_http" && !addCustomBaseUrl.trim())
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  addDraftTesting ||
                  !addDraft.id.trim() ||
                  (addProbeMode === "openclaw" && !addTargetProviderId.trim()) ||
                  (addProbeMode === "custom_http" && !addCustomBaseUrl.trim())
                    ? "bg-gray-500/20 text-gray-400 cursor-not-allowed"
                    : "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30 hover:bg-[var(--accent)]/40"
                }`}
              >
                {addDraftTesting ? t("common.testing") : t("models.testDraft")}
              </button>
              <button
                type="button"
                onClick={() => void saveDraftModel()}
                disabled={!addDraftTest?.ok || addSaving}
                title={!addDraftTest?.ok ? t("models.saveNeedTest") : undefined}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  !addDraftTest?.ok || addSaving
                    ? "bg-gray-500/15 text-gray-500 cursor-not-allowed border border-[var(--border)]"
                    : "bg-green-600/25 text-green-300 border border-green-500/40 hover:bg-green-600/35"
                }`}
              >
                {addSaving ? "…" : t("models.saveToConfig")}
              </button>
              <button
                type="button"
                onClick={() => resetAddDraft()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                {t("models.cancelAdd")}
              </button>
            </div>
            {addDraftTest && (
              <div className={`text-xs space-y-1 ${addDraftTest.ok ? "text-green-400" : "text-red-400"}`}>
                <p title={addDraftTest.ok ? addDraftTest.text : addDraftTest.error}>
                  {addDraftTest.ok
                    ? `✅ ${t("common.test")} OK · ${formatMs(addDraftTest.elapsed)}`
                    : `❌ ${addDraftTest.error?.slice(0, 160) || "Error"}`}
                </p>
                {!addDraftTest.ok && addDraftTest.errorHint && (
                  <p className="text-amber-200/90 leading-relaxed border-l-2 border-amber-500/50 pl-2">
                    {addDraftTest.errorHint}
                  </p>
                )}
              </div>
            )}
            {addBanner && (
              <p
                className={`text-xs ${addBanner.ok ? "text-green-400 whitespace-pre-line" : "text-red-400"}`}
              >
                {addBanner.text}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {data.providers.map((provider) => (
          <div
            key={provider.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
          >
            <div className="flex flex-col gap-2 mb-4">
              <div>
                <h2 className="text-lg font-semibold">{provider.id}</h2>
                <span className="text-xs text-[var(--text-muted)]">
                  API: {provider.api}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed max-w-3xl">
                {t("models.providerPerModelAgentsHint")}
              </p>
            </div>

            {provider.models.length > 0 ? (
              <div>
                {(() => {
                  const hasDetail = provider.models.some((m: any) => m.contextWindow || m.maxTokens);
                  return (
                <>
                <div className="md:hidden space-y-2">
                  {provider.models.map((m) => {
                    const stat = modelStats[`${provider.id}/${m.id}`];
                    const testKey = `${provider.id}/${m.id}`;
                    const isTesting = testing[testKey];
                    const result = testResults[testKey];
                    const rowAgents = resolveModelUsedBy(data.agents, provider.id, m.id, m.usedBy);
                    return (
                      <div key={m.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-mono text-xs text-[var(--accent)] truncate">{m.id}</div>
                            <div className="text-sm text-[var(--text)] truncate">{m.name || "-"}</div>
                          </div>
                          <span className="shrink-0 px-1.5 py-0.5 rounded bg-[var(--card)] text-[10px] border border-[var(--border)]">
                            {provider.accessMode === "auth" ? t("models.accessModeAuth") : t("models.accessModeApiKey")}
                          </span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-[var(--border)]/60">
                          <div className="text-[10px] text-[var(--text-muted)] mb-1">{t("models.colAgentsPrimary")}</div>
                          {renderModelUsedBy(rowAgents, true)}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1">
                            <div className="text-[var(--text-muted)]">{t("models.colInputToken")}</div>
                            <div className="text-blue-400 font-mono">{stat ? formatTokens(stat.inputTokens) : "-"}</div>
                          </div>
                          <div className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1">
                            <div className="text-[var(--text-muted)]">{t("models.colOutputToken")}</div>
                            <div className="text-emerald-400 font-mono">{stat ? formatTokens(stat.outputTokens) : "-"}</div>
                          </div>
                          <div className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1">
                            <div className="text-[var(--text-muted)]">{t("models.colAvgResponse")}</div>
                            <div className="text-amber-400 font-mono">{stat ? formatMs(stat.avgResponseMs) : "-"}</div>
                          </div>
                          {hasDetail && (
                            <div className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1">
                              <div className="text-[var(--text-muted)]">{t("models.colContext")}</div>
                              <div className="text-[var(--text)] font-mono">{formatNum(m.contextWindow || 0)}</div>
                            </div>
                          )}
                        </div>
                        {hasDetail && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {(m.input || []).map((inputType) => (
                              <span key={inputType} className="px-1.5 py-0.5 rounded bg-[var(--card)] text-[10px]">
                                {inputType === "text" ? "📝" : "🖼️"} {inputType}
                              </span>
                            ))}
                            <span className="px-1.5 py-0.5 rounded bg-[var(--card)] text-[10px]">
                              {t("models.colReasoning")}: {m.reasoning ? "✅" : "❌"}
                            </span>
                          </div>
                        )}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <button
                            onClick={() => testModel(provider.id, m.id)}
                            disabled={isTesting}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                              isTesting
                                ? "bg-gray-500/20 text-gray-400 cursor-wait"
                                : "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30 hover:bg-[var(--accent)]/40 cursor-pointer"
                            }`}
                          >
                            {isTesting ? t("common.testing") : t("common.test")}
                          </button>
                          {result && (
                            <div className="flex flex-col items-end gap-0.5 min-w-0 max-w-[56vw]">
                              <span
                                className={`text-[10px] ${result.ok ? "text-green-400" : "text-red-400"} truncate w-full text-right`}
                                title={
                                  result.ok
                                    ? result.text
                                    : [result.error, result.errorHint].filter(Boolean).join("\n\n")
                                }
                              >
                                {result.ok ? `✅ ${formatMs(result.elapsed)}` : `❌ ${result.error?.slice(0, 42)}`}
                              </span>
                              {!result.ok && result.errorHint && (
                                <span className="text-[9px] text-amber-300/85 text-right leading-snug line-clamp-3">
                                  {result.errorHint}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)]">
                      <th className="text-left py-2 pr-4">{t("models.colModelId")}</th>
                      <th className="text-left py-2 pr-4">{t("models.colName")}</th>
                      <th className="text-left py-2 pr-4 min-w-[8rem]">{t("models.colAgentsPrimary")}</th>
                      <th className="text-left py-2 pr-4">{t("models.colAccessMode")}</th>
                      {hasDetail && <th className="text-left py-2 pr-4">{t("models.colContext")}</th>}
                      {hasDetail && <th className="text-left py-2 pr-4">{t("models.colMaxOutput")}</th>}
                      {hasDetail && <th className="text-left py-2 pr-4">{t("models.colInputType")}</th>}
                      {hasDetail && <th className="text-left py-2 pr-4">{t("models.colReasoning")}</th>}
                      <th className="text-right py-2 pr-4">{t("models.colInputToken")}</th>
                      <th className="text-right py-2 pr-4">{t("models.colOutputToken")}</th>
                      <th className="text-right py-2 pr-4">{t("models.colAvgResponse")}</th>
                      <th className="text-center py-2">{t("models.colTest")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provider.models.map((m) => {
                      const stat = modelStats[`${provider.id}/${m.id}`];
                      const testKey = `${provider.id}/${m.id}`;
                      const isTesting = testing[testKey];
                      const result = testResults[testKey];
                      const rowAgents = resolveModelUsedBy(data.agents, provider.id, m.id, m.usedBy);
                      return (
                      <tr key={m.id} className="border-b border-[var(--border)]/50">
                        <td className="py-2 pr-4 font-mono text-[var(--accent)]">{m.id}</td>
                        <td className="py-2 pr-4">{m.name || "-"}</td>
                        <td className="py-2 pr-4 align-top">{renderModelUsedBy(rowAgents)}</td>
                        <td className="py-2 pr-4">
                          <span className="px-1.5 py-0.5 rounded bg-[var(--bg)] text-xs">
                            {provider.accessMode === "auth" ? t("models.accessModeAuth") : t("models.accessModeApiKey")}
                          </span>
                        </td>
                        {hasDetail && <td className="py-2 pr-4">{formatNum(m.contextWindow)}</td>}
                        {hasDetail && <td className="py-2 pr-4">{formatNum(m.maxTokens)}</td>}
                        {hasDetail && <td className="py-2 pr-4">
                          <div className="flex gap-1">
                            {(m.input || []).map((inputType) => (
                              <span
                                key={inputType}
                                className="px-1.5 py-0.5 rounded bg-[var(--bg)] text-xs"
                              >
                                {inputType === "text" ? "📝" : "🖼️"} {inputType}
                              </span>
                            ))}
                          </div>
                        </td>}
                        {hasDetail && <td className="py-2 pr-4">{m.reasoning ? "✅" : "❌"}</td>}
                        <td className="py-2 pr-4 text-right text-blue-400 font-mono text-xs">{stat ? formatTokens(stat.inputTokens) : "-"}</td>
                        <td className="py-2 pr-4 text-right text-emerald-400 font-mono text-xs">{stat ? formatTokens(stat.outputTokens) : "-"}</td>
                        <td className="py-2 pr-4 text-right text-amber-400 font-mono text-xs">{stat ? formatMs(stat.avgResponseMs) : "-"}</td>
                        <td className="py-2 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <button
                              onClick={() => testModel(provider.id, m.id)}
                              disabled={isTesting}
                              className={`px-2 py-1 rounded text-xs font-medium transition ${
                                isTesting
                                  ? "bg-gray-500/20 text-gray-400 cursor-wait"
                                  : "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30 hover:bg-[var(--accent)]/40 cursor-pointer"
                              }`}
                            >
                              {isTesting ? t("common.testing") : t("common.test")}
                            </button>
                            {result && (
                              <div className="flex flex-col items-center gap-0.5 max-w-[min(200px,28vw)]">
                                <span
                                  className={`text-[10px] truncate w-full text-center ${result.ok ? "text-green-400" : "text-red-400"}`}
                                  title={
                                    result.ok
                                      ? result.text
                                      : [result.error, result.errorHint].filter(Boolean).join("\n\n")
                                  }
                                >
                                  {result.ok ? `✅ ${formatMs(result.elapsed)}` : `❌ ${result.error?.slice(0, 30)}`}
                                </span>
                                {!result.ok && result.errorHint && (
                                  <span className="text-[9px] text-amber-300/85 text-center leading-snug line-clamp-3">
                                    {result.errorHint}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                </>
                  )
                })()}
              </div>
            ) : (
              <div>
                <p className="text-[var(--text-muted)] text-sm">
                  {t("models.noExplicitModels")}
                </p>
                {(() => {
                  const providerStats = Object.values(modelStats).filter(s => s.provider === provider.id);
                  if (providerStats.length === 0) return null;
                  const totalInput = providerStats.reduce((s, m) => s + m.inputTokens, 0);
                  const totalOutput = providerStats.reduce((s, m) => s + m.outputTokens, 0);
                  const allRt = providerStats.filter(m => m.avgResponseMs > 0);
                  const avgRt = allRt.length > 0 ? Math.round(allRt.reduce((s, m) => s + m.avgResponseMs, 0) / allRt.length) : 0;
                  return (
                    <div className="flex flex-wrap gap-3 mt-3 text-xs">
                      {providerStats.map(s => {
                        const testKey = `${s.provider}/${s.modelId}`;
                        const isTesting = testing[testKey];
                        const result = testResults[testKey];
                        const rowAgents = resolveModelUsedBy(data.agents, s.provider, s.modelId);
                        return (
                        <div key={s.modelId} className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                          <span className="font-mono text-[var(--accent)]">{s.modelId}</span>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-[10px] text-[var(--text-muted)]">{t("models.colAgentsPrimary")}</span>
                            {renderModelUsedBy(rowAgents, true)}
                          </div>
                          <span className="text-blue-400">Input: {formatTokens(s.inputTokens)}</span>
                          <span className="text-emerald-400">Output: {formatTokens(s.outputTokens)}</span>
                          <span className="text-amber-400">{formatMs(s.avgResponseMs)}</span>
                          <button
                            onClick={() => testModel(s.provider, s.modelId)}
                            disabled={isTesting}
                            className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                              isTesting
                                ? "bg-gray-500/20 text-gray-400 cursor-wait"
                                : "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30 hover:bg-[var(--accent)]/40 cursor-pointer"
                            }`}
                          >
                            {isTesting ? "⏳" : t("common.test")}
                          </button>
                          {result && (
                            <div className="flex flex-col gap-0.5 items-start min-w-0">
                              <span
                                className={`text-[10px] ${result.ok ? "text-green-400" : "text-red-400"}`}
                                title={
                                  result.ok
                                    ? result.text
                                    : [result.error, result.errorHint].filter(Boolean).join("\n\n")
                                }
                              >
                                {result.ok ? `✅ ${formatMs(result.elapsed)}` : `❌ ${result.error?.slice(0, 30)}`}
                              </span>
                              {!result.ok && result.errorHint && (
                                <span className="text-[9px] text-amber-300/85 leading-snug">{result.errorHint}</span>
                              )}
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

          </div>
        ))}
      </div>
    </main>
  );
}
