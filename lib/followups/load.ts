// Loads every open commitment across a user's confirmed notes. Works with either the
// RLS-scoped client (follow-ups screen) or the admin client filtered by user (digest).
// Implements: PRD-F16, PRD-F17.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { bucketFor, type FollowupBucket } from "@/lib/followups/bucket";

export interface FollowupItem {
  commitmentId: string;
  noteId: string;
  noteTitle: string;
  text: string;
  dueDate: string | null;
  ownerLabel: string | null;
  ownerIsCreator: boolean;
  timezone: string;
  bucket: FollowupBucket;
}

export async function loadFollowups(db: SupabaseClient<Database>, opts: { userId?: string; now?: Date } = {}): Promise<FollowupItem[]> {
  let notesQ = db.from("notes").select("id, title, session_id, user_id").eq("status", "confirmed").is("deleted_at", null);
  if (opts.userId) notesQ = notesQ.eq("user_id", opts.userId);
  const { data: notes } = await notesQ;
  if (!notes || notes.length === 0) return [];
  const noteIds = notes.map((n) => n.id);
  const sessionIds = notes.map((n) => n.session_id);

  const [{ data: commitments }, { data: participants }, { data: sessions }] = await Promise.all([
    db
      .from("commitments")
      .select("id, note_id, text, due_date, owner_participant_id, status, kind")
      .in("note_id", noteIds)
      .eq("kind", "commitment")
      .eq("status", "open")
      .is("deleted_at", null),
    db.from("participants").select("id, note_id, label, is_creator").in("note_id", noteIds),
    db.from("sessions").select("id, timezone").in("id", sessionIds),
  ]);

  const titleByNote = new Map(notes.map((n) => [n.id, n.title]));
  const tzBySession = new Map((sessions ?? []).map((s) => [s.id, s.timezone]));
  const tzByNote = new Map(notes.map((n) => [n.id, tzBySession.get(n.session_id) ?? "UTC"]));
  const participantById = new Map((participants ?? []).map((p) => [p.id, p]));
  const now = opts.now ?? new Date();

  return (commitments ?? []).map((c) => {
    const owner = c.owner_participant_id ? participantById.get(c.owner_participant_id) : undefined;
    const tz = tzByNote.get(c.note_id) ?? "UTC";
    return {
      commitmentId: c.id,
      noteId: c.note_id,
      noteTitle: titleByNote.get(c.note_id) ?? "Untitled",
      text: c.text,
      dueDate: c.due_date,
      ownerLabel: owner?.label ?? null,
      ownerIsCreator: owner?.is_creator ?? false,
      timezone: tz,
      bucket: bucketFor(c.due_date, now, tz),
    };
  });
}

const ORDER: Record<FollowupBucket, number> = { overdue: 0, today: 1, tomorrow: 2, week: 3, later: 4, someday: 5 };

export function sortFollowups(items: FollowupItem[]): FollowupItem[] {
  return [...items].sort((a, b) => ORDER[a.bucket] - ORDER[b.bucket] || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.noteTitle.localeCompare(b.noteTitle));
}
