import { NextResponse, type NextRequest } from "next/server";

import { listBudgets, listGrants } from "@/lib/db";
import { getCostHistory, getUsageHistory } from "@/lib/history";
import { getApiKeys, getProjects } from "@/lib/openai-admin";
import type { Balance, CostRow, CreditGrant, DashboardData, MonthToDate } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const today = () => new Date().toISOString().slice(0, 10);
const sumSince = (costs: CostRow[], since: string) =>
  costs.filter((c) => c.date >= since).reduce((sum, c) => sum + c.amount, 0);

function computeBalance(grants: CreditGrant[], costs: CostRow[]): Balance | null {
  const active = grants.filter((g) => !g.expiresAt || g.expiresAt >= today());
  if (active.length === 0) return null;

  const since = balanceSince(grants);
  const totalCredits = active.reduce((sum, g) => sum + g.amountUsd, 0);
  const spent = sumSince(costs, since);
  return { totalCredits, spent, remaining: totalCredits - spent, since };
}

// Earliest active top-up, or today when there is none (so no extra history is loaded).
function balanceSince(grants: CreditGrant[]) {
  const now = today();
  const active = grants.filter((g) => !g.expiresAt || g.expiresAt >= now);
  return active.reduce((min, g) => (g.grantedAt < min ? g.grantedAt : min), active[0]?.grantedAt ?? now);
}

function computeMonthToDate(costs: CostRow[]): MonthToDate {
  const now = new Date();
  const start = `${now.toISOString().slice(0, 8)}01`;
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const daysElapsed = now.getUTCDate();
  const mtdRows = costs.filter((c) => c.date >= start);
  const total = mtdRows.reduce((sum, c) => sum + c.amount, 0);
  const byProject: Record<string, number> = {};
  for (const c of mtdRows) {
    const id = c.projectId ?? "unknown";
    byProject[id] = (byProject[id] ?? 0) + c.amount;
  }
  return {
    start,
    cost: total,
    byProject,
    daysElapsed,
    daysInMonth,
    forecast: (total / daysElapsed) * daysInMonth,
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const start = params.get("start") ?? "";
  const end = params.get("end") ?? "";
  const fresh = params.get("refresh") === "1";

  if (!DATE_RE.test(start) || !DATE_RE.test(end) || start > end) {
    return NextResponse.json({ error: "start and end must be YYYY-MM-DD with start <= end" }, { status: 400 });
  }

  try {
    const grants = listGrants();
    const projects = await getProjects(fresh);

    // One history load covers the requested range, month-to-date and the balance window.
    const now = today();
    const monthStart = `${now.slice(0, 8)}01`;
    const historyStart = [start, monthStart, balanceSince(grants)].sort()[0];
    const historyEnd = end > now ? end : now;

    const [apiKeys, history, usage] = await Promise.all([
      getApiKeys(projects, fresh),
      getCostHistory(historyStart, historyEnd, fresh),
      getUsageHistory(start, end, fresh),
    ]);
    const costs = history.filter((c) => c.date >= start && c.date <= end);
    const mtd = computeMonthToDate(history);
    const balance = computeBalance(grants, history);

    const data: DashboardData = {
      generatedAt: Date.now(),
      range: { start, end },
      projects,
      apiKeys,
      costs,
      usage,
      mtd,
      balance,
      grants,
      budgets: listBudgets(),
    };
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Failed to load data";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
