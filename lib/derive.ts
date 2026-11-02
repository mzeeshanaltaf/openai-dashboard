// Pure client-side aggregation of the /api/dashboard payload.

import type { ApiKey, Budget, CostRow, DashboardData, UsageCategory, UsageRow } from "@/lib/types";

export const SERIES_SLOTS = 7;
export const OTHER_KEY = "other";
export const OTHER_COLOR = "var(--series-other)";

const TOKEN_CATEGORIES: UsageCategory[] = ["completions", "embeddings"];

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

function groupSum<T>(rows: T[], key: (row: T) => string, value: (row: T) => number) {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(key(row), (totals.get(key(row)) ?? 0) + value(row));
  return totals;
}

export function enumerateDays(start: string, end: string): string[] {
  const days: string[] = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86400_000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

// Colors follow the entity: the top entities by cost over the whole (unfiltered)
// range get fixed slots; everything else folds into "Other".
export function buildColorMap(rankedIds: string[]): Map<string, string> {
  const map = new Map<string, string>();
  rankedIds.forEach((id, i) => map.set(id, i < SERIES_SLOTS ? `var(--series-${i + 1})` : OTHER_COLOR));
  return map;
}

export function rankIds(rows: CostRow[], key: (row: CostRow) => string) {
  return [...groupSum(rows, key, (r) => r.amount).entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

export function filterByProjects<T extends { projectId: string | null }>(rows: T[], selected: string[]) {
  if (selected.length === 0) return rows;
  const set = new Set(selected);
  return rows.filter((r) => r.projectId && set.has(r.projectId));
}

export type Totals = {
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  requests: number;
};

export function computeTotals(costs: CostRow[], usage: UsageRow[]): Totals {
  const tokenRows = usage.filter((u) => TOKEN_CATEGORIES.includes(u.category));
  return {
    cost: sum(costs.map((c) => c.amount)),
    inputTokens: sum(tokenRows.map((u) => u.inputTokens)),
    outputTokens: sum(tokenRows.map((u) => u.outputTokens)),
    cachedTokens: sum(tokenRows.map((u) => u.cachedTokens)),
    requests: sum(usage.map((u) => u.requests)),
  };
}

// --- Stacked daily series --------------------------------------------------

export type SeriesDef = { key: string; label: string; color: string };

export function buildDailySeries(
  costs: CostRow[],
  days: string[],
  entityOf: (row: CostRow) => string,
  labelOf: (id: string) => string,
  colors: Map<string, string>,
  rankedIds: string[]
) {
  const slotted = rankedIds.filter((id) => colors.get(id) !== OTHER_COLOR);
  const present = new Set(costs.filter((c) => c.amount > 0).map(entityOf));
  const series: SeriesDef[] = slotted
    .filter((id) => present.has(id))
    .map((id, i) => ({ key: `s${i}`, label: labelOf(id), color: colors.get(id)! }));
  const keyOf = new Map(slotted.filter((id) => present.has(id)).map((id, i) => [id, `s${i}`]));

  const rows = new Map(days.map((d) => [d, { date: d } as Record<string, number | string>]));
  let hasOther = false;
  for (const c of costs) {
    const row = rows.get(c.date);
    if (!row || c.amount === 0) continue;
    const key = keyOf.get(entityOf(c)) ?? OTHER_KEY;
    if (key === OTHER_KEY) hasOther = true;
    row[key] = ((row[key] as number) ?? 0) + c.amount;
  }
  if (hasOther) series.push({ key: OTHER_KEY, label: "Other", color: OTHER_COLOR });
  return { series, data: [...rows.values()] };
}

// --- Projects --------------------------------------------------------------

export type Breakdown = { id: string; label: string; cost: number };

export type ProjectRow = {
  id: string;
  name: string;
  archived: boolean;
  color: string;
  cost: number;
  share: number;
  inputTokens: number;
  outputTokens: number;
  requests: number;
  daily: number[];
  mtdCost: number;
  budget: number | null;
  models: Breakdown[];
  keys: Breakdown[];
};

export function deriveProjects(
  data: DashboardData,
  costs: CostRow[],
  usage: UsageRow[],
  days: string[],
  selected: string[],
  colors: Map<string, string>,
  keyName: (id: string | null) => string
): ProjectRow[] {
  const total = sum(costs.map((c) => c.amount));
  const budgets = new Map(data.budgets.map((b) => [b.scope, b.monthlyUsd]));
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const projects = selected.length ? data.projects.filter((p) => selected.includes(p.id)) : data.projects;

  const rows = projects.map<ProjectRow>((p) => {
    const pc = costs.filter((c) => c.projectId === p.id);
    const pu = usage.filter((u) => u.projectId === p.id);
    const tokenRows = pu.filter((u) => TOKEN_CATEGORIES.includes(u.category));
    const daily = days.map(() => 0);
    for (const c of pc) {
      const i = dayIndex.get(c.date);
      if (i !== undefined) daily[i] += c.amount;
    }
    const cost = sum(pc.map((c) => c.amount));
    const toBreakdown = (m: Map<string, number>, label: (id: string) => string) =>
      [...m.entries()]
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([id, v]) => ({ id, label: label(id), cost: v }));

    return {
      id: p.id,
      name: p.name,
      archived: p.status === "archived",
      color: colors.get(p.id) ?? OTHER_COLOR,
      cost,
      share: total ? cost / total : 0,
      inputTokens: sum(tokenRows.map((u) => u.inputTokens)),
      outputTokens: sum(tokenRows.map((u) => u.outputTokens)),
      requests: sum(pu.map((u) => u.requests)),
      daily,
      mtdCost: data.mtd.byProject[p.id] ?? 0,
      budget: budgets.get(p.id) ?? null,
      models: toBreakdown(groupSum(pc, (c) => c.model, (c) => c.amount), (id) => id),
      keys: toBreakdown(groupSum(pc, (c) => c.apiKeyId ?? "", (c) => c.amount), (id) => keyName(id || null)),
    };
  });

  return rows.sort((a, b) => b.cost - a.cost || b.requests - a.requests || a.name.localeCompare(b.name));
}

// --- Models ----------------------------------------------------------------

export type ModelRow = {
  model: string;
  color: string;
  cost: number;
  share: number;
  tiers: Record<string, number>;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  requests: number;
};

export function deriveModels(costs: CostRow[], usage: UsageRow[], colors: Map<string, string>): ModelRow[] {
  const total = sum(costs.map((c) => c.amount));
  const rows = new Map<string, ModelRow>();
  const get = (model: string) => {
    let row = rows.get(model);
    if (!row) {
      row = {
        model,
        color: colors.get(model) ?? OTHER_COLOR,
        cost: 0,
        share: 0,
        tiers: {},
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        requests: 0,
      };
      rows.set(model, row);
    }
    return row;
  };

  for (const c of costs) {
    const row = get(c.model);
    row.cost += c.amount;
    row.tiers[c.tier] = (row.tiers[c.tier] ?? 0) + c.amount;
  }
  for (const u of usage) {
    if (!u.model || !TOKEN_CATEGORIES.includes(u.category)) continue;
    const row = get(u.model);
    row.inputTokens += u.inputTokens;
    row.outputTokens += u.outputTokens;
    row.cachedTokens += u.cachedTokens;
    row.requests += u.requests;
  }
  for (const row of rows.values()) row.share = total ? row.cost / total : 0;

  return [...rows.values()]
    .filter((r) => r.cost > 0 || r.requests > 0)
    .sort((a, b) => b.cost - a.cost || b.requests - a.requests);
}

// --- API keys --------------------------------------------------------------

export type KeyRow = {
  id: string;
  name: string;
  projectId: string | null;
  projectName: string;
  suffix: string;
  cost: number;
  tokens: number;
  requests: number;
  lastUsedAt: number | null;
  deleted: boolean;
};

export function deriveKeys(
  data: DashboardData,
  costs: CostRow[],
  usage: UsageRow[],
  selected: string[],
  projectName: (id: string | null) => string
): KeyRow[] {
  const keys = new Map<string, ApiKey>(data.apiKeys.map((k) => [k.id, k]));
  const costByKey = groupSum(costs, (c) => c.apiKeyId ?? "", (c) => c.amount);
  const tokenRows = usage.filter((u) => TOKEN_CATEGORIES.includes(u.category));
  const tokensByKey = groupSum(tokenRows, (u) => u.apiKeyId ?? "", (u) => u.inputTokens + u.outputTokens);
  const requestsByKey = groupSum(usage, (u) => u.apiKeyId ?? "", (u) => u.requests);
  const projectOfKey = new Map<string, string | null>();
  for (const c of costs) if (c.apiKeyId) projectOfKey.set(c.apiKeyId, c.projectId);

  const visibleKeys = data.apiKeys.filter((k) => selected.length === 0 || selected.includes(k.projectId));
  const ids = new Set([...visibleKeys.map((k) => k.id), ...costByKey.keys(), ...requestsByKey.keys()]);
  ids.delete("");

  const rows = [...ids].map<KeyRow>((id) => {
    const key = keys.get(id);
    const projectId = key?.projectId ?? projectOfKey.get(id) ?? null;
    return {
      id,
      name: key?.name || (key ? "Unnamed key" : "Deleted key"),
      projectId,
      projectName: projectName(projectId),
      suffix: key ? key.redacted.slice(-4) : id.slice(-4),
      cost: costByKey.get(id) ?? 0,
      tokens: tokensByKey.get(id) ?? 0,
      requests: requestsByKey.get(id) ?? 0,
      lastUsedAt: key?.lastUsedAt ?? null,
      deleted: !key,
    };
  });

  const unattributed = costByKey.get("") ?? 0;
  if (unattributed > 0) {
    rows.push({
      id: "",
      name: "No API key (e.g. playground, storage)",
      projectId: null,
      projectName: "—",
      suffix: "",
      cost: unattributed,
      tokens: tokensByKey.get("") ?? 0,
      requests: requestsByKey.get("") ?? 0,
      lastUsedAt: null,
      deleted: false,
    });
  }

  return rows.sort((a, b) => b.cost - a.cost || b.requests - a.requests || (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));
}

// --- Other usage categories -----------------------------------------------

export type OtherUsage = { category: UsageCategory; requests: number; units: number };

export function deriveOtherUsage(usage: UsageRow[]): OtherUsage[] {
  const categories: UsageCategory[] = [
    "images",
    "audio_speeches",
    "audio_transcriptions",
    "moderations",
    "vector_stores",
    "code_interpreter_sessions",
  ];
  return categories
    .map((category) => {
      const rows = usage.filter((u) => u.category === category);
      // Vector store usage is a daily storage snapshot: report the latest day, not a sum.
      let units = sum(rows.map((r) => r.units));
      if (category === "vector_stores" && rows.length) {
        const latest = rows.reduce((max, r) => (r.date > max ? r.date : max), rows[0].date);
        units = sum(rows.filter((r) => r.date === latest).map((r) => r.units));
      }
      return { category, requests: sum(rows.map((r) => r.requests)), units };
    })
    .filter((u) => u.requests > 0 || u.units > 0);
}

export function budgetFor(budgets: Budget[], scope: string) {
  return budgets.find((b) => b.scope === scope)?.monthlyUsd ?? null;
}

export type BudgetState = "ok" | "warning" | "over";

export function budgetState(spent: number, budget: number): BudgetState {
  const ratio = spent / budget;
  return ratio >= 1 ? "over" : ratio >= 0.8 ? "warning" : "ok";
}
