import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  // Relative Location: behind a reverse proxy request.url is the container's bind address.
  const response = new NextResponse(null, { status: 303, headers: { Location: "/login" } });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
