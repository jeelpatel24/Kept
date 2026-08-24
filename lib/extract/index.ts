// Extraction pipeline: transcript → LLM router → Zod → resolve → note/participants/commitments (draft).
// Implements: PRD-F4, F5, F6 · TRD-3.3 · SCHEMA notes/participants/commitments. Caller verifies ownership first.
import "server-only";
import { localDateParts } from "@/lib/extract/dates";
import { resolveItems } from "@/lib/extract/resolve";
import { parseExtractionJson } from "@/lib/extract/schema";
import { sha256Hex } from "@/lib/hash";
import { complete, LlmChainExhausted } from "@/lib/llm/router";
import { buildExtractUserPrompt, buildRepairSuffix, EXTRACT_PROMPT_VERSION, EXTRACT_SYSTEM_PROMPT } from "@/lib/prompts/extract.v1";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ExtractOutcome =
  | { ok: true; noteId: string; itemCount: number; rejectedCount: number; cacheHit: boolean }
  | { ok: false; error: string; kind: "state" | "rate_limited" | "providers_failed" | "malformed" | "db" };

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function runExtraction(sessionId: string, userId: string, creatorHint: string | null): Promise<ExtractOutcome> {
  const db = createSupabaseAdminClient();

  // Idempotent: a note already exists for this session.
  const { data: existing } = await db.from("notes").select("id").eq("session_id", sessionId).is("deleted_at", null).maybeSingle();
  if (existing) {
    const { count } = await db.from("commitments").select("id", { count: "exact", head: true }).eq("note_id", existing.id);
    return { ok: true, noteId: existing.id, itemCount: count ?? 0, rejectedCount: 0, cacheHit: true };
  }

  const { data: session } = await db.from("sessions").select("id, status, recorded_at, timezone, user_id").eq("id", sessionId).maybeSingle();
  if (!session || session.user_id !== userId) return { ok: false, error: "Session not found", kind: "state" };
  if (session.status !== "transcribed") return { ok: false, error: `Session is ${session.status}; transcript required first`, kind: "state" };

  const { data: segRows } = await db.from("transcript_segments").select("seq, start_ms, text").eq("session_id", sessionId).order("seq");
  const segments = (segRows ?? []).map((s) => ({ seq: s.seq, startMs: s.start_ms, text: s.text }));

  // Zero-transcript path: still create an honest empty draft note so the transcript screen exists (PRD-F15).
  if (segments.length === 0) {
    return await persistNote(sessionId, userId, { title: "Untitled conversation", summary: null, participants: [{ label: creatorHint ?? "Me", isCreator: true }], speakerBySegment: [], items: [] }, null, session.recorded_at, session.timezone, new Set());
  }

  const lp = localDateParts(new Date(session.recorded_at), session.timezone);
  const localDateLabel = `${WEEKDAY[lp.wd]}, ${lp.y}-${String(lp.m + 1).padStart(2, "0")}-${String(lp.d).padStart(2, "0")}`;
  const userPrompt = buildExtractUserPrompt({ recordedAtIso: session.recorded_at, timezone: session.timezone, localDateLabel, creatorHint, segments });
  const inputHash = sha256Hex(`${EXTRACT_PROMPT_VERSION}\n${session.recorded_at}\n${session.timezone}\n${userPrompt}`);

  let raw: string;
  let cacheHit = false;
  try {
    const first = await complete("extract", { system: EXTRACT_SYSTEM_PROMPT, user: userPrompt, inputHash }, { sessionId });
    raw = first.result.raw;
    cacheHit = first.cacheHit;
  } catch (e) {
    return failFromChain(e);
  }

  let parsed = parseExtractionJson(raw);
  if (!parsed.ok) {
    // One repair retry (TRD-3.3), bypassing the cache so the bad output is not replayed.
    try {
      const repair = await complete("extract", { system: EXTRACT_SYSTEM_PROMPT, user: userPrompt + buildRepairSuffix(parsed.error), inputHash: `${inputHash}:repair` }, { sessionId, skipCache: true });
      parsed = parseExtractionJson(repair.result.raw);
      cacheHit = false;
    } catch (e) {
      return failFromChain(e);
    }
    if (!parsed.ok) return { ok: false, error: `Model output could not be validated after retry (${parsed.error})`, kind: "malformed" };
  }

  return await persistNote(sessionId, userId, parsed.data, inputHash, session.recorded_at, session.timezone, new Set(segments.map((s) => s.seq)), cacheHit);
}

