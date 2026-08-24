import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, fromBytea, toBytea } from "@/lib/trello/crypto";

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("trello token encryption", () => {
  it("round-trips", () => {
    const blob = encryptSecret("abc123token", KEY);
    expect(decryptSecret(blob, KEY)).toBe("abc123token");
  });
  it("uses a fresh IV each time", () => {
    expect(encryptSecret("x", KEY).equals(encryptSecret("x", KEY))).toBe(false);
  });
  it("fails on tamper", () => {
    const blob = encryptSecret("abc123token", KEY);
    blob[blob.length - 1] = (blob[blob.length - 1] ?? 0) ^ 0xff;
    expect(() => decryptSecret(blob, KEY)).toThrow();
  });
  it("fails with wrong key", () => {
    const blob = encryptSecret("abc123token", KEY);
    expect(() => decryptSecret(blob, "f".repeat(64))).toThrow();
  });
  it("rejects a short key", () => {
    expect(() => encryptSecret("x", "abcd")).toThrow(/32 bytes/);
  });
  it("bytea hex encoding round-trips", () => {
    const blob = encryptSecret("t", KEY);
    expect(fromBytea(toBytea(blob)).equals(blob)).toBe(true);
    expect(toBytea(blob).startsWith("\\x")).toBe(true);
  });
});
