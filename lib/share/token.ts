// HMAC-signed share tokens: { noteId, role: guest, exp }. Single-purpose, expiring, revocable via share_links.
// Implements: TRD-3.6, TRD-5.3. Pure functions take the secret explicitly so they are unit-testable.
import { createHmac, timingSafeEqual } from "node:crypto";
import { sha256Hex } from "@/lib/hash";

export interface SharePayload {
  n: string; // noteId
  r: "guest";
  exp: number; // unix seconds
  /** Optional scope: "cal" tokens are valid only for the calendar feed (TRD-3.8 webcal). */
  s?: "cal";
}

const b64u = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");

export function signShareToken(payload: SharePayload, secret: string): string {
  const body = b64u(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export type VerifyResult = { ok: true; payload: SharePayload } | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyShareToken(token: string, secret: string, now: number = Math.floor(Date.now() / 1000)): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed" };
  const [body, sig] = parts as [string, string];
  const expected = createHmac("sha256", secret).update(body).digest();
  const given = fromB64u(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "bad_signature" };
  let payload: SharePayload;
  try {
    payload = JSON.parse(fromB64u(body).toString("utf8")) as SharePayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof payload.n !== "string" || payload.r !== "guest" || typeof payload.exp !== "number") return { ok: false, reason: "malformed" };
  if (payload.exp <= now) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}

export function shareTokenHash(token: string): string {
  return sha256Hex(token);
}

export const DEFAULT_SHARE_TTL_SECONDS = 90 * 24 * 3600;
