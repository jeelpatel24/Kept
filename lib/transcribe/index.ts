// Transcription pipeline. Implements: PRD-F2, TRD-3.2, TRD-4.6, TRD-5.5, SCHEMA §4 (session state machine).
// Caller must have verified session ownership (RLS-scoped read) before calling.
import "server-only";
import { assembleAudio, deleteAudio } from "@/lib/audio/storage";
import { sha256Hex } from "@/lib/hash";
import { complete, LlmChainExhausted } from "@/lib/llm/router";
import type { TranscriptSegment } from "@/lib/llm/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type TranscribeOutcome =
  | { ok: true; segments: TranscriptSegment[]; provider: string; cacheHit: boolean }
  | { ok: false; error: string; kind: "no_audio" | "providers_failed" | "storage" | "state" };

export async function runTranscription(sessionId: string): Promise<TranscribeOutcome> {
  const db = createSupabaseAdminClient();
  const { data: session } = await db.from("sessions").select("id, status").eq("id", sessionId).maybeSingle();
  if (!session) return { ok: false, error: "Session not found", kind: "state" };
  if (session.status === "transcribed") {
    const { data: segs } = await db.from("transcript_segments").select("seq, start_ms, end_ms, text").eq("session_id", sessionId).order("seq");
    return { ok: true, segments: (segs ?? []).map((s) => ({ index: s.seq, startMs: s.start_ms, endMs: s.end_ms, text: s.text })), provider: "db", cacheHit: true };
  }
  if (session.status !== "uploaded" && session.status !== "transcription_failed") {
    return { ok: false, error: `Session is ${session.status}`, kind: "state" };
  }

  await db.from("sessions").update({ status: "transcribing", error_detail: null }).eq("id", sessionId);

  let audio: Awaited<ReturnType<typeof assembleAudio>>;
  try {
    audio = await assembleAudio(sessionId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "storage error";
    await db.from("sessions").update({ status: "transcription_failed", error_detail: msg }).eq("id", sessionId);
    return { ok: false, error: msg, kind: msg.includes("no audio") ? "no_audio" : "storage" };
  }

  const audioHash = sha256Hex(audio.bytes);
  await db.from("sessions").update({ audio_hash: audioHash }).eq("id", sessionId);

  try {
    const { result, meta, cacheHit } = await complete("transcribe", { audio: audio.bytes, mimeType: audio.mimeType, audioHash }, { sessionId });

    // Replace any prior segments (retry path), then insert.
    await db.from("transcript_segments").delete().eq("session_id", sessionId);
    if (result.segments.length > 0) {
      const rows = result.segments.map((s) => ({ session_id: sessionId, seq: s.index, start_ms: s.startMs, end_ms: s.endMs, text: s.text }));
      const { error: insErr } = await db.from("transcript_segments").insert(rows);
      if (insErr) throw new Error(`could not persist transcript: ${insErr.message}`);
    }

    await db
      .from("sessions")
      .update({ status: "transcribed", provider_used: meta.provider, duration_ms: result.durationMs ?? undefined })
      .eq("id", sessionId);

    // TRD-4.6: audio deleted within the same request on success.
    try {
      await deleteAudio(sessionId);
      await db.from("sessions").update({ audio_deleted_at: new Date().toISOString() }).eq("id", sessionId);
    } catch (e) {
      console.error("[transcribe] audio purge failed; will not block", e);
    }

    return { ok: true, segments: result.segments, provider: meta.provider, cacheHit };
  } catch (e) {
    const msg = e instanceof LlmChainExhausted ? `All transcription providers failed (${e.failures.map((f) => `${f.provider}: ${f.kind}`).join(", ")})` : e instanceof Error ? e.message : "unknown";
    await db.from("sessions").update({ status: "transcription_failed", error_detail: msg }).eq("id", sessionId);
    return { ok: false, error: msg, kind: "providers_failed" };
  }
}