function failFromChain(e: unknown): ExtractOutcome {
  if (e instanceof LlmChainExhausted) {
    const allRate = e.failures.every((f) => f.kind === "rate_limited");
    return { ok: false, error: e.message, kind: allRate ? "rate_limited" : "providers_failed" };
  }
  return { ok: false, error: e instanceof Error ? e.message : "unknown", kind: "providers_failed" };
}

async function persistNote(
  sessionId: string,
  userId: string,
  output: Parameters<typeof resolveItems>[0],
  extractionHash: string | null,
  recordedAt: string,
  timezone: string,
  validSeqs: Set<number>,
  cacheHit = false,
): Promise<ExtractOutcome> {
  const db = createSupabaseAdminClient();
  const { items, rejected } = resolveItems(output, { recordedAt, timezone, validSegmentSeqs: validSeqs });

  const { data: note, error: noteErr } = await db
    .from("notes")
    .insert({ session_id: sessionId, user_id: userId, title: output.title, summary: output.summary, status: "draft", extraction_version: EXTRACT_PROMPT_VERSION, extraction_hash: extractionHash })
    .select("id")
    .single();
  if (noteErr || !note) return { ok: false, error: `could not create note: ${noteErr?.message ?? "unknown"}`, kind: "db" };

  // Participants: dedupe labels, exactly one creator.
  const seen = new Set<string>();
  const participantsIn = output.participants.filter((p) => (seen.has(p.label) ? false : (seen.add(p.label), true)));
  if (!participantsIn.some((p) => p.isCreator) && participantsIn[0]) participantsIn[0].isCreator = true;
  let creatorSeen = false;
  const participantRows = participantsIn.map((p) => {
    const isCreator = p.isCreator && !creatorSeen;
    if (isCreator) creatorSeen = true;
    return { note_id: note.id, label: p.label, is_creator: isCreator };
  });
  const { data: participants, error: pErr } = await db.from("participants").insert(participantRows).select("id, label");
  if (pErr || !participants) return { ok: false, error: `could not create participants: ${pErr?.message ?? "unknown"}`, kind: "db" };
  const idByLabel = new Map(participants.map((p) => [p.label, p.id]));

  if (items.length > 0) {
    const rows = items.map((it) => ({
      note_id: note.id,
      kind: it.type,
      text: it.text,
      owner_participant_id: it.ownerLabel ? (idByLabel.get(it.ownerLabel) ?? null) : null,
      due_date: it.dueDate,
      due_confidence: it.dueConfidence,
      due_confirmed: it.dueConfidence === "high",
      source_segment_ids: it.sourceSegmentIds,
      source_quote: it.sourceQuote,
    }));
    const { error: cErr } = await db.from("commitments").insert(rows);
    if (cErr) return { ok: false, error: `could not create commitments: ${cErr.message}`, kind: "db" };
  }

  // Speaker labels on segments (PRD-F5) — inferred, unconfirmed.
  const labelSet = new Set(participants.map((p) => p.label));
  for (const s of output.speakerBySegment) {
    if (!validSeqs.has(s.seq) || !labelSet.has(s.speaker)) continue;
    await db.from("transcript_segments").update({ speaker_label: s.speaker }).eq("session_id", sessionId).eq("seq", s.seq);
  }

  return { ok: true, noteId: note.id, itemCount: items.length, rejectedCount: rejected.length, cacheHit };
}
