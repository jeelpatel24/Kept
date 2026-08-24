// POST /api/trello/dispatch — confirmed commitments → cards. Refuses any note not in state `confirmed` (TRD-3.5, spec principle 1).
// Implements: TRD §1 /api/trello/dispatch, TRD-3.7, PRD-F11.
import { jsonError } from "@/lib/http";
import { loadNoteGraph } from "@/lib/notes/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTrelloConnection } from "@/lib/trello/connection";
import { dispatchToTrello } from "@/lib/trello/dispatch";
import { trelloDispatchSchema } from "@/lib/validation";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = trelloDispatchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Invalid input", 400, { issues: body.error.issues });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthenticated", 401);

  const graph = await loadNoteGraph(supabase, body.data.noteId); // RLS: only the owner can load it
  if (!graph) return jsonError("Not found", 404);
  if (graph.note.status !== "confirmed") return jsonError("Note must be confirmed before dispatch", 409);

  const conn = await getTrelloConnection(user.id);
  if (!conn) return jsonError("Trello is not connected", 409);
  if (!conn.boardId || !conn.listId) return jsonError("Pick a Trello board and list first", 409);

  try {
    const out = await dispatchToTrello(graph, conn, body.data.commitmentIds);
    return Response.json(out, { status: out.failed > 0 ? 207 : 200 });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "dispatch failed", 502);
  }
}
