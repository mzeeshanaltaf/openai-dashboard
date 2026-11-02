import "server-only";

import { readDays, writeDays, type DayTable } from "@/lib/db";
import { getCosts, getUsage } from "@/lib/openai-admin";
import type { CostRow, UsageRow } from "@/lib/types";

// Past UTC days never change, so they are fetched once and kept in SQLite. Today and yesterday stay
// "live" (refetched through the 5-minute in-memory cache) because OpenAI may still be settling them.
const SETTLE_DAYS = 2;
const DAY_MS = 86400_000;

const toUnix = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

function enumerate(start: string, end: string) {
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

// Contiguous runs, so each API call covers one span instead of one request per day.
function toRuns(days: string[]) {
  const runs: { start: string; end: string }[] = [];
  for (const d of days) {
    const last = runs[runs.length - 1];
    if (last && addDays(last.end, 1) === d) last.end = d;
    else runs.push({ start: d, end: d });
  }
  return runs;
}

async function getHistory<T extends { date: string }>(
  table: DayTable,
  start: string,
  end: string,
  fresh: boolean,
  fetchRange: (startTime: number, endTime: number, fresh: boolean) => Promise<T[]>
): Promise<T[]> {
  const days = enumerate(start, end);
  const stored = readDays<T>(table, start, end);
  const missing = days.filter((d) => !stored.get(d)?.final);

  const finalCutoff = addDays(new Date().toISOString().slice(0, 10), -SETTLE_DAYS);
  for (const run of toRuns(missing)) {
    const fetched = await fetchRange(toUnix(run.start), toUnix(run.end) + 86400, fresh);
    const byDate = new Map<string, T[]>();
    for (const row of fetched) byDate.set(row.date, [...(byDate.get(row.date) ?? []), row]);
    const batch = enumerate(run.start, run.end).map((date) => ({
      date,
      rows: byDate.get(date) ?? [],
      final: date <= finalCutoff,
    }));
    writeDays(table, batch);
    for (const d of batch) stored.set(d.date, d);
  }

  return days.flatMap((d) => stored.get(d)?.rows ?? []);
}

export const getCostHistory = (start: string, end: string, fresh = false): Promise<CostRow[]> =>
  getHistory("cost_days", start, end, fresh, getCosts);

export const getUsageHistory = (start: string, end: string, fresh = false): Promise<UsageRow[]> =>
  getHistory("usage_days", start, end, fresh, getUsage);
