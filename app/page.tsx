// S1 — Home / Record. Implements: PRD-F1, PRD-F3 · UX-BRIEF §5 S1.
// One obvious action. Three most recent notes. Honest empty state.
import Link from "next/link";
import { RecordButton } from "@/components/RecordButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: notes } = await supabase.from("notes").select("id, title, status, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(3);
  const ids = (notes ?? []).map((n) => n.id);
  const { data: openRows } = ids.length
    ? await supabase.from("commitments").select("note_id").in("note_id", ids).eq("kind", "commitment").eq("status", "open").is("deleted_at", null)
    : { data: [] as { note_id: string }[] };
  const openCount = new Map<string, number>();
  (openRows ?? []).forEach((r) => openCount.set(r.note_id, (openCount.get(r.note_id) ?? 0) + 1));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Kept</h1>
        <Link href="/settings/trello" className="tap flex items-center text-ink-muted underline-offset-4 hover:underline">
          Trello
        </Link>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center py-10">
        <RecordButton />
        <p className="mt-6 max-w-xs text-center text-ink-muted">Tap to record a conversation. Nothing is written anywhere until you confirm.</p>
      </section>

      <section aria-labelledby="recent">
        <div className="flex items-baseline justify-between">
          <h2 id="recent" className="text-lg font-semibold">
            Recent
          </h2>
          <Link href="/notes" className="tap flex items-center text-ink-muted underline-offset-4 hover:underline">
            All notes
          </Link>
        </div>
        {!notes || notes.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line p-4 text-ink-muted">No conversations yet. Hit record during your next one.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {notes.map((n) => {
              const open = openCount.get(n.id) ?? 0;
              return (
                <li key={n.id}>
                  <Link href={n.status === "draft" ? `/notes/${n.id}/review` : `/notes/${n.id}`} className="card tap flex items-center justify-between gap-3">
                    <span className="font-medium">{n.title}</span>
                    <span className="shrink-0 text-ink-muted">
                      {n.status === "draft" ? "Needs review" : `${open} open`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
