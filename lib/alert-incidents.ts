export type AlertSeverity = "critical" | "warning" | "info";
export type AlertIncidentStatus = "active" | "acknowledged" | "snoozed" | "recovered";

export interface AlertSignal {
  incidentKey: string;
  message: string;
  agentId?: string;
  severity?: AlertSeverity;
}

export interface AlertIncident {
  id: string;
  incidentKey: string;
  message: string;
  agentId?: string;
  severity: AlertSeverity;
  status: AlertIncidentStatus;
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
  lastStatusChangeAt: number;
  snoozeUntil?: number;
}

export interface AlertIncidentAction {
  id: string;
  action: "ack" | "snooze" | "unsnooze" | "resolve" | "reopen";
  minutes?: number;
}

function generateIncidentId(now: number): string {
  return `inc_${now}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeExisting(existing: AlertIncident[]): AlertIncident[] {
  return (Array.isArray(existing) ? existing : [])
    .filter((x) => x && typeof x === "object" && typeof x.id === "string")
    .map((x) => ({
      ...x,
      severity: x.severity || "warning",
      status: x.status || "active",
      count: Number.isFinite(x.count) ? x.count : 1,
      firstSeenAt: Number.isFinite(x.firstSeenAt) ? x.firstSeenAt : Date.now(),
      lastSeenAt: Number.isFinite(x.lastSeenAt) ? x.lastSeenAt : Date.now(),
      lastStatusChangeAt: Number.isFinite(x.lastStatusChangeAt) ? x.lastStatusChangeAt : Date.now(),
    }));
}

export function reconcileIncidents(
  existing: AlertIncident[],
  signals: AlertSignal[],
  now = Date.now(),
): AlertIncident[] {
  const cur = normalizeExisting(existing);
  const byKey = new Map<string, AlertSignal>();
  for (const s of signals) {
    if (!s.incidentKey || typeof s.incidentKey !== "string") continue;
    if (!byKey.has(s.incidentKey)) byKey.set(s.incidentKey, s);
  }

  const next: AlertIncident[] = [];
  const used = new Set<string>();

  for (const incident of cur) {
    const s = byKey.get(incident.incidentKey);
    if (s) {
      used.add(incident.incidentKey);
      const isSnoozed = incident.status === "snoozed" && typeof incident.snoozeUntil === "number" && incident.snoozeUntil > now;
      const status: AlertIncidentStatus =
        incident.status === "recovered"
          ? "active"
          : isSnoozed
            ? "snoozed"
            : incident.status === "acknowledged"
              ? "acknowledged"
              : "active";
      next.push({
        ...incident,
        message: s.message || incident.message,
        agentId: s.agentId || incident.agentId,
        severity: s.severity || incident.severity || "warning",
        status,
        count: incident.count + 1,
        lastSeenAt: now,
        lastStatusChangeAt: status !== incident.status ? now : incident.lastStatusChangeAt,
      });
      continue;
    }

    // 本轮未触发：若之前是活跃态，置为 recovered
    if (incident.status !== "recovered") {
      next.push({
        ...incident,
        status: "recovered",
        lastStatusChangeAt: now,
      });
    } else {
      next.push(incident);
    }
  }

  for (const [k, s] of byKey.entries()) {
    if (used.has(k)) continue;
    next.push({
      id: generateIncidentId(now),
      incidentKey: k,
      message: s.message,
      agentId: s.agentId,
      severity: s.severity || "warning",
      status: "active",
      count: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      lastStatusChangeAt: now,
    });
  }

  return next.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export function applyIncidentActions(
  incidents: AlertIncident[],
  actions: AlertIncidentAction[],
  now = Date.now(),
): AlertIncident[] {
  if (!Array.isArray(actions) || actions.length === 0) return incidents;
  const byId = new Map<string, AlertIncident>();
  for (const item of incidents) byId.set(item.id, { ...item });

  for (const action of actions) {
    const cur = byId.get(action.id);
    if (!cur) continue;
    switch (action.action) {
      case "ack":
        cur.status = "acknowledged";
        cur.lastStatusChangeAt = now;
        break;
      case "snooze": {
        const mins = Number.isFinite(action.minutes) ? Math.max(1, Number(action.minutes)) : 30;
        cur.status = "snoozed";
        cur.snoozeUntil = now + mins * 60_000;
        cur.lastStatusChangeAt = now;
        break;
      }
      case "unsnooze":
      case "reopen":
        cur.status = "active";
        cur.snoozeUntil = undefined;
        cur.lastStatusChangeAt = now;
        break;
      case "resolve":
        cur.status = "recovered";
        cur.snoozeUntil = undefined;
        cur.lastStatusChangeAt = now;
        break;
      default:
        break;
    }
    byId.set(cur.id, cur);
  }

  return Array.from(byId.values()).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export function summarizeIncidents(incidents: AlertIncident[]) {
  const summary = {
    active: 0,
    acknowledged: 0,
    snoozed: 0,
    recovered: 0,
    critical: 0,
    warning: 0,
    info: 0,
  };
  for (const i of incidents) {
    if (i.status === "active") summary.active += 1;
    else if (i.status === "acknowledged") summary.acknowledged += 1;
    else if (i.status === "snoozed") summary.snoozed += 1;
    else if (i.status === "recovered") summary.recovered += 1;
    if (i.severity === "critical") summary.critical += 1;
    else if (i.severity === "warning") summary.warning += 1;
    else summary.info += 1;
  }
  return summary;
}
