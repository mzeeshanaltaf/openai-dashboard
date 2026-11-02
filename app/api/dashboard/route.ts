import { NextResponse, type NextRequest } from "next/server";

import { listBudgets, listGrants } from "@/lib/db";
import { getApiKeys, getCosts, getCostTotal, getProjects, getUsage } from "@/lib/openai-admin";
import type { Balance, CreditGrant, DashboardData, MonthToDate } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86400;

const toUnix = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
const today = () => new Date().toISOString().slice(0, 10);

async function computeBalance(grants: CreditGrant[], fresh: boolean): Promise<Balance | null> {
  const now = today();
  const active = grants.filter((g) => !g.expiresAt || g.expiresAt >= now);
  if (active.length === 0) return null;

  const since = active.reduce((min, g) => (g.grantedAt < min ? g.grantedAt : min), active[0].grantedAt);
  const totalCredits = active.reduce((sum, g) => sum + g.amountUsd, 0);
  const { total: spent } = await getCostTotal(toUnix(since), toUnix(now) + DAY, fresh);
  return { totalCredits, spent, remaining: totalCredits - spent, since };
}

async function computeMonthToDate(fresh: boolean): Promise<MonthToDate> {
  const now = new Date();
  const start = `${now.toISOString().slice(0, 8)}01`;
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const daysElapsed = now.getUTCDate();
  const { total, byProject } = await getCostTotal(toUnix(start), toUnix(today()) + DAY, fresh);
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

  const startTime = toUnix(start);
  const endTime = toUnix(end) + DAY; // end_time is exclusive

  try {
    const grants = listGrants();
    const projects = await getProjects(fresh);
    const [apiKeys, costs, usage, mtd, balance] = await Promise.all([
      getApiKeys(projects, fresh),
      getCosts(startTime, endTime, fresh),
      getUsage(startTime, endTime, fresh),
      computeMonthToDate(fresh),
      computeBalance(grants, fresh),
    ]);

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
