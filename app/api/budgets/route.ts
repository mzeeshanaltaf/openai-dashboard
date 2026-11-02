import { NextResponse, type NextRequest } from "next/server";

import { listBudgets, saveBudgets } from "@/lib/db";
import type { Budget } from "@/lib/types";

export async function GET() {
  return NextResponse.json(listBudgets());
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body)) return NextResponse.json({ error: "Expected an array" }, { status: 400 });

  const budgets: Budget[] = body
    .map((b) => ({ scope: String(b?.scope ?? ""), monthlyUsd: Number(b?.monthlyUsd) }))
    .filter((b) => b.scope && Number.isFinite(b.monthlyUsd));
  saveBudgets(budgets);
  return NextResponse.json(listBudgets());
}
