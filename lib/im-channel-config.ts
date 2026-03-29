/** OpenClaw IM channels: feishu / wework / dingtalk — same shape in UI, maps to JSON 1:1 */

export const IM_CHANNEL_IDS = ["feishu", "wework", "dingtalk"] as const;
export type ImChannelId = (typeof IM_CHANNEL_IDS)[number];

export const IM_CHANNEL_SET = new Set<string>(IM_CHANNEL_IDS);

export type GroupRuleRow = { groupId: string; requireMention: boolean };
export type AccountRow = { accountId: string; appId: string; appSecret: string; groups: GroupRuleRow[] };

export type ImChannelDraft = {
  enabled: boolean;
  allowFromText: string;
  requireMention: boolean;
  streaming: boolean;
  threadSession: boolean;
  domain: string;
  legacyAppId: string;
  legacyAppSecret: string;
  accounts: AccountRow[];
};

export type BindingRow = {
  localId: string;
  agentId: string;
  channel: string;
  accountId: string;
  peerKind: string;
  peerId: string;
};

const KNOWN_ROOT = new Set([
  "enabled",
  "allowFrom",
  "requireMention",
  "streaming",
  "threadSession",
  "domain",
  "appId",
  "appSecret",
  "accounts",
]);

export function emptyDraft(): ImChannelDraft {
  return {
    enabled: true,
    allowFromText: "",
    requireMention: false,
    streaming: false,
    threadSession: false,
    domain: "",
    legacyAppId: "",
    legacyAppSecret: "",
    accounts: [],
  };
}

export function draftFromChannelRaw(raw: unknown): ImChannelDraft {
  if (!raw || typeof raw !== "object") return emptyDraft();
  const r = raw as Record<string, unknown>;
  const allowFrom = r.allowFrom;
  const allowStr = Array.isArray(allowFrom)
    ? allowFrom.filter((x): x is string => typeof x === "string").join("\n")
    : "";
  const accountsObj = r.accounts && typeof r.accounts === "object" && !Array.isArray(r.accounts) ? r.accounts : {};
  const accountRows: AccountRow[] = Object.entries(accountsObj as Record<string, unknown>).map(([accountId, acc]) => {
    const a = acc && typeof acc === "object" ? (acc as Record<string, unknown>) : {};
    const g = a.groups && typeof a.groups === "object" && !Array.isArray(a.groups) ? a.groups : {};
    const groups: GroupRuleRow[] = Object.entries(g as Record<string, unknown>).map(([groupId, gv]) => {
      const gvObj = gv && typeof gv === "object" ? (gv as Record<string, unknown>) : {};
      return { groupId, requireMention: gvObj.requireMention === true };
    });
    return {
      accountId,
      appId: typeof a.appId === "string" ? a.appId : "",
      appSecret: typeof a.appSecret === "string" ? a.appSecret : "",
      groups,
    };
  });
  return {
    enabled: r.enabled !== false,
    allowFromText: allowStr,
    requireMention: r.requireMention === true,
    streaming: r.streaming === true,
    threadSession: r.threadSession === true,
    domain: typeof r.domain === "string" ? r.domain : "",
    legacyAppId: typeof r.appId === "string" ? r.appId : "",
    legacyAppSecret: typeof r.appSecret === "string" ? r.appSecret : "",
    accounts: accountRows,
  };
}

