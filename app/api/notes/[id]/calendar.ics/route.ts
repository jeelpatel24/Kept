// GET /api/notes/:id/calendar.ics — download (creator cookie auth) or subscribe (?t=<cal-scoped signed token>, no cookies).
// POST — mint a webcal:// subscription URL. Corrections propagate because the feed is generated live (TRD-3.8).
// Implements: TRD §1 /api/notes/:id/calendar.ics, TRD-3.8, PRD-F12.
import { buildIcs } from "@/lib/calendar/ics";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { loadNoteGraph, type NoteGraph } from "@/lib/notes/load";
import { mintShareLink, resolveShareToken } from "@/lib/share/links";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calendarQuerySchema, REMINDER_OFFSETS_MINUTES, uuid } from "@/lib/validation";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) return jsonError("Invalid id", 400);
  const url = new URL(request.url);
  const q = calendarQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!q.success) return jsonError("Invalid query", 400, { issues: q.error.issues });

  let graph: NoteGraph | null = null;
  if (q.data.t) {
    const r = await resolveShareToken(q.data.t, { requireScope: "cal" });
    if (!r.ok || r.noteId !== id || r.scope !== "cal") return jsonError("Invalid or expired calendar link", 404);
    graph = await loadNoteGraph(createSupabaseAdminClient(), id);
  } else {
    const supabase = await createSupabaseServerClient();
    graph = await loadNoteGraph(supabase, id);
  }
  if (!graph) return jsonError("Not found", 404);
  if (graph.note.status !== "confirmed") return jsonError("Confirm the note first", 409);

  const reminder = q.data.reminder ?? 60;
  let items = graph.commitments.filter((c) => c.kind === "commitment");
  if (q.data.commitmentId) items = items.filter((c) => c.id === q.data.commitmentId);
  if (q.data.participantId) items = items.filter((c) => c.owner_participant_id === q.data.participantId);

  const labelOf = (pid: string | null) => graph!.participants.find((p) => p.id === pid)?.label ?? null;
  const out = buildIcs({
    noteId: id,
    noteTitle: graph.note.title,
    noteUrl: `${env.APP_URL}/notes/${id}`,
    timezone: graph.session.timezone,
    reminderMinutes: reminder,
    commitments: items.map((c) => ({ id: c.id, text: c.text, ownerLabel: labelOf(c.owner_participant_id), dueDate: c.due_date, sourceQuote: c.source_quote, status: c.status, trelloCardUrl: c.trello_card_url })),
  });
  if (!out.ok) return jsonError(out.error, 500);

  const filename = `kept-${graph.note.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "note"}.ics`;
  return new Response(out.ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": q.data.t ? "inline" : `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

const postSchema = z.object({
  reminder: z.number().int().refine((n) => (REMINDER_OFFSETS_MINUTES as readonly number[]).includes(n)).optional(),
  participantId: uuid.optional(),
});

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) return jsonError("Invalid id", 400);
  const body = postSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return jsonError("Invalid input", 400);
  const supabase = await createSupabaseServerClient();
  const { data: note } = await supabase.from("notes").select("id, status").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!note) return jsonError("Not found", 404);
  if (note.status !== "confirmed") return jsonError("Confirm the note first", 409);
  try {
    const link = await mintShareLink(id, "cal");
    const u = new URL(link.url);
    if (body.data.reminder) u.searchParams.set("reminder", String(body.data.reminder));
    if (body.data.participantId) u.searchParams.set("participantId", body.data.participantId);
    const httpsUrl = u.toString();
    return Response.json({ webcalUrl: httpsUrl.replace(/^https?:\/\//, "webcal://"), httpsUrl, expiresAt: link.expiresAt });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "could not mint link", 500);
  }
}
