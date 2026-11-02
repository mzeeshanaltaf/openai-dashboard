// Signed session cookie using Web Crypto, so it works in both proxy and route handlers.

export const SESSION_COOKIE = "oad_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

async function hmac(value: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Buffer.from(sig).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  return `${expires}.${await hmac(String(expires))}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig || Number(expires) < Date.now() / 1000) return false;
  try {
    return safeEqual(sig, await hmac(expires));
  } catch {
    return false;
  }
}
