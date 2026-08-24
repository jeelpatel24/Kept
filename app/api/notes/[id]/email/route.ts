// POST /api/notes/:id/email — send the share link with the recipient's own items. Implements: TRD §1, TRD-3.9, PRD-F13.
import { sendShareEmail } from "@/lib/email/send";
import { jsonError } from "@/lib/http";
import { loadNoteGraph } from "@/lib/notes/load";
import { mintShareLink } from "@/lib/share/links";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emailShareSchema, uuid } from "@/lib/validation";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) return jsonError("Invalid id", 400);
  const body = emailShareSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Invalid input", 400, { issues: body.error.issues });

  const supabase = await createSupabaseServerClient();
  const graph = await loadNoteGraph(supabase, id);
  if (!graph) return jsonError("Not found", 404);
  if (graph.note.status !== "confirmed") return jsonError("Confirm the note before sharing it", 409);

  const recipient = body.data.participantId ? graph.participants.find((p) => p.id === body.data.participantId) ?? null : graph.participants.find((p) => !p.is_creator) ?? null;
  const creator = graph.participants.find((p) => p.is_creator);
  if (recipient) await supabase.from("participants").update({ email: body.data.to }).eq("id", recipient.id);

  let url: string;
  try {
    url = (await mintShareLink(id)).url;
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "could not create link", 500);
  }

  const items = graph.commitments.filter((c) => c.kind === "commitment" && recipient && c.owner_participant_id === recipient.id).map((c) => ({ text: c.text, dueDate: c.due_date }));
  const result = await sendShareEmail({ to: body.data.to, noteTitle: graph.note.title, creatorLabel: creator?.label ?? "Someone", recipientLabel: recipient?.label ?? null, items, url });
  if (!result.ok) return Response.json({ error: `Email failed: ${result.error}`, url }, { status: 502 });
  return Response.json({ ok: true, url, emailId: result.id });
}
