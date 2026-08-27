"use client";
// Guest view. Read-first, "Your items" on top, one optional action: "Something wrong?" → inline correction.
// Implements: PRD-F8, F9 · UX-BRIEF S6 (no signup prompt, no banners).
import { useState } from "react";
import { KeptTile } from "@/components/KeptMark";
import { fmtMs, formatDueDate, formatRecordedAt } from "@/lib/format";

type GuestCommitment = { id: string; kind: string; text: string; owner_participant_id: string | null; due_date: string | null; source_quote: string; source_segment_ids: number[]; status: string };
type GuestParticipant = { id: string; label: string; is_creator: boolean };
type GuestSegment = { seq: number; start_ms: number; text: string; speaker_label: string | null };

export function GuestNote({
  token,
  note,
  session,
  participants,
  commitments,
  segments,
}: {
  token: string;
  note: { id: string; title: string; summary: string | null };
  session: { recorded_at: string; timezone: string };
  participants: GuestParticipant[];
  commitments: GuestCommitment[];
  segments: GuestSegment[];
}) {
  const [correcting, setCorrecting] = useState<{ commitmentId: string | null } | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);

  const creator = participants.find((p) => p.is_creator);
  const guests = participants.filter((p) => !p.is_creator);
  const byOwner = (id: string) => commitments.filter((c) => c.kind === "commitment" && c.owner_participant_id === id);
  const label = (id: string | null) => participants.find((p) => p.id === id)?.label ?? "Unassigned";
  const others = commitments.filter((c) => c.kind === "commitment" && !guests.some((g) => g.id === c.owner_participant_id));
  const decisions = commitments.filter((c) => c.kind === "decision");
  const questions = commitments.filter((c) => c.kind === "open_question");

  return (
    <main className="mx-auto max-w-md pb-16">
      <header className="bg-ink px-5 pb-5 pt-6 text-white">
        <div className="flex items-center gap-2">
          <KeptTile size={30} />
          <span className="font-display text-xl font-extrabold tracking-tight">
            Kept<span className="text-[#6f9bef]">.</span>
          </span>
        </div>
        <p className="mt-3 text-sm text-white/80">
          {creator?.label ?? "Someone"} shared the record of your conversation on {formatRecordedAt(session.recorded_at, session.timezone)}. No account needed.
        </p>
      </header>
      <div className="px-5">
      <h1 className="mt-5 text-3xl font-extrabold">{note.title}</h1>
      <p className="mt-1 text-ink-muted">{participants.map((p) => p.label).join(" & ")}</p>
      {note.summary ? <p className="mt-3">{note.summary}</p> : null}

      {guests.map((g) => {
        const mine = byOwner(g.id);
        return (
          <section key={g.id} className="mt-6" aria-labelledby={`your-${g.id}`}>
            <h2 id={`your-${g.id}`} className="label !text-[#1747a8]">
              {guests.length > 1 ? `${g.label}’s items` : mine.length === 1 ? "Your item" : `Your ${mine.length === 0 ? "" : mine.length + " "}items`}
              {guests.length === 1 ? <span className="ml-2 normal-case tracking-normal text-ink-muted">({g.label})</span> : null}
            </h2>
            {mine.length === 0 ? (
              <p className="mt-2 text-ink-muted">Nothing on you from this conversation.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {mine.map((c) => (
                  <Row key={c.id} c={c} dueLabel={c.due_date ? formatDueDate(c.due_date) : "no date"} onWrong={() => setCorrecting({ commitmentId: c.id })} sent={sent.includes(c.id)} />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <section className="mt-8" aria-labelledby="theirs">
        <h2 id="theirs" className="label">
          {creator ? `${creator.label}’s items` : "Other items"}
        </h2>
        {others.length === 0 ? (
          <p className="mt-2 text-ink-muted">None.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {others.map((c) => (
              <Row key={c.id} c={c} owner={label(c.owner_participant_id)} dueLabel={c.due_date ? formatDueDate(c.due_date) : "no date"} onWrong={() => setCorrecting({ commitmentId: c.id })} sent={sent.includes(c.id)} />
            ))}
          </ul>
        )}
      </section>

      {decisions.length > 0 ? (
        <section className="mt-8" aria-labelledby="dec">
          <h2 id="dec" className="label">
            Decisions
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {decisions.map((c) => (
              <li key={c.id} className="card">
                <p className="font-medium">{c.text}</p>
                <p className="quote mt-2">“{c.source_quote}”</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {questions.length > 0 ? (
        <section className="mt-8" aria-labelledby="oq">
          <h2 id="oq" className="label">
            Open questions
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {questions.map((c) => (
              <li key={c.id} className="card">
                <p className="font-medium">{c.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 flex flex-col gap-2">
        <button type="button" className="btn-secondary" onClick={() => setCorrecting({ commitmentId: null })}>
          Something wrong?
        </button>
        <button type="button" className="tap text-ink-muted underline-offset-4 hover:underline" aria-expanded={showTranscript} onClick={() => setShowTranscript((v) => !v)}>
          {showTranscript ? "Hide transcript" : "Show transcript"}
        </button>
      </div>

      {showTranscript ? (
        <ol className="mt-4 flex flex-col gap-2">
          {segments.map((s) => (
            <li key={s.seq} className="rounded-xl bg-white p-3">
              <span className="mr-2 font-mono text-xs text-ink-muted">{fmtMs(s.start_ms)}</span>
              {s.speaker_label ? <span className="mr-2 text-sm font-medium">{s.speaker_label}:</span> : null}
              <span className="select-text">{s.text}</span>
            </li>
          ))}
        </ol>
      ) : null}

      </div>
      {correcting ? (
        <CorrectionForm
          token={token}
          commitmentId={correcting.commitmentId}
          commitmentText={commitments.find((c) => c.id === correcting.commitmentId)?.text ?? null}
          onDone={(id) => {
            if (id) setSent((s) => [...s, id]);
            setCorrecting(null);
          }}
          onCancel={() => setCorrecting(null)}
        />
      ) : null}
    </main>
  );
}

function Row({ c, owner, dueLabel, onWrong, sent }: { c: GuestCommitment; owner?: string; dueLabel: string; onWrong: () => void; sent: boolean }) {
  return (
    <li className="card">
      <p className={`text-lg font-medium ${c.status === "done" ? "text-ink-muted line-through" : ""}`}>{c.text}</p>
      <p className="mt-1 text-ink-muted">
        {owner ? `${owner} · ` : ""}
        {dueLabel}
        {c.status === "done" ? " · done" : ""}
      </p>
      <p className="quote mt-2">“{c.source_quote}”</p>
      <div className="mt-2">
        {sent ? (
          <span className="text-sm text-ok">Suggestion sent ✓</span>
        ) : (
          <button type="button" className="text-sm text-ink-muted underline-offset-2 hover:underline" onClick={onWrong}>
            Something wrong?
          </button>
        )}
      </div>
    </li>
  );
}

function CorrectionForm({ token, commitmentId, commitmentText, onDone, onCancel }: { token: string; commitmentId: string | null; commitmentText: string | null; onDone: (id: string | null) => void; onCancel: () => void }) {
  const [field, setField] = useState<"text" | "owner" | "due_date">("text");
  const [value, setValue] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/share/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commitmentId, field: commitmentId ? field : "text", suggestedValue: value.trim(), submittedByLabel: name.trim() || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Could not send");
      return;
    }
    onDone(commitmentId);
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="corr-title" className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="corr-title" className="text-xl font-bold">
          Suggest a correction
        </h2>
        {commitmentText ? <p className="mt-1 text-ink-muted">“{commitmentText}”</p> : <p className="mt-1 text-ink-muted">About the note in general.</p>}
        {commitmentId ? (
          <div className="mt-3 flex gap-2" role="radiogroup" aria-label="What’s wrong?">
            {(["text", "owner", "due_date"] as const).map((f) => (
              <button key={f} type="button" role="radio" aria-checked={field === f} className={`chip ${field === f ? "border-accent bg-accent text-white" : "chip-normal"}`} onClick={() => setField(f)}>
                {f === "text" ? "Wording" : f === "owner" ? "Who" : "Date"}
              </button>
            ))}
          </div>
        ) : null}
        <label htmlFor="corr-value" className="mt-3 block font-medium">
          {commitmentId ? (field === "due_date" ? "Correct date (YYYY-MM-DD or words)" : field === "owner" ? "Who actually owns this?" : "What should it say?") : "What’s wrong?"}
        </label>
        {field === "due_date" && commitmentId ? (
          <input id="corr-value" type="date" required value={value} onChange={(e) => setValue(e.target.value)} className="tap mt-1 w-full rounded-lg border border-line px-3" />
        ) : (
          <textarea id="corr-value" required rows={3} value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 w-full rounded-lg border border-line p-3" />
        )}
        <label htmlFor="corr-name" className="mt-3 block font-medium">
          Your name <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <input id="corr-name" value={name} onChange={(e) => setName(e.target.value)} className="tap mt-1 w-full rounded-lg border border-line px-3" />
        {error ? (
          <p role="alert" className="mt-2 text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-2">
          <button type="submit" className="btn-primary" disabled={busy || !value.trim()}>
            {busy ? "Sending…" : "Send suggestion"}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
