// S6 — Shared note (guest). No login. "Your items" first. One subtle action. Implements: PRD-F8, F9 · TRD-3.6 · UX-BRIEF S6.
import { GuestNote } from "@/components/note/GuestNote";
import { loadNoteGraph } from "@/lib/notes/load";
import { resolveShareToken } from "@/lib/share/links";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function SharedNotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolveShareToken(token, { touch: true, requireScope: "note" });
  if (!r.ok) {
    const msg = r.reason === "expired" ? "This link has expired." : r.reason === "revoked" ? "This link was turned off by the person who shared it." : "This link isn’t valid.";
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
        <h1 className="text-2xl font-bold">Kept</h1>
        <p className="mt-3 text-ink-muted">{msg}</p>
      </main>
    );
  }
  const graph = await loadNoteGraph(createSupabaseAdminClient(), r.noteId);
  if (!graph || graph.note.status !== "confirmed") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
        <h1 className="text-2xl font-bold">Kept</h1>
        <p className="mt-3 text-ink-muted">This note isn’t available yet.</p>
      </main>
    );
  }

  return (
    <GuestNote
      token={token}
      note={{ id: graph.note.id, title: graph.note.title, summary: graph.note.summary }}
      session={{ recorded_at: graph.session.recorded_at, timezone: graph.session.timezone }}
      participants={graph.participants.map((p) => ({ id: p.id, label: p.label, is_creator: p.is_creator }))}
      commitments={graph.commitments.map((c) => ({ id: c.id, kind: c.kind, text: c.text, owner_participant_id: c.owner_participant_id, due_date: c.due_date, source_quote: c.source_quote, source_segment_ids: c.source_segment_ids, status: c.status }))}
      segments={graph.segments.map((s) => ({ seq: s.seq, start_ms: s.start_ms, text: s.text, speaker_label: s.speaker_label }))}
    />
  );
}
