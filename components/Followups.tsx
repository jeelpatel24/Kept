"use client";
// S9 client: grouped follow-up list with one-tap done, reminder opt-in, and send-now digest.
// Implements: PRD-F16, PRD-F17 · reuses PATCH /api/notes/:id (PRD-F14) for the done toggle.
import Link from "next/link";
import { useState } from "react";
import type { FollowupItem } from "@/lib/followups/load";
import { BUCKET_LABELS, BUCKET_ORDER, type FollowupBucket } from "@/lib/followups/bucket";
import { formatDueDate } from "@/lib/format";

const BUCKET_STYLE: Record<FollowupBucket, string> = {
  overdue: "text-danger",
  today: "text-ink",
  tomorrow: "text-ink",
  week: "text-ink-muted",
  later: "text-ink-muted",
  someday: "text-ink-muted",
};

export function Followups({ initialItems, remindersEnabled, email }: { initialItems: FollowupItem[]; remindersEnabled: boolean; email: string }) {
  const [items, setItems] = useState(initialItems);
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [reminders, setReminders] = useState(remindersEnabled);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markDone(item: FollowupItem, done: boolean) {
    setDoneIds((d) => (done ? [...d, item.commitmentId] : d.filter((x) => x !== item.commitmentId)));
    const res = await fetch(`/api/notes/${item.noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commitments: [{ id: item.commitmentId, status: done ? "done" : "open" }] }),
    });
    if (!res.ok) {
      setDoneIds((d) => d.filter((x) => x !== item.commitmentId));
      setError("Couldn’t update — try again.");
    } else if (done) {
      // Remove after a beat so the tick is visible
      setTimeout(() => setItems((its) => its.filter((i) => i.commitmentId !== item.commitmentId)), 700);
    }
  }

  async function toggleReminders() {
    const next = !reminders;
    setReminders(next);
    const res = await fetch("/api/reminders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: next }) });
    if (!res.ok) {
      setReminders(!next);
      setError("Couldn’t save the reminder setting.");
    } else {
      setMsg(next ? `Daily digest on — overdue and due-today items go to ${email} each morning.` : "Daily digest off.");
    }
  }

  async function sendNow() {
    setBusy(true);
    setMsg(null);
    setError(null);
    const res = await fetch("/api/reminders/run", { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    setBusy(false);
    if (!res.ok) setError(body.error ?? "Digest failed");
    else setMsg(body.message ?? "Sent.");
  }

  const grouped = BUCKET_ORDER.map((b) => ({ bucket: b, items: items.filter((i) => i.bucket === b) })).filter((g) => g.items.length > 0);
  const openCount = items.length;

  return (
    <main className="mx-auto max-w-md px-5 pb-16 pt-6">
      <Link href="/" className="text-ink-muted underline-offset-4 hover:underline">
        ← Home
      </Link>
      <h1 className="mt-2 text-3xl font-extrabold">Follow-ups</h1>
      <p className="mt-1 text-ink-muted">
        {openCount === 0 ? "Everything that was promised has been done." : `${openCount} open commitment${openCount === 1 ? "" : "s"} across your conversations.`}
      </p>

      <section className="card mt-4" aria-label="Reminders">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display font-bold">Daily reminder digest</p>
            <p className="meta">overdue · due today · tomorrow → {email || "your email"}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={reminders}
            aria-label="Daily reminder digest"
            onClick={() => void toggleReminders()}
            className={`relative h-8 w-14 flex-none rounded-full transition-colors ${reminders ? "bg-ok" : "bg-line"}`}
          >
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${reminders ? "left-7" : "left-1"}`} aria-hidden />
          </button>
        </div>
        <button type="button" className="btn-quiet mt-3 w-full !min-h-[44px] text-sm" onClick={() => void sendNow()} disabled={busy}>
          {busy ? "Sending…" : "Email me today’s digest now"}
        </button>
        {msg ? (
          <p role="status" className="mt-2 text-sm text-ok">
            {msg}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </section>

      {grouped.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line p-4 text-ink-muted">Nothing open. Record a conversation and confirmed commitments land here.</p>
      ) : (
        grouped.map((g) => (
          <section key={g.bucket} className="mt-6" aria-label={BUCKET_LABELS[g.bucket]}>
            <h2 className={`label ${g.bucket === "overdue" ? "!text-danger" : ""}`}>
              {g.bucket === "overdue" ? "⚠ " : ""}
              {BUCKET_LABELS[g.bucket]} · {g.items.length}
            </h2>
            <ul className="mt-2 flex flex-col gap-2">
              {g.items.map((i) => {
                const done = doneIds.includes(i.commitmentId);
                return (
                  <li key={i.commitmentId} className="card !p-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={(e) => void markDone(i, e.target.checked)}
                        aria-label={`Mark "${i.text}" done`}
                        className="mt-1 h-6 w-6 shrink-0 accent-accent"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`font-medium ${done ? "text-ink-muted line-through" : ""}`}>{i.text}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
                          <span className="avatar-dot !h-5 !w-5 text-[10px]" aria-hidden>
                            {(i.ownerLabel ?? "?").charAt(0).toUpperCase()}
                          </span>
                          {i.ownerLabel ?? "Unassigned"}
                          {i.dueDate ? <span className={`font-semibold ${BUCKET_STYLE[i.bucket]}`}>· {formatDueDate(i.dueDate)}</span> : <span>· no date</span>}
                          <Link href={`/notes/${i.noteId}`} className="text-accent underline-offset-2 hover:underline">
                            {i.noteTitle}
                          </Link>
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
