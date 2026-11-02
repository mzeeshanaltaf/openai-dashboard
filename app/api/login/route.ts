import { NextResponse, type NextRequest } from "next/server";

import { createSessionToken, safeEqual, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

// Simple in-memory limiter: 10 attempts per IP per 15 minutes.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

// Accepts a plain HTML form post so login works even without client-side JS.
export async function POST(request: NextRequest) {
  // Relative Location: behind a reverse proxy request.url is the container's bind address.
  const redirectTo = (path: string) => new NextResponse(null, { status: 303, headers: { Location: path } });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (rateLimited(ip)) return redirectTo("/login?error=rate");

  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected || !process.env.SESSION_SECRET) return redirectTo("/login?error=config");

  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  if (!safeEqual(password, expected)) return redirectTo("/login?error=invalid");

  attempts.delete(ip);
  const response = redirectTo("/");
  response.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
