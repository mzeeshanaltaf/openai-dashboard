import "server-only";

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

import type { Budget, CreditGrant } from "@/lib/types";

let db: Database.Database | null = null;

function getDb() {
  if (db) return db;
  // Runtime-only path (a mounted volume in production); keep it out of build tracing.
  const dir = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || "./data");
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(path.join(dir, "dashboard.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS credit_grants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount_usd REAL NOT NULL,
      granted_at TEXT NOT NULL,
      expires_at TEXT,
      note TEXT
    );
    CREATE TABLE IF NOT EXISTS budgets (
      scope TEXT PRIMARY KEY,
      monthly_usd REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cost_days (
      date TEXT PRIMARY KEY,
      rows TEXT NOT NULL,
      final INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS usage_days (
      date TEXT PRIMARY KEY,
      rows TEXT NOT NULL,
      final INTEGER NOT NULL
    );
  `);
  return db;
}

type GrantRow = {
  id: number;
  amount_usd: number;
  granted_at: string;
  expires_at: string | null;
  note: string | null;
};

export function listGrants(): CreditGrant[] {
  const rows = getDb()
    .prepare("SELECT * FROM credit_grants ORDER BY granted_at DESC, id DESC")
    .all() as GrantRow[];
  return rows.map((r) => ({
    id: r.id,
    amountUsd: r.amount_usd,
    grantedAt: r.granted_at,
    expiresAt: r.expires_at,
    note: r.note,
  }));
}

export function addGrant(grant: Omit<CreditGrant, "id">) {
  getDb()
    .prepare(
      "INSERT INTO credit_grants (amount_usd, granted_at, expires_at, note) VALUES (?, ?, ?, ?)"
    )
    .run(grant.amountUsd, grant.grantedAt, grant.expiresAt, grant.note);
}

export function deleteGrant(id: number) {
  getDb().prepare("DELETE FROM credit_grants WHERE id = ?").run(id);
}

export function listBudgets(): Budget[] {
  const rows = getDb().prepare("SELECT scope, monthly_usd FROM budgets").all() as {
    scope: string;
    monthly_usd: number;
  }[];
  return rows.map((r) => ({ scope: r.scope, monthlyUsd: r.monthly_usd }));
}

// Per-day API results. Rows are JSON arrays; `final` days are never refetched.
export type DayTable = "cost_days" | "usage_days";

export function readDays<T>(table: DayTable, start: string, end: string) {
  const rows = getDb()
    .prepare(`SELECT date, rows, final FROM ${table} WHERE date >= ? AND date <= ?`)
    .all(start, end) as { date: string; rows: string; final: number }[];
  return new Map(rows.map((r) => [r.date, { rows: JSON.parse(r.rows) as T[], final: r.final === 1 }]));
}

export function writeDays<T>(table: DayTable, days: { date: string; rows: T[]; final: boolean }[]) {
  const conn = getDb();
  const upsert = conn.prepare(
    `INSERT INTO ${table} (date, rows, final) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET rows = excluded.rows, final = excluded.final`
  );
  conn.transaction((items: typeof days) => {
    for (const d of items) upsert.run(d.date, JSON.stringify(d.rows), d.final ? 1 : 0);
  })(days);
}

// Replaces all budgets; a budget of 0 or less removes that scope.
export function saveBudgets(budgets: Budget[]) {
  const conn = getDb();
  const replace = conn.transaction((items: Budget[]) => {
    conn.prepare("DELETE FROM budgets").run();
    const insert = conn.prepare("INSERT INTO budgets (scope, monthly_usd) VALUES (?, ?)");
    for (const b of items) if (b.monthlyUsd > 0) insert.run(b.scope, b.monthlyUsd);
  });
  replace(budgets);
}
