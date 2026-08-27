"use client";
// S5 creator note: ledger with status toggles, Share · Send to Trello · Add to calendar, pending corrections badge.
// Implements: PRD-F8, F9, F11, F12, F13, F14 · TRD-3.6, 3.7, 3.8, 3.9 · UX-BRIEF S5, §6 (partial failure per item).
import Link from "next/link";
import { useCallback, useState } from "react";
import { CommitmentRow } from "@/components/note/CommitmentRow";
import { TranscriptAccordion } from "@/components/note/TranscriptAccordion";
import { patchNote, type CommitmentPatch, type Graph, type NotePatch } from "@/components/note/types";
import { formatDueDate, formatRecordedAt } from "@/lib/format";

type TrelloItemState = { status: "idle" | "sending" | "ok" | "error"; message?: string };
const REMINDERS = [
  { minutes: 30, label: "30 min before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 240, label: "4 hours before" },
  { minutes: 1440, label: "1 day before" },
];

export function NoteView({ initial, trelloReady }: { initial: Graph; trelloReady: boolean }) {
  const [graph, setGraph] = useState<Graph>(initial);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [emailMsg, setEmailMsg] = useState("");
  const [trello, setTrello] = useState<Record<string, TrelloItemState>>({});
  const [trelloBusy, setTrelloBusy] = useState(false);
  const [trelloSummary, setTrelloSummary] = useState<string | null>(null);
  const [reminder, setReminder] = useState(60);
  const [webcal, setWebcal] = useState<string | null>(null);
  const [panel, setPanel] = useState<"share" | "calendar" | null>(null);

  const apply = useCallback(
    async (patch: NotePatch) => {
      setError(null);
      const r = await patchNote(graph.note.id, patch);
      if (r.graph) setGraph(r.graph);
      if (r.error) setError(r.error);
      return r;
    },
    [graph.note.id],
  );

  const patchCommitment = (id: string, p: Omit<CommitmentPatch, "id">) => {
    setGraph((g) => ({
      ...g,
      commitments: g.commitments
        .map((c) =>
          c.id === id
            ? {
                ...c,
                ...(p.text !== undefined ? { text: p.text } : {}),
                ...(p.ownerParticipantId !== undefined ? { owner_participant_id: p.ownerParticipantId } : {}),
                ...(p.dueDate !== undefined ? { due_date: p.dueDate, due_confidence: p.dueDate ? ("high" as const) : null, due_confirmed: p.dueDate !== null } : {}),
                ...(p.status !== undefined ? { status: p.status } : {}),
              }
            : c,
        )
        .filter((c) => !(p.deleted && c.id === id)),
    }));
    void apply({ commitments: [{ id, ...p }] });
  };

  async function share() {
    setShareBusy(true);
    setError(null);
    const res = await fetch(`/api/notes/${graph.note.id}/share`, { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    setShareBusy(false);
    if (!res.ok || !body.url) {
      setError(body.error ?? "Could not create a link");
      return;
    }
    setShareUrl(body.url);
    setPanel("share");
  }

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn’t copy — long-press the link to copy it.");
    }
  }

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailState("sending");
    const guest = graph.participants.find((p) => !p.is_creator);
    const res = await fetch(`/api/notes/${graph.note.id}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: emailTo.trim(), participantId: guest?.id }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; url?: string };
    if (!res.ok) {
      setEmailState("error");
      setEmailMsg(body.error ?? "Email failed — the link above still works.");
      return;
    }
    setEmailState("sent");
    setEmailMsg(`Sent to ${emailTo.trim()}`);
    if (body.url && !shareUrl) setShareUrl(body.url);
  }

  async function dispatch(ids?: string[]) {
    const targets = ids ?? graph.commitments.filter((c) => c.kind === "commitment" && !c.trello_card_id).map((c) => c.id);
    if (targets.length === 0) {
      setTrelloSummary("Every commitment already has a card.");
      return;
    }
    setTrelloBusy(true);
    setTrelloSummary(null);
    setTrello((t) => ({ ...t, ...Object.fromEntries(targets.map((id) => [id, { status: "sending" as const }])) }));
    const res = await fetch("/api/trello/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteId: graph.note.id, commitmentIds: targets }) });
    const body = (await res.json().catch(() => ({}))) as { error?: string; results?: { commitmentId: string; ok: boolean; cardUrl?: string; error?: string }[]; created?: number; failed?: number; skipped?: number };
    setTrelloBusy(false);
    if (!res.ok || !body.results) {
      setTrello((t) => ({ ...t, ...Object.fromEntries(targets.map((id) => [id, { status: "error" as const, message: body.error ?? `HTTP ${res.status}` }])) }));
      setTrelloSummary(body.error ?? "Trello request failed");
      return;
    }
    setTrello((t) => ({ ...t, ...Object.fromEntries(body.results!.map((r) => [r.commitmentId, r.ok ? { status: "ok" as const } : { status: "error" as const, message: r.error }])) }));
    setGraph((g) => ({ ...g, commitments: g.commitments.map((c) => (body.results!.find((r) => r.commitmentId === c.id && r.ok) ? { ...c, trello_card_url: body.results!.find((r) => r.commitmentId === c.id)?.cardUrl ?? c.trello_card_url, trello_card_id: c.trello_card_id ?? "set" } : c)) }));
    const created = body.created ?? 0;
    const failed = body.failed ?? 0;
    setTrelloSummary(failed === 0 ? `${created} card${created === 1 ? "" : "s"} created.` : `${created} of ${created + failed} cards created — ${failed} failed (see below, retry each).`);
  }

  async function getWebcal() {
    const res = await fetch(`/api/notes/${graph.note.id}/calendar.ics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reminder }) });
    const body = (await res.json().catch(() => ({}))) as { webcalUrl?: string; error?: string };
    if (!res.ok || !body.webcalUrl) {
      setError(body.error ?? "Could not create subscription link");
      return;
    }
    setWebcal(body.webcalUrl);
  }

  const commitments = graph.commitments.filter((c) => c.kind === "commitment");
  const decisions = graph.commitments.filter((c) => c.kind === "decision");
  const questions = graph.commitments.filter((c) => c.kind === "open_question");
  const pendingCorrections = graph.corrections.filter((c) => c.status === "pending");
  const creator = graph.participants.find((p) => p.is_creator);
  const labelOf = (id: string | null) => graph.participants.find((p) => p.id === id)?.label ?? "Unassigned";

  return (
    <main className="mx-auto max-w-md px-5 pb-16 pt-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-ink-muted underline-offset-4 hover:underline">
          ← Home
        </Link>
        <span className="chip chip-ok !min-h-0 !py-1 text-sm">✓ Confirmed</span>
      </div>
      <h1 className="mt-2 text-3xl font-extrabold">{graph.note.title}</h1>
      <p className="mt-1 text-ink-muted">
        {formatRecordedAt(graph.session.recorded_at, graph.session.timezone)} · {graph.participants.map((p) => p.label).join(" & ")}
      </p>
      {graph.note.summary ? <p className="mt-2">{graph.note.summary}</p> : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-danger-bg p-3 text-danger">
          {error}
        </p>
      ) : null}

      {pendingCorrections.length > 0 ? (
        <section className="mt-4 rounded-2xl border-2 border-amber-line bg-amber-bg p-4" aria-labelledby="corr-h">
          <h2 id="corr-h" className="font-bold text-amber">
            <span aria-hidden>✎</span> {pendingCorrections.length} suggested correction{pendingCorrections.length === 1 ? "" : "s"}
          </h2>
          <ul className="mt-2 flex flex-col gap-3">
            {pendingCorrections.map((c) => {
              const target = graph.commitments.find((x) => x.id === c.commitment_id);
              return (
                <li key={c.id} className="rounded-xl bg-white p-3">
                  <p className="text-sm text-ink-muted">
                    {c.submitted_by_label ? `${c.submitted_by_label} · ` : ""}
                    {target ? `on “${target.text}”` : "about the note"} · {c.field === "due_date" ? "date" : c.field === "owner" ? "owner" : "wording"}
                  </p>
                  <p className="mt-1 font-medium">{c.field === "due_date" && /^\d{4}-\d{2}-\d{2}$/.test(c.suggested_value) ? formatDueDate(c.suggested_value) : c.suggested_value}</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="btn-primary px-3 py-1" onClick={() => void apply({ corrections: [{ id: c.id, action: "accept" }] })}>
                      Accept
                    </button>
                    <button type="button" className="btn-secondary px-3 py-1" onClick={() => void apply({ corrections: [{ id: c.id, action: "reject" }] })}>
                      Reject
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="mt-5 grid grid-cols-3 gap-2.5">
        <button type="button" className="btn-primary px-2 text-sm" onClick={() => (shareUrl ? setPanel(panel === "share" ? null : "share") : void share())} disabled={shareBusy}>
          <span aria-hidden>↑</span> {shareBusy ? "…" : "Share"}
        </button>
        <button type="button" className="btn-secondary px-2 text-sm" onClick={() => void dispatch()} disabled={trelloBusy || !trelloReady} title={trelloReady ? "" : "Connect Trello first"}>
          {trelloBusy ? "Sending…" : "Trello"}
        </button>
        <button type="button" className="btn-secondary px-2 text-sm" onClick={() => setPanel(panel === "calendar" ? null : "calendar")}>
          <span aria-hidden>▦</span> Calendar
        </button>
      </div>
      {!trelloReady ? (
        <p className="mt-2 text-sm text-ink-muted">
          <Link href="/settings/trello" className="text-accent underline-offset-2 hover:underline">
            Connect Trello
          </Link>{" "}
          to send cards.
        </p>
      ) : null}
      {trelloSummary ? (
        <p role="status" className="mt-2 text-sm">
          {trelloSummary}
        </p>
      ) : null}

      {panel === "share" && shareUrl ? (
        <section className="card mt-3" aria-labelledby="share-h">
          <h2 id="share-h" className="label">
            Shared link
          </h2>
          <p className="mt-1 text-sm text-ink-muted">Anyone with this link can read the note and suggest corrections. No account needed. Expires in 90 days.</p>
          <p className="meta mt-2 break-all rounded-lg bg-paper-2 p-2 select-all">{shareUrl}</p>
          <button type="button" className="btn-secondary mt-2 w-full" onClick={copy}>
            {copied ? "Copied ✓" : "Copy link"}
          </button>
          <form onSubmit={sendEmail} className="mt-3 flex flex-col gap-2">
            <label htmlFor="email-to" className="label">
              Email it {graph.participants.find((p) => !p.is_creator) ? `to ${graph.participants.find((p) => !p.is_creator)?.label}` : ""}
            </label>
            <input id="email-to" type="email" required value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="them@example.com" className="tap rounded-lg border border-line px-3" />
            <button type="submit" className="btn-primary" disabled={emailState === "sending"}>
              {emailState === "sending" ? "Sending…" : "Send email"}
            </button>
            {emailState === "sent" || emailState === "error" ? (
              <p role="status" className={`text-sm ${emailState === "error" ? "text-danger" : "text-ok"}`}>
                {emailMsg}
              </p>
            ) : null}
          </form>
        </section>
      ) : null}

      {panel === "calendar" ? (
        <section className="card mt-3" aria-labelledby="cal-h">
          <h2 id="cal-h" className="label">
            Add to calendar
          </h2>
          <label htmlFor="reminder" className="label mt-3 block">
            Reminder
          </label>
          <select id="reminder" value={reminder} onChange={(e) => setReminder(Number(e.target.value))} className="tap mt-1 w-full rounded-lg border border-line bg-white px-3">
            {REMINDERS.map((r) => (
              <option key={r.minutes} value={r.minutes}>
                {r.label}
              </option>
            ))}
          </select>
          <div className="mt-3 flex flex-col gap-2">
            {creator ? (
              <a href={`/api/notes/${graph.note.id}/calendar.ics?participantId=${creator.id}&reminder=${reminder}`} className="btn-primary">
                My items (.ics)
              </a>
            ) : null}
            <a href={`/api/notes/${graph.note.id}/calendar.ics?reminder=${reminder}`} className="btn-secondary">
              All items (.ics)
            </a>
            <button type="button" className="btn-secondary" onClick={() => void getWebcal()}>
              Subscribe (webcal) — stays in sync
            </button>
            {webcal ? (
              <p className="break-all rounded-lg bg-paper-2 p-2 font-mono text-sm select-all">
                <a href={webcal} className="underline">
                  {webcal}
                </a>
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="mt-6" aria-labelledby="ledger-h">
        <h2 id="ledger-h" className="label">
          The ledger · {commitments.length}
        </h2>
        {commitments.length === 0 ? (
          <p className="mt-2 text-ink-muted">No commitments in this note.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {commitments.map((c) => (
              <CommitmentRow
                key={c.id}
                c={c}
                participants={graph.participants}
                editable
                showStatus
                onPatch={(p) => patchCommitment(c.id, p)}
                onJump={setHighlight}
                trelloState={trello[c.id]}
                onRetryTrello={() => void dispatch([c.id])}
                onAddParticipant={async (label) => {
                  await apply({ newParticipants: [{ label }] });
                }}
              />
            ))}
          </ul>
        )}
      </section>

      {decisions.length > 0 ? (
        <section className="mt-8" aria-labelledby="dec-h">
          <h2 id="dec-h" className="label">
            Decisions
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {decisions.map((c) => (
              <CommitmentRow key={c.id} c={c} participants={graph.participants} editable showStatus={false} onPatch={(p) => patchCommitment(c.id, p)} onJump={setHighlight} />
            ))}
          </ul>
        </section>
      ) : null}
      {questions.length > 0 ? (
        <section className="mt-8" aria-labelledby="oq-h">
          <h2 id="oq-h" className="label">
            Open questions
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {questions.map((c) => (
              <CommitmentRow key={c.id} c={c} participants={graph.participants} editable showStatus={false} onPatch={(p) => patchCommitment(c.id, p)} onJump={setHighlight} />
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-6 text-sm text-ink-muted">
        Owners: {graph.participants.map((p) => `${p.label}${p.is_creator ? " (me)" : ""}`).join(", ")}. {commitments.some((c) => !c.owner_participant_id) ? `Unassigned items are shown as “${labelOf(null)}”.` : ""}
      </p>

      <TranscriptAccordion segments={graph.segments} participants={graph.participants} editable={false} highlightSeq={highlight} />
    </main>
  );
}
