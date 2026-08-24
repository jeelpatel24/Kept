// Client-side view of the note graph (mirrors lib/notes/load.ts NoteGraph, type-only).
import type { NoteGraph } from "@/lib/notes/load";

export type Graph = NoteGraph;
export type Commitment = NoteGraph["commitments"][number];
export type Participant = NoteGraph["participants"][number];
export type Segment = NoteGraph["segments"][number];
export type Correction = NoteGraph["corrections"][number];

export type CommitmentPatch = {
  id: string;
  text?: string;
  ownerParticipantId?: string | null;
  dueDate?: string | null;
  dueConfirmed?: boolean;
  status?: "open" | "done";
  deleted?: boolean;
};

export type NotePatch = {
  title?: string;
  commitments?: CommitmentPatch[];
  participants?: { id: string; label?: string; email?: string | null }[];
  newParticipants?: { label: string }[];
  segments?: { seq: number; speakerLabel: string | null }[];
  corrections?: { id: string; action: "accept" | "reject" }[];
  confirm?: boolean;
};

export async function patchNote(noteId: string, patch: NotePatch): Promise<{ graph: Graph | null; error: string | null; status: number; extra?: Record<string, unknown> }> {
  const res = await fetch(`/api/notes/${noteId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  const body = (await res.json().catch(() => ({}))) as Partial<Graph> & { error?: string; errors?: string[]; pendingLowConfidence?: number };
  if (!res.ok) return { graph: null, error: body.error ?? `Request failed (${res.status})`, status: res.status, extra: { pendingLowConfidence: body.pendingLowConfidence } };
  const errs = body.errors ?? [];
  return { graph: body as Graph, error: errs.length ? errs.join("; ") : null, status: res.status };
}
