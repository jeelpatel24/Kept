// S4 — Review & Confirm. Implements: PRD-F4, F5, F6, F7, F15 · TRD-3.5 · UX-BRIEF §5 S4.
import { notFound, redirect } from "next/navigation";
import { ReviewEditor } from "@/components/note/ReviewEditor";
import { loadNoteGraph } from "@/lib/notes/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const graph = await loadNoteGraph(supabase, id);
  if (!graph) notFound();
  if (graph.note.status === "confirmed") redirect(`/notes/${id}`);
  return <ReviewEditor initial={graph} />;
}
