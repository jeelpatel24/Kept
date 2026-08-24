"use client";
// One ledger row: text · owner chip · due chip · verbatim quote (tap → jump to transcript). Implements: UX-BRIEF S4/S5, PRD-F4, F9, F11, F14.
import { useState } from "react";
import { DueChip } from "@/components/note/DueChip";
import { OwnerChip } from "@/components/note/OwnerChip";
import type { Commitment, Participant } from "@/components/note/types";

export function CommitmentRow({
  c,
  participants,
  editable,
  showStatus,
  onPatch,
  onJump,
  onAddParticipant,
  trelloState,
  onRetryTrello,
}: {
  c: Commitment;
  participants: Participant[];
  editable: boolean;
  showStatus: boolean;
  onPatch: (patch: { text?: string; ownerParticipantId?: string | null; dueDate?: string | null; dueConfirmed?: boolean; status?: "open" | "done"; deleted?: boolean }) => void;
  onJump: (seq: number) => void;
  onAddParticipant?: (label: string) => Promise<void>;
  trelloState?: { status: "idle" | "sending" | "ok" | "error"; message?: string };
  onRetryTrello?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.text);
  const isCommitment = c.kind === "commitment";

  return (
    <li className="card">
      <div className="flex items-start gap-3">
        {showStatus && isCommitment ? (
          <input
            type="checkbox"
            aria-label={`Mark "${c.text}" ${c.status === "done" ? "open" : "done"}`}
            checked={c.status === "done"}
            onChange={(e) => onPatch({ status: e.target.checked ? "done" : "open" })}
            className="mt-1 h-6 w-6 shrink-0 accent-accent"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim() && draft.trim() !== c.text) onPatch({ text: draft.trim() });
                setEditing(false);
              }}
            >
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} aria-label="Edit text" className="w-full rounded-lg border border-line p-2" />
              <div className="mt-1 flex gap-2">
                <button type="submit" className="btn-primary px-3 py-1">
                  Save
                </button>
                <button type="button" className="btn-secondary px-3 py-1" onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-danger ml-auto px-3 py-1" onClick={() => onPatch({ deleted: true })}>
                  Remove
                </button>
              </div>
            </form>
          ) : (
            <p className={`text-lg font-medium ${c.status === "done" ? "text-ink-muted line-through" : ""}`}>
              {editable ? (
                <button type="button" className="text-left" onClick={() => setEditing(true)} aria-label={`Edit: ${c.text}`}>
                  {c.text}
                </button>
              ) : (
                c.text
              )}
            </p>
          )}

          {isCommitment ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <OwnerChip ownerId={c.owner_participant_id} participants={participants} editable={editable} onChange={(id) => onPatch({ ownerParticipantId: id })} onAddParticipant={onAddParticipant} />
              <DueChip dueDate={c.due_date} confidence={c.due_confidence} confirmed={c.due_confirmed} editable={editable} onSetDate={(d) => onPatch({ dueDate: d })} onConfirm={() => onPatch({ dueConfirmed: true })} />
            </div>
          ) : null}

          <button type="button" onClick={() => onJump(c.source_segment_ids[0] ?? 0)} className="mt-2 block text-left text-sm text-ink-muted underline-offset-2 hover:underline" aria-label="Show this in the transcript">
            “{c.source_quote}”
          </button>

          {trelloState && trelloState.status !== "idle" ? (
            <p className={`mt-2 text-sm ${trelloState.status === "error" ? "text-danger" : trelloState.status === "ok" ? "text-ok" : "text-ink-muted"}`}>
              {trelloState.status === "sending" ? "Sending to Trello…" : trelloState.status === "ok" ? "Card created" : `Trello failed: ${trelloState.message ?? "unknown"}`}
              {trelloState.status === "error" && onRetryTrello ? (
                <button type="button" className="ml-2 underline" onClick={onRetryTrello}>
                  Retry
                </button>
              ) : null}
            </p>
          ) : c.trello_card_url ? (
            <a href={c.trello_card_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-accent underline-offset-2 hover:underline">
              Trello card ↗
            </a>
          ) : null}
        </div>
      </div>
    </li>
  );
}
