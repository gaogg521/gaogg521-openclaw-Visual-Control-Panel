"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type ChannelItem = { id: string; name: string; enabled: boolean; raw?: Record<string, unknown> };

const CARD_CLASS =
  "rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a1a23]/95 to-[#121218]/98 p-6";

export default function ChannelsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [channelKey, setChannelKey] = useState<"channels" | "ro_channels">("channels");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, configRes] = await Promise.all([
        fetch("/api/openclaw/channels", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/openclaw/config", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (listRes.items) setItems(listRes.items);
      else setItems([]);
      const cfg = configRes || {};
      setChannelKey(
        cfg.ro_channels !== undefined && cfg.ro_channels !== null ? "ro_channels" : "channels"
      );
    } catch (e: any) {
      setError(e?.message ?? t("oneone.channelsFetchFailed"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateRow = (id: string, patch: Partial<ChannelItem>) => {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id));
  };

  const addRow = () => {
    setItems((prev) => [...prev, { id: `channel_${Date.now()}`, name: t("oneone.channelNew"), enabled: true }]);
  };

  const doSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const asDict: Record<string, { name: string; enabled: boolean; [k: string]: unknown }> = {};
      items.forEach((r) => {
        asDict[r.id] = { name: r.name, enabled: r.enabled, ...(r.raw ?? {}) };
      });
      const res = await fetch("/api/openclaw/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [channelKey]: asDict }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      alert(t("oneone.channelsSaveSuccess"));
      load();
    } catch (e: any) {
      setError(e?.message ?? t("oneone.channelsSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (window.confirm(t("oneone.channelsSaveConfirm"))) doSave();
  };

  return (
    <div className="p-4 md:p-6 text-[var(--text)]">
      <h1 className="text-xl font-semibold text-[var(--text)] mb-6">
        {t("oneone.channelsTitle")}
      </h1>

      <div className={CARD_CLASS}>
        <p className="text-[var(--text-muted)] text-sm mb-4">
          {t("oneone.channelsHint")}
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={addRow}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium"
          >
            {t("oneone.channelsAdd")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? t("common.loading") : t("oneone.channelsSaveToConfig")}
          </button>
        </div>
        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}
        <div className="overflow-x-auto">
          {loading ? (
            <p className="text-[var(--text-muted)] py-8">{t("common.loading")}</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-2 text-[var(--text-muted)] font-medium">ID</th>
                  <th className="text-left py-2 px-2 text-[var(--text-muted)] font-medium">
                    {t("oneone.channelsName")}
                  </th>
                  <th className="text-left py-2 px-2 text-[var(--text-muted)] font-medium">
                    {t("oneone.channelsStatus")}
                  </th>
                  <th className="text-left py-2 px-2 text-[var(--text-muted)] font-medium">
                    {t("oneone.channelsActions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={r.id}
                        onChange={(e) =>
                          updateRow(r.id, { id: e.target.value.trim() || r.id })
                        }
                        className="w-36 max-w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={r.name}
                        onChange={(e) => updateRow(r.id, { name: e.target.value })}
                        className="w-36 max-w-full px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={r.enabled}
                          onChange={(e) => updateRow(r.id, { enabled: e.target.checked })}
                          className="rounded border-[var(--border)]"
                        />
                        <span
                          className={
                            r.enabled
                              ? "text-green-500"
                              : "text-[var(--text-muted)]"
                          }
                        >
                          {r.enabled ? t("oneone.channelsEnabled") : t("oneone.channelsDisabled")}
                        </span>
                      </label>
                    </td>
                    <td className="py-2 px-2">
                      <button
                        type="button"
                        onClick={() => removeRow(r.id)}
                        className="text-red-400 hover:underline text-sm"
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
      </div>
    </div>
  );
}
