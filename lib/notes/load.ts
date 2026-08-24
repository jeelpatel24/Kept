// Loads a full note graph. Two entry points: creator (RLS client) and guest (admin client, token pre-validated).
// Implements: SCHEMA §3 relationships, PRD-F8 (guest read).
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommitmentRow, CorrectionRow, Database, NoteRow, ParticipantRow, SessionRow, TranscriptSegmentRow } from "@/lib/db/types";

export interface NoteGraph {
  note: Pick<NoteRow, "id" | "title" | "summary" | "status" | "confirmed_at" | "created_at" | "session_id" | "extraction_version">;
  session: Pick<SessionRow, "id" | "recorded_at" | "timezone" | "duration_ms" | "status" | "error_detail">;
  participants: Pick<ParticipantRow, "id" | "label" | "is_creator" | "email">[];
  commitments: Pick<CommitmentRow, "id" | "kind" | "text" | "owner_participant_id" | "due_date" | "due_confidence" | "due_confirmed" | "source_segment_ids" | "source_quote" | "status" | "trello_card_id" | "trello_card_url" | "dispatched_at">[];
  segments: Pick<TranscriptSegmentRow, "seq" | "start_ms" | "end_ms" | "text" | "speaker_label" | "speaker_confirmed">[];
  corrections: Pick<CorrectionRow, "id" | "commitment_id" | "field" | "suggested_value" | "submitted_by_label" | "status" | "created_at">[];
}

export async function loadNoteGraph(db: SupabaseClient<Database>, noteId: string): Promise<NoteGraph | null> {
  const { data: note } = await db
    .from("notes")
    .select("id, title, summary, status, confirmed_at, created_at, session_id, extraction_version")
    .eq("id", noteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!note) return null;

  const [sessionRes, participantsRes, commitmentsRes, segmentsRes, correctionsRes] = await Promise.all([
    db.from("sessions").select("id, recorded_at, timezone, duration_ms, status, error_detail").eq("id", note.session_id).single(),
    db.from("participants").select("id, label, is_creator, email").eq("note_id", noteId).order("is_creator", { ascending: false }).order("created_at"),
    db
      .from("commitments")
      .select("id, kind, text, owner_participant_id, due_date, due_confidence, due_confirmed, source_segment_ids, source_quote, status, trello_card_id, trello_card_url, dispatched_at")
      .eq("note_id", noteId)
      .is("deleted_at", null)
      .order("created_at"),
    db.from("transcript_segments").select("seq, start_ms, end_ms, text, speaker_label, speaker_confirmed").eq("session_id", note.session_id).order("seq"),
    db.from("corrections").select("id, commitment_id, field, suggested_value, submitted_by_label, status, created_at").eq("note_id", noteId).order("created_at"),
  ]);
  if (!sessionRes.data) return null;

  return {
    note,
    session: sessionRes.data,
    participants: participantsRes.data ?? [],
    commitments: commitmentsRes.data ?? [],
    segments: segmentsRes.data ?? [],
    corrections: correctionsRes.data ?? [],
  };
}

/** Confirm gate (TRD-3.5): low-confidence dates must be touched before the note can be confirmed. */
export function untouchedLowConfidenceCount(commitments: NoteGraph["commitments"]): number {
  return commitments.filter((c) => c.kind === "commitment" && c.due_confidence === "low" && !c.due_confirmed).length;
}
