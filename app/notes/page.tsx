// S8 — Note list. UX-BRIEF §3.
import Link from "next/link";
import { formatRecordedAt } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: notes } = await supabase.from("notes").select("id, title, status, created_at, session_id").is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
  const sessionIds = (notes ?? []).map((n) => n.session_id);
  const { data: sessions } = sessionIds.length ? await supabase.from("sessions").select("id, recorded_at, timezone").in("id", sessionIds) : { data: [] as { id: string; recorded_at: string; timezone: string }[] };
  const sessionById = new Map((sessions ?? []).map((s) => [s.id, s]));

  const { data: failed } = await supabase.from("sessions").select("id, recorded_at, timezone, status").in("status", ["uploaded", "transcription_failed", "transcribing", "transcribed"]).is("deleted_at", null).order("created_at", { ascending: false }).limit(20);
  const noteSessionIds = new Set(sessionIds);
  const orphanSessions = (failed ?? []).filter((s) => !noteSessionIds.has(s.id));

  return (
    <main className="mx-auto max-w-md px-5 pb-16 pt-6">
      <Link href="/" className="text-ink-muted underline-offset-4 hover:underline">
        ← Home
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Notes</h1>

      {orphanSessions.length > 0 ? (
        <section className="mt-4" aria-labelledby="unfinished">
          <h2 id="unfinished" className="font-semibold text-amber">
            <span aria-hidden>⚠</span> Unfinished recordings
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {orphanSessions.map((s) => (
              <li key={s.id}>
                <Link href={`/record/${s.id}/processing`} className="card tap flex items-center justify-between">
                  <span>{formatRecordedAt(s.recorded_at, s.timezone)}</span>
                  <span className="text-ink-muted">{s.status.replace("_", " ")} → resume</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!notes || notes.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line p-4 text-ink-muted">No conversations yet. Hit record during your next one.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {notes.map((n) => {
            const s = sessionById.get(n.session_id);
            return (
              <li key={n.id}>
                <Link href={n.status === "draft" ? `/notes/${n.id}/review` : `/notes/${n.id}`} className="card tap flex flex-col">
                  <span className="font-medium">{n.title}</span>
                  <span className="text-sm text-ink-muted">
                    {s ? formatRecordedAt(s.recorded_at, s.timezone) : ""}
                    {n.status === "draft" ? " · Needs review" : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
