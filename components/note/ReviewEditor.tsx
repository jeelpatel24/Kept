"use client";
// S4 editor: commitments (hero) → decisions → open questions → transcript accordion. Confirm gated (server re-checks).
// Implements: PRD-F4, F5, F6, F7, F15 · TRD-3.5 · UX-BRIEF S4, §6 states.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CommitmentRow } from "@/components/note/CommitmentRow";
import { TranscriptAccordion } from "@/components/note/TranscriptAccordion";
import { patchNote, type CommitmentPatch, type Graph, type NotePatch } from "@/components/note/types";
import { formatRecordedAt } from "@/lib/format";

export function ReviewEditor({ initial }: { initial: Graph }) {
  const router = useRouter();
  const [graph, setGraph] = useState<Graph>(initial);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);

  const apply = useCallback(
    async (patch: NotePatch) => {
      setSaving(true);
      setError(null);
      const r = await patchNote(graph.note.id, patch);
      setSaving(false);
      if (r.graph) setGraph(r.graph);
      if (r.error) setError(r.error);
      return r;
    },
    [graph.note.id],
  );

  const patchCommitment = (id: string, p: Omit<CommitmentPatch, "id">) => {
    // Optimistic local update for snappy chips; server response replaces state.
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
                ...(p.dueConfirmed !== undefined ? { due_confirmed: p.dueConfirmed } : {}),
                ...(p.status !== undefined ? { status: p.status } : {}),
              }
            : c,
        )
        .filter((c) => !(p.deleted && c.id === id)),
    }));
    void apply({ commitments: [{ id, ...p }] });
  };

  const addParticipant = async (label: string) => {
    await apply({ newParticipants: [{ label }] });
  };

  const commitments = graph.commitments.filter((c) => c.kind === "commitment");
  const decisions = graph.commitments.filter((c) => c.kind === "decision");
  const questions = graph.commitments.filter((c) => c.kind === "open_question");
  const pendingLow = commitments.filter((c) => c.due_confidence === "low" && !c.due_confirmed).length;
  const unknownOwners = commitments.filter((c) => !c.owner_participant_id).length;
  const canConfirm = pendingLow === 0 && !saving;

  async function confirm() {
    setConfirming(true);
    const r = await apply({ confirm: true });
    setConfirming(false);
    if (r.status === 409) {
      setError(r.error);
      return;
    }
    if (r.graph?.note.status === "confirmed") router.push(`/notes/${graph.note.id}`);
  }

  return (
    <main className="mx-auto max-w-md px-5 pb-32 pt-6">
      <Link href="/" className="text-ink-muted underline-offset-4 hover:underline">
        ← Home
      </Link>
      <header className="mt-2">
        {titleEditing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = (new FormData(e.currentTarget).get("title") as string).trim();
              if (v) void apply({ title: v });
              setTitleEditing(false);
            }}
          >
            <input name="title" defaultValue={graph.note.title} aria-label="Note title" className="tap w-full rounded-lg border border-line px-3 text-2xl font-bold" autoFocus />
          </form>
        ) : (
          <button type="button" className="text-left text-2xl font-bold" onClick={() => setTitleEditing(true)} aria-label={`Edit title: ${graph.note.title}`}>
            {graph.note.title}
          </button>
        )}
        <p className="mt-1 text-ink-muted">
          {formatRecordedAt(graph.session.recorded_at, graph.session.timezone)} · {graph.participants.map((p) => p.label).join(" & ")}
        </p>
      </header>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-danger-bg p-3 text-danger">
          {error}
        </p>
      ) : null}

      {pendingLow + unknownOwners > 0 ? (
        <section className="mt-4 rounded-[16px] border border-amber-line bg-amber-bg p-4" aria-label="Needs your attention">
          <p className="font-display font-bold text-amber">
            <span aria-hidden>⚠</span> {pendingLow + unknownOwners} thing{pendingLow + unknownOwners === 1 ? "" : "s"} need{pendingLow + unknownOwners === 1 ? "s" : ""} you
          </p>
          <p className="mt-1 text-sm text-amber">
            Kept wasn’t sure about {[pendingLow > 0 ? `${pendingLow} date${pendingLow === 1 ? "" : "s"}` : null, unknownOwners > 0 ? `${unknownOwners} owner${unknownOwners === 1 ? "" : "s"}` : null].filter(Boolean).join(" and ")}. Tap the amber chips to set them. Nothing is shared or sent until you confirm.
          </p>
        </section>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">Review before anything is shared or sent. Nothing leaves this screen until you confirm.</p>
      )}

      <section className="mt-6" aria-labelledby="commitments-h">
        <h2 id="commitments-h" className="label">
          Commitments{commitments.length > 0 ? ` · ${commitments.length}` : ""}
        </h2>
        {commitments.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-line p-4 text-ink-muted">No commitments found. Here’s the transcript below — if we missed one, it wasn’t clear enough in the words to extract safely.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {commitments.map((c) => (
              <CommitmentRow key={c.id} c={c} participants={graph.participants} editable showStatus={false} onPatch={(p) => patchCommitment(c.id, p)} onJump={setHighlight} onAddParticipant={addParticipant} />
            ))}
          </ul>
        )}

      </section>

      <Section title="Decisions" items={decisions} graph={graph} onPatch={patchCommitment} onJump={setHighlight} empty="No decisions extracted." />
      <Section title="Open questions" items={questions} graph={graph} onPatch={patchCommitment} onJump={setHighlight} empty="No open questions." />

      <TranscriptAccordion
        segments={graph.segments}
        participants={graph.participants}
        editable
        highlightSeq={highlight}
        defaultOpen={graph.commitments.length === 0}
        onSpeakerChange={(seq, label) => {
          setGraph((g) => ({ ...g, segments: g.segments.map((s) => (s.seq === seq ? { ...s, speaker_label: label, speaker_confirmed: true } : s)) }));
          void apply({ segments: [{ seq, speakerLabel: label }] });
        }}
      />

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 p-4 pb-5 backdrop-blur">
        <div className="mx-auto max-w-md">
          {pendingLow > 0 ? (
            <p className="mb-2 text-center text-sm text-amber" role="status">
              <span aria-hidden>⚠</span> {pendingLow} date{pendingLow === 1 ? " needs" : "s need"} your confirmation
            </p>
          ) : null}
          <button type="button" className="btn-primary w-full text-lg" disabled={!canConfirm || confirming} onClick={confirm} aria-describedby={pendingLow > 0 ? "confirm-reason" : undefined}>
            {confirming ? "Confirming…" : "Confirm note"}
          </button>
          {pendingLow > 0 ? (
            <p id="confirm-reason" className="sr-only">
              Disabled until {pendingLow} low-confidence dates are confirmed.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  items,
  graph,
  onPatch,
  onJump,
  empty,
}: {
  title: string;
  items: Graph["commitments"];
  graph: Graph;
  onPatch: (id: string, p: Omit<CommitmentPatch, "id">) => void;
  onJump: (seq: number) => void;
  empty: string;
}) {
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="label">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-ink-muted">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {items.map((c) => (
            <CommitmentRow key={c.id} c={c} participants={graph.participants} editable showStatus={false} onPatch={(p) => onPatch(c.id, p)} onJump={onJump} />
          ))}
        </ul>
      )}
    </section>
  );
}
