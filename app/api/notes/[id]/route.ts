// GET /api/notes/:id — full graph for the creator.
// PATCH /api/notes/:id — edits (title, commitments, participants, speaker labels, correction accept/reject) and draft → confirmed.
// Implements: TRD §1 /api/notes/:id, TRD-3.5 (confirm enforced server-side), PRD-F5, F7, F9, F14.
import type { CommitmentRow } from "@/lib/db/types";
import { jsonError } from "@/lib/http";
import { loadNoteGraph, untouchedLowConfidenceCount } from "@/lib/notes/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateNoteSchema, uuid } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) return jsonError("Invalid id", 400);
  const supabase = await createSupabaseServerClient();
  const graph = await loadNoteGraph(supabase, id);
  if (!graph) return jsonError("Not found", 404);
  return Response.json(graph);
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) return jsonError("Invalid id", 400);
  const body = updateNoteSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Invalid input", 400, { issues: body.error.issues });

  const supabase = await createSupabaseServerClient();
  const graph = await loadNoteGraph(supabase, id);
  if (!graph) return jsonError("Not found", 404);
  const patch = body.data;
  const errors: string[] = [];

  if (patch.title !== undefined) {
    const { error } = await supabase.from("notes").update({ title: patch.title }).eq("id", id);
    if (error) errors.push(`title: ${error.message}`);
  }

  if (patch.participants) {
    for (const p of patch.participants) {
      if (!graph.participants.some((x) => x.id === p.id)) {
        errors.push(`participant ${p.id}: not on this note`);
        continue;
      }
      const upd: { label?: string; email?: string | null } = {};
      if (p.label !== undefined) upd.label = p.label;
      if (p.email !== undefined) upd.email = p.email;
      const { error } = await supabase.from("participants").update(upd).eq("id", p.id).eq("note_id", id);
      if (error) errors.push(`participant ${p.id}: ${error.message}`);
    }
  }

  if (patch.newParticipants) {
    for (const np of patch.newParticipants) {
      if (graph.participants.length >= 4) {
        errors.push("participants: limit reached");
        break;
      }
      const { error } = await supabase.from("participants").insert({ note_id: id, label: np.label, is_creator: false });
      if (error) errors.push(`new participant: ${error.message}`);
    }
  }

  if (patch.commitments) {
    const participantIds = new Set(graph.participants.map((p) => p.id));
    // Refresh in case new participants were just added
    if (patch.newParticipants?.length) {
      const { data } = await supabase.from("participants").select("id").eq("note_id", id);
      (data ?? []).forEach((p) => participantIds.add(p.id));
    }
    for (const c of patch.commitments) {
      const current = graph.commitments.find((x) => x.id === c.id);
      if (!current) {
        errors.push(`commitment ${c.id}: not on this note`);
        continue;
      }
      if (c.deleted) {
        const { error } = await supabase.from("commitments").update({ deleted_at: new Date().toISOString() }).eq("id", c.id).eq("note_id", id);
        if (error) errors.push(`commitment ${c.id}: ${error.message}`);
        continue;
      }
      const upd: Partial<Pick<CommitmentRow, "text" | "status" | "owner_participant_id" | "due_date" | "due_confidence" | "due_confirmed">> = {};
      if (c.text !== undefined) upd.text = c.text;
      if (c.status !== undefined) upd.status = c.status;
      if (c.ownerParticipantId !== undefined) {
        if (c.ownerParticipantId !== null && !participantIds.has(c.ownerParticipantId)) {
          errors.push(`commitment ${c.id}: owner not on this note`);
          continue;
        }
        upd.owner_participant_id = c.ownerParticipantId;
      }
      if (c.dueDate !== undefined) {
        // A human-set date is by definition confirmed and high confidence.
        upd.due_date = c.dueDate;
        upd.due_confidence = c.dueDate ? "high" : null;
        upd.due_confirmed = c.dueDate !== null;
      }
      if (c.dueConfirmed !== undefined) upd.due_confirmed = c.dueConfirmed;
      if (Object.keys(upd).length === 0) continue;
      const { error } = await supabase.from("commitments").update(upd).eq("id", c.id).eq("note_id", id);
      if (error) errors.push(`commitment ${c.id}: ${error.message}`);
    }
  }

  if (patch.segments) {
    for (const s of patch.segments) {
      const { error } = await supabase
        .from("transcript_segments")
        .update({ speaker_label: s.speakerLabel, speaker_confirmed: true })
        .eq("session_id", graph.session.id)
        .eq("seq", s.seq);
      if (error) errors.push(`segment ${s.seq}: ${error.message}`);
    }
  }

  if (patch.corrections) {
    for (const r of patch.corrections) {
      const corr = graph.corrections.find((x) => x.id === r.id);
      if (!corr || corr.status !== "pending") {
        errors.push(`correction ${r.id}: not pending`);
        continue;
      }
      if (r.action === "accept") {
        const applyErr = await applyCorrection(supabase, graph, corr);
        if (applyErr) {
          errors.push(`correction ${r.id}: ${applyErr}`);
          continue;
        }
      }
      const { error } = await supabase
        .from("corrections")
        .update({ status: r.action === "accept" ? "accepted" : "rejected", resolved_at: new Date().toISOString() })
        .eq("id", r.id)
        .eq("note_id", id);
      if (error) errors.push(`correction ${r.id}: ${error.message}`);
    }
  }

  if (patch.confirm) {
    if (graph.note.status === "confirmed") {
      // Already confirmed — idempotent.
    } else {
      const fresh = await loadNoteGraph(supabase, id);
      const pending = untouchedLowConfidenceCount(fresh?.commitments ?? []);
      if (pending > 0) {
        return jsonError(`${pending} date${pending === 1 ? "" : "s"} need${pending === 1 ? "s" : ""} your confirmation`, 409, { pendingLowConfidence: pending });
      }
      const { error } = await supabase.from("notes").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", id).eq("status", "draft");
      if (error) errors.push(`confirm: ${error.message}`);
    }
  }

  const result = await loadNoteGraph(supabase, id);
  return Response.json({ ...result, errors }, { status: errors.length ? 207 : 200 });
}

type Graph = NonNullable<Awaited<ReturnType<typeof loadNoteGraph>>>;
type Supa = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Applies an accepted guest correction to the item. Records who changed it via updated_at + correction row (TRD-3.6). */
async function applyCorrection(supabase: Supa, graph: Graph, corr: Graph["corrections"][number]): Promise<string | null> {
  if (!corr.commitment_id) return null; // note-level correction: accepted as a recorded remark, nothing to apply automatically
  const target = graph.commitments.find((c) => c.id === corr.commitment_id);
  if (!target) return "target commitment missing";
  if (corr.field === "text") {
    const { error } = await supabase.from("commitments").update({ text: corr.suggested_value }).eq("id", target.id);
    return error?.message ?? null;
  }
  if (corr.field === "due_date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(corr.suggested_value)) return "suggested due date is not YYYY-MM-DD; set it manually";
    const { error } = await supabase.from("commitments").update({ due_date: corr.suggested_value, due_confidence: "high", due_confirmed: true }).eq("id", target.id);
    return error?.message ?? null;
  }
  // owner: match by participant label (case-insensitive); otherwise the creator picks manually
  const match = graph.participants.find((p) => p.label.toLowerCase() === corr.suggested_value.trim().toLowerCase());
  if (!match) return `no participant named "${corr.suggested_value}"; set the owner manually`;
  const { error } = await supabase.from("commitments").update({ owner_participant_id: match.id }).eq("id", target.id);
  return error?.message ?? null;
}
