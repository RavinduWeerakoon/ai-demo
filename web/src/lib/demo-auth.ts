import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * A single shared demo login, not real authentication: it only keeps casual
 * visitors off the showcase. The one account comes from DEMO_USERNAME and
 * DEMO_PASSWORD. A signed-in browser holds a signed, expiring cookie, so the
 * cookie can't simply be made up. With either variable unset, nobody can
 * sign in.
 */

export const SESSION_COOKIE = "meridian_demo_session";
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

function account(): { username: string; password: string } | null {
  const username = process.env.DEMO_USERNAME;
  const password = process.env.DEMO_PASSWORD;
  return username && password ? { username, password } : null;
}

export function demoLoginConfigured(): boolean {
  return account() !== null;
}

// Hashing both sides first makes the comparison constant-time regardless of
// length, so response timing doesn't reveal how much of a guess was right.
function safeEqual(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

export function checkCredentials(username: string, password: string): boolean {
  const demo = account();
  if (!demo) return false;
  // Check both so the timing doesn't reveal which of the two was wrong.
  const usernameOk = safeEqual(username, demo.username);
  const passwordOk = safeEqual(password, demo.password);
  return usernameOk && passwordOk;
}

// Signed with DEMO_SESSION_SECRET, or the password when that is unset, so
// changing the password signs every browser out.
function sign(payload: string): string | null {
  const demo = account();
  if (!demo) return null;
  const key = process.env.DEMO_SESSION_SECRET || demo.password;
  return createHmac("sha256", key).update(`${demo.username}:${payload}`).digest("base64url");
}

export function createSessionToken(now = Date.now()): string | null {
  const expires = String(Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS);
  const signature = sign(expires);
  return signature ? `${expires}.${signature}` : null;
}

export function isValidSessionToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [expires, signature, extra] = token.split(".");
  if (extra !== undefined || !expires || !signature || !/^\d{1,12}$/.test(expires)) return false;
  if (Number(expires) * 1000 <= now) return false;
  const expected = sign(expires);
  return expected !== null && safeEqual(signature, expected);
}
