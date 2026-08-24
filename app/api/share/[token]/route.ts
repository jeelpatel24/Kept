// GET /api/share/:token — guest read (service role after token validation; never RLS).
// POST /api/share/:token — guest submits a correction suggestion (pending).
// Implements: TRD §1 /api/share/:token, TRD-3.6 ("read + suggest-correction only; enforced server-side"), PRD-F8, F9.
import { jsonError } from "@/lib/http";
import { loadNoteGraph } from "@/lib/notes/load";
import { resolveShareToken } from "@/lib/share/links";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { guestCorrectionSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ token: string }> };

function guestView(graph: NonNullable<Awaited<ReturnType<typeof loadNoteGraph>>>) {
  // Strip anything a guest has no business seeing (Trello ids, correction queue internals beyond their own pending state).
  return {
    note: { id: graph.note.id, title: graph.note.title, summary: graph.note.summary, status: graph.note.status },
    session: { recorded_at: graph.session.recorded_at, timezone: graph.session.timezone },
    participants: graph.participants.map((p) => ({ id: p.id, label: p.label, is_creator: p.is_creator })),
    commitments: graph.commitments.map((c) => ({ id: c.id, kind: c.kind, text: c.text, owner_participant_id: c.owner_participant_id, due_date: c.due_date, source_quote: c.source_quote, source_segment_ids: c.source_segment_ids, status: c.status })),
    segments: graph.segments.map((s) => ({ seq: s.seq, start_ms: s.start_ms, text: s.text, speaker_label: s.speaker_label })),
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const r = await resolveShareToken(token, { touch: true, requireScope: "note" });
  if (!r.ok) return jsonError(`Link ${r.reason === "expired" ? "expired" : r.reason === "revoked" ? "revoked" : "invalid"}`, r.reason === "expired" || r.reason === "revoked" ? 410 : 404);
  const graph = await loadNoteGraph(createSupabaseAdminClient(), r.noteId);
  if (!graph || graph.note.status !== "confirmed") return jsonError("Not available", 404);
  return Response.json(guestView(graph));
}

export async function POST(request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const r = await resolveShareToken(token, { requireScope: "note" });
  if (!r.ok) return jsonError("Link invalid or expired", 404);
  const body = guestCorrectionSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Invalid input", 400, { issues: body.error.issues });

  const db = createSupabaseAdminClient();
  if (body.data.commitmentId) {
    const { data: c } = await db.from("commitments").select("id").eq("id", body.data.commitmentId).eq("note_id", r.noteId).is("deleted_at", null).maybeSingle();
    if (!c) return jsonError("That item is not on this note", 400);
  }
  // Rate-limit abuse lightly: cap pending corrections per note.
  const { count } = await db.from("corrections").select("id", { count: "exact", head: true }).eq("note_id", r.noteId).eq("status", "pending");
  if ((count ?? 0) >= 50) return jsonError("Too many pending suggestions on this note", 429);

  const { data, error } = await db
    .from("corrections")
    .insert({
      note_id: r.noteId,
      commitment_id: body.data.commitmentId,
      field: body.data.field,
      suggested_value: body.data.suggestedValue,
      submitted_by_label: body.data.submittedByLabel?.trim() || null,
    })
    .select("id, status")
    .single();
  if (error || !data) return jsonError(error?.message ?? "could not save", 500);
  return Response.json({ correction: data }, { status: 201 });
}
