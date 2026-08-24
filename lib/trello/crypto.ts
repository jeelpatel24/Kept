// AES-256-GCM for the Trello token at rest (TRD-3.7, TRD-5.2). Key: 32 bytes hex in ENCRYPTION_KEY.
// Pure functions take the key explicitly so they are unit-testable.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const IV_BYTES = 12;
const TAG_BYTES = 16;

export function parseKey(hex: string): Buffer {
  const key = Buffer.from(hex.trim(), "hex");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  return key;
}

/** Returns iv || ciphertext || tag */
export function encryptSecret(plaintext: string, keyHex: string): Buffer {
  const key = parseKey(keyHex);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, ct, cipher.getAuthTag()]);
}

export function decryptSecret(blob: Buffer, keyHex: string): string {
  const key = parseKey(keyHex);
  if (blob.length < IV_BYTES + TAG_BYTES) throw new Error("ciphertext too short");
  const iv = blob.subarray(0, IV_BYTES);
  const tag = blob.subarray(blob.length - TAG_BYTES);
  const ct = blob.subarray(IV_BYTES, blob.length - TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Postgres bytea ↔ PostgREST hex encoding ("\\x..."). */
export function toBytea(buf: Buffer): string {
  return `\\x${buf.toString("hex")}`;
}
export function fromBytea(s: string): Buffer {
  return Buffer.from(s.startsWith("\\x") ? s.slice(2) : s, "hex");
}