function allowFromLines(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function serializeAccountGroups(groups: GroupRuleRow[], prevGroups: unknown): Record<string, unknown> | undefined {
  const prev =
    prevGroups && typeof prevGroups === "object" && !Array.isArray(prevGroups)
      ? (prevGroups as Record<string, unknown>)
      : {};
  const out: Record<string, unknown> = {};
  for (const g of groups) {
    const gid = g.groupId.trim();
    if (!gid) continue;
    const base = prev[gid] && typeof prev[gid] === "object" ? { ...(prev[gid] as object) } : {};
    const next: Record<string, unknown> = { ...base };
    if (g.requireMention) next.requireMention = true;
    else delete next.requireMention;
    if (Object.keys(next).length === 0) continue;
    out[gid] = next;
  }
  return Object.keys(out).length ? out : undefined;
}

function serializeAccounts(rows: AccountRow[], prevAccounts: unknown): Record<string, unknown> | undefined {
  const prev =
    prevAccounts && typeof prevAccounts === "object" && !Array.isArray(prevAccounts)
      ? (prevAccounts as Record<string, unknown>)
      : {};
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const id = row.accountId.trim();
    if (!id) continue;
    const base =
      prev[id] && typeof prev[id] === "object" ? { ...(prev[id] as Record<string, unknown>) } : {};
    for (const k of ["appId", "appSecret", "groups"]) delete base[k];
    if (row.appId.trim()) base.appId = row.appId.trim();
    else delete base.appId;
    if (row.appSecret.trim()) base.appSecret = row.appSecret.trim();
    else delete base.appSecret;
    const groups = serializeAccountGroups(row.groups, prev[id] && typeof prev[id] === "object" ? (prev[id] as any).groups : {});
    if (groups) base.groups = groups;
    else delete base.groups;
    out[id] = base;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Merge draft into previous channel object; preserves unknown top-level / per-account keys */
export function serializeImChannel(draft: ImChannelDraft, previous: unknown): Record<string, unknown> {
  const prev = previous && typeof previous === "object" ? { ...(previous as Record<string, unknown>) } : {};
  const extras: Record<string, unknown> = { ...prev };
  for (const k of KNOWN_ROOT) delete extras[k];

  const lines = allowFromLines(draft.allowFromText);
  const accounts = serializeAccounts(draft.accounts, prev.accounts);

  const next: Record<string, unknown> = { ...extras };
  next.enabled = draft.enabled;
  if (lines.length) next.allowFrom = lines;
  else delete next.allowFrom;

  if (draft.requireMention) next.requireMention = true;
  else delete next.requireMention;
  if (draft.streaming) next.streaming = true;
  else delete next.streaming;
  if (draft.threadSession) next.threadSession = true;
  else delete next.threadSession;

  const dom = draft.domain.trim();
  if (dom) next.domain = dom;
  else delete next.domain;

  if (accounts) next.accounts = accounts;
  else delete next.accounts;

  const hasAccounts = draft.accounts.some((a) => a.accountId.trim());
  if (!hasAccounts) {
    if (draft.legacyAppId.trim()) next.appId = draft.legacyAppId.trim();
    else delete next.appId;
    if (draft.legacyAppSecret.trim()) next.appSecret = draft.legacyAppSecret.trim();
    else delete next.appSecret;
  } else {
    delete next.appId;
    delete next.appSecret;
  }

  return next;
}

export function bindingFromRaw(b: unknown, localId: string): BindingRow {
  const o = b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  const match = o.match && typeof o.match === "object" ? (o.match as Record<string, unknown>) : {};
  const peer = match.peer && typeof match.peer === "object" ? (match.peer as Record<string, unknown>) : {};
  return {
    localId,
    agentId: typeof o.agentId === "string" ? o.agentId : "",
    channel: typeof match.channel === "string" ? match.channel : "",
    accountId: typeof match.accountId === "string" ? match.accountId : "",
    peerKind: typeof peer.kind === "string" ? peer.kind : "group",
    peerId: typeof peer.id === "string" ? peer.id : "",
  };
}

export function bindingToRaw(row: BindingRow): Record<string, unknown> {
  const match: Record<string, unknown> = { channel: row.channel.trim() };
  if (row.accountId.trim()) match.accountId = row.accountId.trim();
  const pid = row.peerId.trim();
  if (pid) match.peer = { kind: row.peerKind.trim() || "group", id: pid };
  return { agentId: row.agentId.trim(), match };
}

export function validateDraft(draft: ImChannelDraft): string[] {
  const err: string[] = [];
  if (!draft.enabled) return err;
  const hasAccounts = draft.accounts.some((a) => a.accountId.trim());
  if (hasAccounts) {
    for (const a of draft.accounts) {
      const id = a.accountId.trim();
      if (!id) continue;
      if (!a.appId.trim() || !a.appSecret.trim()) {
        err.push(`accountSecret:${id}`);
      }
    }
  } else {
    if (!draft.legacyAppId.trim() || !draft.legacyAppSecret.trim()) {
      err.push("legacyCredsRequired");
    }
  }
  return err;
}

export function validateBindingRow(row: BindingRow): string[] {
  const err: string[] = [];
  if (!row.agentId.trim()) err.push("bindingAgent");
  if (!row.channel.trim()) err.push("bindingChannel");
  const pid = row.peerId.trim();
  if (pid && !row.peerKind.trim()) err.push("bindingPeerKind");
  return err;
}

export function filterImBindings(bindings: unknown): unknown[] {
  if (!Array.isArray(bindings)) return [];
  return bindings.filter((b) => {
    const o = b && typeof b === "object" ? (b as Record<string, unknown>) : {};
    const m = o.match && typeof o.match === "object" ? (o.match as Record<string, unknown>) : {};
    const ch = m.channel;
    return typeof ch === "string" && IM_CHANNEL_SET.has(ch);
  });
}

export function mergeBindingsPreserveOthers(
  allBindings: unknown[],
  imRows: BindingRow[],
): unknown[] {
  const im = imRows.map(bindingToRaw);
  const rest = (allBindings || []).filter((b) => {
    const o = b && typeof b === "object" ? (b as Record<string, unknown>) : {};
    const m = o.match && typeof o.match === "object" ? (o.match as Record<string, unknown>) : {};
    const ch = m.channel;
    return typeof ch !== "string" || !IM_CHANNEL_SET.has(ch);
  });
  return [...rest, ...im];
}

/** 与旧版通道页一致：存在 `ro_channels` 时向其写入 */
export function pickChannelsKey(cfg: Record<string, unknown>): "channels" | "ro_channels" {
  if (cfg.ro_channels !== undefined && cfg.ro_channels !== null) return "ro_channels";
  return "channels";
}

function readChannelsObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return { ...(value as Record<string, unknown>) };
  return {};
}

/**
 * 读取用于编辑的 channels 合并视图：`channels` 与 `ro_channels` 合并（同名键以后者为准）。
 * 若仅一侧非空则返回该侧；避免只认 ro 时丢掉仅在 channels 里的 discord 等。
 */
export function getChannelsContainer(cfg: Record<string, unknown>): Record<string, unknown> {
  const ch = readChannelsObject(cfg.channels);
  const ro = readChannelsObject(cfg.ro_channels);
  if (cfg.ro_channels !== undefined && cfg.ro_channels !== null) {
    if (Object.keys(ro).length > 0 && Object.keys(ch).length > 0) return { ...ch, ...ro };
    if (Object.keys(ro).length > 0) return ro;
    if (Object.keys(ch).length > 0) return ch;
    return ro;
  }
  return ch;
}

/** 合并 `channels` 与 `ro_channels`（后者覆盖同名键），用于展示已有通道列表 */
export function mergeChannelsObjectsForListing(cfg: Record<string, unknown>): Record<string, unknown> {
  const ch = readChannelsObject(cfg.channels);
  const ro = readChannelsObject(cfg.ro_channels);
  return { ...ch, ...ro };
}

/** 配置里已有的通道键（对象形态），排序后用于展示 */
export function listConfiguredChannelKeys(container: Record<string, unknown>): string[] {
  return Object.keys(container)
    .filter((k) => {
      const v = container[k];
      if (v === undefined || v === null) return false;
      return typeof v === "object" && !Array.isArray(v);
    })
    .sort((a, b) => a.localeCompare(b));
}

function maskSecretForList(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return "•".repeat(Math.min(12, Math.max(6, Math.floor(t.length / 2))));
}

/**
 * 底部「已有通道」简表：启用状态、appId、脱敏 appSecret、domain（飞书等为 domain，其它通道尝试同名字段）
 */
export function getExistingChannelSummary(channelKey: string, raw: unknown): {
  enabled: boolean;
  appId: string;
  appSecretMasked: string;
  /** 明文，仅用于本地点击「显示」后展示（数据已在浏览器内存中） */
  appSecretPlain: string;
  domain: string;
} {
  const dash = "—";
  if (!raw || typeof raw !== "object") {
    return { enabled: true, appId: dash, appSecretMasked: dash, appSecretPlain: "", domain: dash };
  }
  const r = raw as Record<string, unknown>;
  const enabled = r.enabled !== false;
  let appId = "";
  let secret = "";
  let domain = typeof r.domain === "string" ? r.domain.trim() : "";

  if (IM_CHANNEL_SET.has(channelKey)) {
    const d = draftFromChannelRaw(raw);
    if (d.domain.trim()) domain = d.domain.trim();
    if (d.accounts.length > 0) {
      const first = d.accounts.find((a) => a.appId.trim() || a.appSecret.trim()) ?? d.accounts[0];
      appId = first.appId.trim();
      secret = first.appSecret.trim();
    } else {
      appId = d.legacyAppId.trim();
      secret = d.legacyAppSecret.trim();
    }
  } else {
    const pick = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    appId = pick(r.appId) || pick(r.clientId) || pick(r.corpId) || pick(r.appKey);
    secret = pick(r.appSecret) || pick(r.clientSecret) || pick(r.secret);
    if (!domain) domain = pick(r.baseUrl) || pick(r.apiHost) || pick(r.endpoint);
  }

  const masked = secret ? maskSecretForList(secret) : dash;
  return {
    enabled,
    appId: appId || dash,
    appSecretMasked: masked,
    appSecretPlain: secret,
    domain: domain || dash,
  };
}

export function imChannelObjectHasData(raw: unknown): boolean {
  return raw !== undefined && raw !== null && typeof raw === "object" && Object.keys(raw as object).length > 0;
}
