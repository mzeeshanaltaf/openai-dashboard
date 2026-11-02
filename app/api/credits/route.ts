import { NextResponse, type NextRequest } from "next/server";

import { addGrant, deleteGrant, listGrants } from "@/lib/db";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  return NextResponse.json(listGrants());
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const amountUsd = Number(body?.amountUsd);
  const grantedAt = String(body?.grantedAt ?? "");
  const expiresAt = body?.expiresAt ? String(body.expiresAt) : null;
  const note = body?.note ? String(body.note).slice(0, 200) : null;

  if (!(amountUsd > 0) || !DATE_RE.test(grantedAt) || (expiresAt && !DATE_RE.test(expiresAt))) {
    return NextResponse.json({ error: "Invalid credit grant" }, { status: 400 });
  }
  addGrant({ amountUsd, grantedAt, expiresAt, note });
  return NextResponse.json(listGrants(), { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  deleteGrant(id);
  return NextResponse.json(listGrants());
}
