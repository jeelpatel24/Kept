// Audio chunk storage helpers. Bucket is private; only this server module touches it.
// Implements: TRD-3.1 (chunked upload), TRD-4.6 / TRD-5.5 (audio deleted after transcription).
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const AUDIO_BUCKET = "audio";
export const MAX_CHUNKS = 64; // 20 min / 30 s = 40, with headroom
export const MAX_CHUNK_BYTES = 6 * 1024 * 1024;

export function chunkPath(sessionId: string, index: number): string {
  return `${sessionId}/${String(index).padStart(4, "0")}`;
}

export async function putChunk(sessionId: string, index: number, bytes: Uint8Array, mimeType: string): Promise<void> {
  const db = createSupabaseAdminClient();
  const { error } = await db.storage.from(AUDIO_BUCKET).upload(chunkPath(sessionId, index), bytes, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
}

export async function listChunks(sessionId: string): Promise<{ name: string; mimeType: string | null }[]> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.storage.from(AUDIO_BUCKET).list(sessionId, { limit: MAX_CHUNKS, sortBy: { column: "name", order: "asc" } });
  if (error) throw new Error(`storage list failed: ${error.message}`);
  return (data ?? []).map((f) => ({ name: f.name, mimeType: (f.metadata as { mimetype?: string } | null)?.mimetype ?? null }));
}

/** Downloads all chunks in order and concatenates them into one buffer. */
export async function assembleAudio(sessionId: string): Promise<{ bytes: Uint8Array; mimeType: string; chunkCount: number }> {
  const db = createSupabaseAdminClient();
  const chunks = await listChunks(sessionId);
  if (chunks.length === 0) throw new Error("no audio chunks found");
  const parts: Uint8Array[] = [];
  let mimeType = chunks[0]?.mimeType ?? "audio/webm";
  for (const c of chunks) {
    const { data, error } = await db.storage.from(AUDIO_BUCKET).download(`${sessionId}/${c.name}`);
    if (error || !data) throw new Error(`storage download failed: ${error?.message ?? "empty"}`);
    parts.push(new Uint8Array(await data.arrayBuffer()));
    if (c.mimeType) mimeType = c.mimeType;
  }
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return { bytes: out, mimeType, chunkCount: chunks.length };
}

export async function deleteAudio(sessionId: string): Promise<void> {
  const db = createSupabaseAdminClient();
  const chunks = await listChunks(sessionId);
  if (chunks.length === 0) return;
  const { error } = await db.storage.from(AUDIO_BUCKET).remove(chunks.map((c) => `${sessionId}/${c.name}`));
  if (error) throw new Error(`storage delete failed: ${error.message}`);
}
