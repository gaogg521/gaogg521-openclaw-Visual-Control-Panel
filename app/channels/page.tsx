"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  IM_CHANNEL_IDS,
  type ImChannelId,
  type ImChannelDraft,
  type BindingRow,
  type AccountRow,
  emptyDraft,
  draftFromChannelRaw,
  serializeImChannel,
  bindingFromRaw,
  bindingToRaw,
  validateDraft,
  validateBindingRow,
  filterImBindings,
  mergeBindingsPreserveOthers,
  pickChannelsKey,
  getChannelsContainer,
  listConfiguredChannelKeys,
  mergeChannelsObjectsForListing,
  getExistingChannelSummary,
  imChannelObjectHasData,
} from "@/lib/im-channel-config";

const CARD =
  "rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a1a23]/95 to-[#121218]/98 p-6";

const INPUT =
  "w-full max-w-md px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm";

const BTN = "px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium";
const BTN_SEC = "px-3 py-1.5 rounded-lg border border-white/15 text-sm text-[var(--text)] hover:bg-white/5";

function newLocalId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function ChannelsPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIm, setActiveIm] = useState<ImChannelId>("feishu");
  const [tab, setTab] = useState<"basic" | "accounts" | "groups" | "bindings">("basic");
  const [channelKey, setChannelKey] = useState<"channels" | "ro_channels">("channels");
  const [fullChannels, setFullChannels] = useState<Record<string, unknown>>({});
  /** channels + ro_channels 合并视图，仅用于「已有通道」列表，避免只配在 channels 时被漏掉 */
  const [listingContainer, setListingContainer] = useState<Record<string, unknown>>({});
  const [rawByIm, setRawByIm] = useState<Record<ImChannelId, unknown>>({
    feishu: undefined,
    wework: undefined,
    dingtalk: undefined,
  });
  const [drafts, setDrafts] = useState<Record<ImChannelId, ImChannelDraft>>({
    feishu: emptyDraft(),
    wework: emptyDraft(),
    dingtalk: emptyDraft(),
  });
  const [bindingsAll, setBindingsAll] = useState<unknown[]>([]);
  const [bindingRows, setBindingRows] = useState<BindingRow[]>([]);
  const [agentOptions, setAgentOptions] = useState<{ id: string; name: string }[]>([]);
  const [jsonIO, setJsonIO] = useState("");
  const [jsonIOOpen, setJsonIOOpen] = useState(false);
  /** 底部快照表：是否明文显示 appSecret（按通道键） */
  const [secretRevealed, setSecretRevealed] = useState<Record<string, boolean>>({});
  /** 进入页面或上次完整加载时，各 IM 通道在配置里是否已有对象（用于判断是否「重复添加」） */
  const rawByImAtLoadRef = useRef<Record<ImChannelId, unknown>>({
    feishu: undefined,
    wework: undefined,
    dingtalk: undefined,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfgRes, agentsRes] = await Promise.all([
        fetch("/api/openclaw/config", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/config", { cache: "no-store" }).then((r) => r.json()),
      ]);
      const cfg = cfgRes && typeof cfgRes === "object" ? cfgRes : {};
      const key = pickChannelsKey(cfg as Record<string, unknown>);
      setChannelKey(key);
      const container = getChannelsContainer(cfg as Record<string, unknown>);
      setFullChannels(container);
      setListingContainer(mergeChannelsObjectsForListing(cfg as Record<string, unknown>));
      const nextRaw: Record<ImChannelId, unknown> = { feishu: undefined, wework: undefined, dingtalk: undefined };
      const nextDraft: Record<ImChannelId, ImChannelDraft> = {
        feishu: emptyDraft(),
        wework: emptyDraft(),
        dingtalk: emptyDraft(),
      };
      for (const id of IM_CHANNEL_IDS) {
        nextRaw[id] = container[id];
        nextDraft[id] = draftFromChannelRaw(container[id]);
      }
      setRawByIm(nextRaw);
      rawByImAtLoadRef.current = { ...nextRaw };
      setDrafts(nextDraft);
      const allB = Array.isArray(cfg.bindings) ? cfg.bindings : [];
      setBindingsAll(allB);
      const imOnly = filterImBindings(allB);
      setBindingRows(imOnly.map((b, i) => bindingFromRaw(b, newLocalId(`b${i}`))));
      const agents = Array.isArray(agentsRes.agents) ? agentsRes.agents : [];
      setAgentOptions(
        agents.map((a: { id?: string; name?: string }) => ({
          id: a.id ?? "",
          name: a.name ?? a.id ?? "",
        })).filter((a: { id: string }) => a.id),
      );
      setSecretRevealed({});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("oneone.channelsFetchFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const setDraft = (id: ImChannelId, patch: Partial<ImChannelDraft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const updateAccounts = (id: ImChannelId, accounts: AccountRow[]) => {
    setDraft(id, { accounts });
  };

  const addAccount = (id: ImChannelId) => {
    const cur = drafts[id].accounts;
    updateAccounts(id, [
      ...cur,
      { accountId: cur.length ? `account_${cur.length + 1}` : "default", appId: "", appSecret: "", groups: [] },
    ]);
  };

  const removeAccount = (id: ImChannelId, index: number) => {
    const cur = drafts[id].accounts;
    updateAccounts(
      id,
      cur.filter((_, i) => i !== index),
    );
  };

  const patchAccount = (id: ImChannelId, index: number, patch: Partial<AccountRow>) => {
    const cur = drafts[id].accounts.map((a, i) => (i === index ? { ...a, ...patch } : a));
    updateAccounts(id, cur);
  };

  const addGroupRule = (id: ImChannelId, accountIndex: number) => {
    const cur = drafts[id].accounts.map((a, i) =>
      i === accountIndex ? { ...a, groups: [...a.groups, { groupId: "", requireMention: false }] } : a,
    );
    updateAccounts(id, cur);
  };

  const patchGroup = (
    id: ImChannelId,
    accountIndex: number,
    groupIndex: number,
    patch: Partial<{ groupId: string; requireMention: boolean }>,
  ) => {
    const cur = drafts[id].accounts.map((a, ai) => {
      if (ai !== accountIndex) return a;
      const groups = a.groups.map((g, gi) => (gi === groupIndex ? { ...g, ...patch } : g));
      return { ...a, groups };
    });
    updateAccounts(id, cur);
  };

  const removeGroup = (id: ImChannelId, accountIndex: number, groupIndex: number) => {
    const cur = drafts[id].accounts.map((a, ai) => {
      if (ai !== accountIndex) return a;
      return { ...a, groups: a.groups.filter((_, gi) => gi !== groupIndex) };
    });
    updateAccounts(id, cur);
  };

  const addBinding = () => {
    setBindingRows((prev) => [
      ...prev,
      {
        localId: newLocalId("bind"),
        agentId: agentOptions[0]?.id ?? "main",
        channel: activeIm,
        accountId: "",
        peerKind: "group",
        peerId: "",
      },
    ]);
  };

  const patchBinding = (localId: string, patch: Partial<BindingRow>) => {
    setBindingRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
  };

  const removeBinding = (localId: string) => {
    setBindingRows((prev) => prev.filter((r) => r.localId !== localId));
  };

  const doSave = async () => {
    const errs: string[] = [];
    for (const im of IM_CHANNEL_IDS) {
      if (drafts[im].enabled) {
        errs.push(...validateDraft(drafts[im]).map((k) => `${im}:${k}`));
      }
    }
    for (const row of bindingRows) {
      errs.push(...validateBindingRow(row).map((k) => `binding:${k}`));
    }
    if (errs.length) {
      setError(t("oneone.channelsValidationError") + " " + errs.join(", "));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const freshCfg = await fetch("/api/openclaw/config", { cache: "no-store" }).then((r) => r.json());
      const freshMerged = mergeChannelsObjectsForListing(
        freshCfg && typeof freshCfg === "object" ? (freshCfg as Record<string, unknown>) : {},
      );
      for (const im of IM_CHANNEL_IDS) {
        if (!drafts[im].enabled) continue;
        const hadAtPageLoad = imChannelObjectHasData(rawByImAtLoadRef.current[im]);
        if (!hadAtPageLoad && imChannelObjectHasData(freshMerged[im])) {
          const msg = t("oneone.channelsAlreadyExistsMsg");
          setSaving(false);
          setError(msg);
          alert(msg);
          return;
        }
      }

      const nextContainer: Record<string, unknown> = { ...fullChannels };
      for (const im of IM_CHANNEL_IDS) {
        nextContainer[im] = serializeImChannel(drafts[im], rawByIm[im] ?? nextContainer[im]);
      }
      const nextBindings = mergeBindingsPreserveOthers(bindingsAll, bindingRows);
      const res = await fetch("/api/openclaw/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [channelKey]: nextContainer, bindings: nextBindings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("oneone.channelsSaveFailed"));
      alert(t("oneone.channelsSaveSuccess"));
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("oneone.channelsSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (window.confirm(t("oneone.channelsSaveConfirm"))) void doSave();
  };

  const exportJson = () => {
    const ch: Record<string, unknown> = {};
    for (const im of IM_CHANNEL_IDS) {
      ch[im] = serializeImChannel(drafts[im], rawByIm[im]);
    }
    const imBindings = bindingRows.map(bindingToRaw);
    setJsonIO(JSON.stringify({ channels: ch, bindings: imBindings }, null, 2));
    setJsonIOOpen(true);
  };

  const applyImport = () => {
    try {
      const parsed = JSON.parse(jsonIO) as { channels?: Record<string, unknown>; bindings?: unknown[] };
      if (parsed.channels && typeof parsed.channels === "object") {
        for (const im of IM_CHANNEL_IDS) {
          if (!(im in parsed.channels!)) continue;
          if (imChannelObjectHasData(listingContainer[im])) {
            const msg = t("oneone.channelsAlreadyExistsMsg");
            setError(msg);
            alert(msg);
            return;
          }
        }
        for (const im of IM_CHANNEL_IDS) {
          if (im in parsed.channels!) {
            setRawByIm((prev) => ({ ...prev, [im]: parsed.channels![im] }));
            setDrafts((prev) => ({ ...prev, [im]: draftFromChannelRaw(parsed.channels![im]) }));
          }
        }
      }
      if (Array.isArray(parsed.bindings)) {
        const imOnly = filterImBindings(parsed.bindings);
        setBindingRows(imOnly.map((b, i) => bindingFromRaw(b, newLocalId(`imp${i}`))));
      }
      setError(null);
      alert(t("oneone.channelsImportOk"));
    } catch {
      setError(t("oneone.channelsImportInvalid"));
    }
  };

  const d = drafts[activeIm];

  const channelKeys = useMemo(() => listConfiguredChannelKeys(listingContainer), [listingContainer]);

  const imLabel = (id: ImChannelId) => {
    if (id === "feishu") return t("oneone.channelsFeishu");
    if (id === "wework") return t("oneone.channelsWework");
    return t("oneone.channelsDingtalk");
  };

  const channelDisplayName = (key: string) => {
    if (key === "feishu") return t("oneone.channelsFeishu");
    if (key === "wework") return t("oneone.channelsWework");
    if (key === "dingtalk") return t("oneone.channelsDingtalk");
    return key;
  };

  return (
    <div className="p-4 md:p-6 text-[var(--text)] max-w-6xl mx-auto">
      <h1 className="text-xl font-semibold mb-2">{t("oneone.channelsTitle")}</h1>
      <p className="text-[var(--text-muted)] text-sm mb-6">{t("oneone.channelsHint")}</p>

      <div className={CARD}>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {loading ? (
          <p className="text-[var(--text-muted)] py-8">{t("common.loading")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-sm text-[var(--text-muted)] mr-2">{t("oneone.channelsChannelType")}</span>
              {IM_CHANNEL_IDS.map((id) => {
                const has = imChannelObjectHasData(fullChannels[id] ?? listingContainer[id]);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveIm(id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                      activeIm === id
                        ? "bg-[var(--accent)] text-white"
                        : "border border-white/15 text-[var(--text-muted)] hover:bg-white/5"
                    }`}
                  >
                    {has && (
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" title={t("oneone.channelsExistingConfigured")} />
                    )}
                    {imLabel(id)}
                    {id !== "feishu" && (
                      <span className="ml-1 text-[10px] opacity-70">{t("oneone.channelsReservedTag")}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {(activeIm === "wework" || activeIm === "dingtalk") && (
              <p className="text-amber-200/90 text-xs mb-4">{t("oneone.channelsSymmetricHint")}</p>
            )}

            <div className="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-3">
              {(
                [
                  ["basic", "oneone.channelsTabBasic"],
                  ["accounts", "oneone.channelsTabAccounts"],
                  ["groups", "oneone.channelsTabGroups"],
                  ["bindings", "oneone.channelsTabBindings"],
                ] as const
              ).map(([k, tk]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${
                    tab === k ? "bg-white/10 text-[var(--text)]" : "text-[var(--text-muted)] hover:bg-white/5"
                  }`}
                >
                  {t(tk)}
                </button>
              ))}
            </div>

            {tab === "basic" && (
              <div className="space-y-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={d.enabled}
                    onChange={(e) => setDraft(activeIm, { enabled: e.target.checked })}
                    className="rounded border-[var(--border)]"
                  />
                  <span>{t("oneone.channelsEnabledMaster")}</span>
                </label>
                {activeIm === "feishu" && (
                  <div>
                    <label className="block text-[var(--text-muted)] mb-1">{t("oneone.channelsDomain")}</label>
                    <input
                      type="text"
                      value={d.domain}
                      onChange={(e) => setDraft(activeIm, { domain: e.target.value })}
                      className={INPUT}
                      placeholder="feishu.cn / lark"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[var(--text-muted)] mb-1">{t("oneone.channelsAllowFrom")}</label>
                  <textarea
                    value={d.allowFromText}
                    onChange={(e) => setDraft(activeIm, { allowFromText: e.target.value })}
                    rows={4}
                    className={`${INPUT} max-w-full font-mono text-xs`}
                    placeholder={t("oneone.channelsAllowFromPh")}
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={d.requireMention}
                    onChange={(e) => setDraft(activeIm, { requireMention: e.target.checked })}
                    className="rounded border-[var(--border)]"
                  />
                  <span>requireMention — {t("oneone.channelsRequireMention")}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={d.streaming}
                    onChange={(e) => setDraft(activeIm, { streaming: e.target.checked })}
                    className="rounded border-[var(--border)]"
                  />
                  <span>streaming — {t("oneone.channelsStreaming")}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={d.threadSession}
                    onChange={(e) => setDraft(activeIm, { threadSession: e.target.checked })}
                    className="rounded border-[var(--border)]"
                  />
                  <span>threadSession — {t("oneone.channelsThreadSession")}</span>
                </label>
                <div className="pt-4 border-t border-white/10">
                  <p className="text-[var(--text-muted)] text-xs mb-2">{t("oneone.channelsLegacyCreds")}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[var(--text-muted)] mb-1">appId</label>
                      <input
                        type="text"
                        value={d.legacyAppId}
                        onChange={(e) => setDraft(activeIm, { legacyAppId: e.target.value })}
                        className={INPUT}
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-[var(--text-muted)] mb-1">appSecret</label>
                      <input
                        type="password"
                        value={d.legacyAppSecret}
                        onChange={(e) => setDraft(activeIm, { legacyAppSecret: e.target.value })}
                        className={INPUT}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <p className="text-[var(--text-muted)] text-xs mt-2">{t("oneone.channelsLegacyNote")}</p>
                </div>
              </div>
            )}

            {tab === "accounts" && (
              <div className="space-y-6">
                <button type="button" className={BTN} onClick={() => addAccount(activeIm)}>
                  {t("oneone.channelsAddAccount")}
                </button>
                {d.accounts.length === 0 && (
                  <p className="text-[var(--text-muted)] text-sm">{t("oneone.channelsNoAccounts")}</p>
                )}
                {d.accounts.map((acc, ai) => (
                  <div
                    key={`${acc.accountId}-${ai}`}
                    className="rounded-xl border border-white/10 p-4 space-y-3 bg-black/20"
                  >
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="block text-[var(--text-muted)] text-xs mb-1">
                          {t("oneone.channelsAccountId")}
                        </label>
                        <input
                          type="text"
                          value={acc.accountId}
                          onChange={(e) => patchAccount(activeIm, ai, { accountId: e.target.value })}
                          className={INPUT}
                        />
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-[var(--text-muted)] text-xs mb-1">appId</label>
                        <input
                          type="text"
                          value={acc.appId}
                          onChange={(e) => patchAccount(activeIm, ai, { appId: e.target.value })}
                          className={INPUT}
                        />
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-[var(--text-muted)] text-xs mb-1">appSecret</label>
                        <input
                          type="password"
                          value={acc.appSecret}
                          onChange={(e) => patchAccount(activeIm, ai, { appSecret: e.target.value })}
                          className={INPUT}
                          autoComplete="new-password"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAccount(activeIm, ai)}
                        className="text-red-400 text-sm hover:underline"
                      >
                        {t("oneone.channelsDelete")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "groups" && (
              <div className="space-y-8">
                {d.accounts.length === 0 ? (
                  <p className="text-[var(--text-muted)] text-sm">{t("oneone.channelsGroupsNeedAccounts")}</p>
                ) : (
                  d.accounts.map((acc, ai) => (
                    <div key={`g-${acc.accountId}-${ai}`} className="rounded-xl border border-white/10 p-4 bg-black/20">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h3 className="text-sm font-medium">
                          {t("oneone.channelsAccountId")}: <code className="text-[var(--accent)]">{acc.accountId || "—"}</code>
                        </h3>
                        <button type="button" className={BTN_SEC} onClick={() => addGroupRule(activeIm, ai)}>
                          {t("oneone.channelsAddGroupRule")}
                        </button>
                      </div>
                      {acc.groups.length === 0 ? (
                        <p className="text-[var(--text-muted)] text-xs">{t("oneone.channelsNoGroupRules")}</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10 text-[var(--text-muted)]">
                              <th className="text-left py-2">{t("oneone.channelsGroupId")}</th>
                              <th className="text-left py-2">groups.*.requireMention</th>
                              <th className="w-20" />
                            </tr>
                          </thead>
                          <tbody>
                            {acc.groups.map((g, gi) => (
                              <tr key={gi} className="border-b border-white/5">
                                <td className="py-2 pr-2">
                                  <input
                                    type="text"
                                    value={g.groupId}
                                    onChange={(e) => patchGroup(activeIm, ai, gi, { groupId: e.target.value })}
                                    className={INPUT}
                                    placeholder="oc_xxx / chat id"
                                  />
                                </td>
                                <td className="py-2">
                                  <label className="inline-flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={g.requireMention}
                                      onChange={(e) =>
                                        patchGroup(activeIm, ai, gi, { requireMention: e.target.checked })
                                      }
                                    />
                                    <span className="text-[var(--text-muted)]">{t("oneone.channelsGroupRm")}</span>
                                  </label>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => removeGroup(activeIm, ai, gi)}
                                    className="text-red-400 text-xs hover:underline"
                                  >
                                    {t("oneone.channelsDelete")}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "bindings" && (
              <div className="space-y-4">
                <p className="text-[var(--text-muted)] text-xs">{t("oneone.channelsBindingsHint")}</p>
                <button type="button" className={BTN} onClick={addBinding}>
                  {t("oneone.channelsAddBinding")}
                </button>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead>
                      <tr className="border-b border-white/10 text-[var(--text-muted)]">
                        <th className="text-left py-2 px-1">agentId</th>
                        <th className="text-left py-2 px-1">match.channel</th>
                        <th className="text-left py-2 px-1">match.accountId</th>
                        <th className="text-left py-2 px-1">peer.kind</th>
                        <th className="text-left py-2 px-1">peer.id</th>
                        <th className="w-16" />
                      </tr>
                    </thead>
                    <tbody>
                      {bindingRows.map((row) => (
                        <tr key={row.localId} className="border-b border-white/5 align-top">
                          <td className="py-2 px-1">
                            <select
                              value={row.agentId}
                              onChange={(e) => patchBinding(row.localId, { agentId: e.target.value })}
                              className={INPUT}
                            >
                              {agentOptions.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name} ({a.id})
                                </option>
                              ))}
                              {!agentOptions.some((a) => a.id === row.agentId) && row.agentId && (
                                <option value={row.agentId}>{row.agentId}</option>
                              )}
                            </select>
                          </td>
                          <td className="py-2 px-1">
                            <select
                              value={row.channel}
                              onChange={(e) => patchBinding(row.localId, { channel: e.target.value })}
                              className={INPUT}
                            >
                              {IM_CHANNEL_IDS.map((id) => (
                                <option key={id} value={id}>
                                  {id}
                                </option>
                              ))}
                              {row.channel &&
                                !(IM_CHANNEL_IDS as readonly string[]).includes(row.channel) && (
                                <option value={row.channel}>{row.channel}</option>
                              )}
                            </select>
                          </td>
                          <td className="py-2 px-1">
                            <input
                              type="text"
                              value={row.accountId}
                              onChange={(e) => patchBinding(row.localId, { accountId: e.target.value })}
                              className={INPUT}
                              placeholder="optional"
                            />
                          </td>
                          <td className="py-2 px-1">
                            <select
                              value={row.peerKind}
                              onChange={(e) => patchBinding(row.localId, { peerKind: e.target.value })}
                              className={INPUT}
                            >
                              <option value="group">group</option>
                              <option value="user">user</option>
                              <option value="direct">direct</option>
                            </select>
                          </td>
                          <td className="py-2 px-1">
                            <input
                              type="text"
                              value={row.peerId}
                              onChange={(e) => patchBinding(row.localId, { peerId: e.target.value })}
                              className={INPUT}
                              placeholder="group / user id"
                            />
                          </td>
                          <td className="py-2 px-1">
                            <button
                              type="button"
                              onClick={() => removeBinding(row.localId)}
                              className="text-red-400 text-xs hover:underline"
                            >
                              {t("oneone.channelsDelete")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-8 pt-4 border-t border-white/10">
              <button type="button" className={BTN} onClick={save} disabled={saving}>
                {saving ? t("common.loading") : t("oneone.channelsSaveToConfig")}
              </button>
              <button type="button" className={BTN_SEC} onClick={() => void load()}>
                {t("oneone.channelsReload")}
              </button>
              <button type="button" className={BTN_SEC} onClick={exportJson}>
                {t("oneone.channelsExport")}
              </button>
              <button type="button" className={BTN_SEC} onClick={() => setJsonIOOpen((v) => !v)}>
                {t("oneone.channelsImport")}
              </button>
            </div>

            {jsonIOOpen && (
              <div className="mt-4 space-y-2">
                <textarea
                  value={jsonIO}
                  onChange={(e) => setJsonIO(e.target.value)}
                  rows={12}
                  className="w-full font-mono text-xs rounded border border-white/15 bg-black/30 p-3 text-[var(--text)]"
                  placeholder={t("oneone.channelsJsonPlaceholder")}
                />
                <button type="button" className={BTN} onClick={applyImport}>
                  {t("oneone.channelsImportApply")}
                </button>
              </div>
            )}

            <div className="mt-10 pt-6 border-t border-white/10">
              <h2 className="text-sm font-semibold mb-1">{t("oneone.channelsExistingTitle")}</h2>
              <p className="text-xs text-[var(--text-muted)] mb-3">
                <span className="font-mono">{t("oneone.channelsExistingStorage")}: {channelKey}</span>
              </p>
              {channelKeys.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">{t("oneone.channelsExistingEmpty")}</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-white/10">
                  <table className="w-full text-sm text-left border-collapse min-w-[520px]">
                    <thead>
                      <tr className="border-b border-white/10 bg-black/20 text-[var(--text-muted)]">
                        <th className="py-2.5 px-3 font-medium">{t("oneone.channelsColPipe")}</th>
                        <th className="py-2.5 px-3 font-medium">appId</th>
                        <th className="py-2.5 px-3 font-medium">appSecret</th>
                        <th className="py-2.5 px-3 font-medium">{t("oneone.channelsColDomain")}</th>
                        <th className="py-2.5 px-3 font-medium">{t("oneone.channelsColEnabled")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channelKeys.map((name) => {
                        const sum = getExistingChannelSummary(name, listingContainer[name]);
                        return (
                          <tr key={name} className="border-b border-white/5 last:border-0">
                            <td className="py-2.5 px-3 text-[var(--text)]">{channelDisplayName(name)}</td>
                            <td className="py-2.5 px-3 font-mono text-xs break-all max-w-[220px] align-top">
                              {sum.appId}
                            </td>
                            <td className="py-2.5 px-3 align-top">
                              <div className="flex items-start gap-1.5 max-w-[280px]">
                                <span
                                  className={`font-mono text-xs break-all flex-1 min-w-0 ${
                                    secretRevealed[name] ? "text-[var(--text)]" : "text-[var(--text-muted)]"
                                  }`}
                                >
                                  {secretRevealed[name] && sum.appSecretPlain
                                    ? sum.appSecretPlain
                                    : sum.appSecretMasked}
                                </span>
                                {sum.appSecretPlain ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSecretRevealed((prev) => ({ ...prev, [name]: !prev[name] }))
                                    }
                                    className="shrink-0 p-1 rounded-md border border-white/15 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5"
                                    title={
                                      secretRevealed[name]
                                        ? t("oneone.channelsSecretHide")
                                        : t("oneone.channelsSecretShow")
                                    }
                                    aria-label={
                                      secretRevealed[name]
                                        ? t("oneone.channelsSecretHide")
                                        : t("oneone.channelsSecretShow")
                                    }
                                  >
                                    {secretRevealed[name] ? (
                                      <IconEyeOff className="block" />
                                    ) : (
                                      <IconEye className="block" />
                                    )}
                                  </button>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-xs break-all max-w-[200px] align-top">
                              {sum.domain}
                            </td>
                            <td className="py-2.5 px-3 align-top">
                              <span className={sum.enabled ? "text-green-400 text-xs" : "text-[var(--text-muted)] text-xs"}>
                                {sum.enabled ? t("oneone.channelsEnabled") : t("oneone.channelsDisabled")}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
