// S5 — Note (creator view). Implements: PRD-F8, F9, F11, F12, F14 · UX-BRIEF §5 S5.
import { notFound, redirect } from "next/navigation";
import { NoteView } from "@/components/note/NoteView";
import { loadNoteGraph } from "@/lib/notes/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const graph = await loadNoteGraph(supabase, id);
  if (!graph) notFound();
  if (graph.note.status === "draft") redirect(`/notes/${id}/review`);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("users").select("trello_connected_at, trello_board_id, trello_list_id").eq("id", user.id).maybeSingle() : { data: null };
  const trelloReady = Boolean(profile?.trello_connected_at && profile?.trello_board_id && profile?.trello_list_id);

  return <NoteView initial={graph} trelloReady={trelloReady} />;
}
