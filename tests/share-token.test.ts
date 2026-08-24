// Share token signing/verification (TRD §6 unit: "share-token signing").
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { shareTokenHash, signShareToken, verifyShareToken } from "@/lib/share/token";

const SECRET = "test-secret-do-not-use";
const NOW = 1_800_000_000;

describe("share token", () => {
  it("round-trips a valid token", () => {
    const t = signShareToken({ n: "11111111-1111-1111-1111-111111111111", r: "guest", exp: NOW + 100 }, SECRET);
    const v = verifyShareToken(t, SECRET, NOW);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.payload.n).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("rejects an expired token", () => {
    const t = signShareToken({ n: "x", r: "guest", exp: NOW - 1 }, SECRET);
    expect(verifyShareToken(t, SECRET, NOW)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a tampered payload", () => {
    const t = signShareToken({ n: "x", r: "guest", exp: NOW + 100 }, SECRET);
    const [body, sig] = t.split(".") as [string, string];
    const tampered = Buffer.from(JSON.stringify({ n: "y", r: "guest", exp: NOW + 100 })).toString("base64url");
    expect(verifyShareToken(`${tampered}.${sig}`, SECRET, NOW)).toEqual({ ok: false, reason: "bad_signature" });
    expect(verifyShareToken(`${body}.${sig}x`, SECRET, NOW).ok).toBe(false);
  });

  it("rejects a token signed with another secret", () => {
    const t = signShareToken({ n: "x", r: "guest", exp: NOW + 100 }, "other");
    expect(verifyShareToken(t, SECRET, NOW)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects malformed input", () => {
    expect(verifyShareToken("", SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
    expect(verifyShareToken("abc", SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects a non-guest role even if signed", () => {
    const body = Buffer.from(JSON.stringify({ n: "x", r: "creator", exp: NOW + 100 })).toString("base64url");
    const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
    expect(verifyShareToken(`${body}.${sig}`, SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("hashes deterministically and never stores the token", () => {
    const t = signShareToken({ n: "x", r: "guest", exp: NOW + 100 }, SECRET);
    expect(shareTokenHash(t)).toBe(shareTokenHash(t));
    expect(shareTokenHash(t)).not.toContain(t);
    expect(shareTokenHash(t)).toHaveLength(64);
  });
});
