"use client";
// Owner chip: shows inferred label; amber "Who?" when unknown (UX-BRIEF §6). Implements: PRD-F5.
import { useState } from "react";
import type { Participant } from "@/components/note/types";

export function OwnerChip({
  ownerId,
  participants,
  editable,
  onChange,
  onAddParticipant,
}: {
  ownerId: string | null;
  participants: Participant[];
  editable: boolean;
  onChange: (id: string | null) => void;
  onAddParticipant?: (label: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const owner = participants.find((p) => p.id === ownerId) ?? null;
  const unknown = !owner;

  const chip = (
    <span className={`chip ${unknown ? "chip-amber" : "chip-normal"}`}>
      {unknown ? (
        <>
          <span aria-hidden className="font-bold">!</span> Who?{editable ? " — confirm" : ""}
        </>
      ) : (
        <>
          <span aria-hidden className="avatar-dot">{owner.label.charAt(0).toUpperCase()}</span> {owner.label}
        </>
      )}
    </span>
  );

  if (!editable) return chip;

  return (
    <span className="relative inline-block">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open} aria-label={unknown ? "Owner unknown — choose who owes this" : `Owner: ${owner?.label}. Change`} className="rounded-full">
        {chip}
      </button>
      {open ? (
        <div role="listbox" aria-label="Choose owner" className="absolute left-0 z-20 mt-2 w-56 rounded-xl border border-line bg-white p-2 shadow-lg">
          {participants.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={p.id === ownerId}
              className={`tap w-full rounded-lg px-3 text-left hover:bg-paper-2 ${p.id === ownerId ? "font-semibold" : ""}`}
              onClick={() => {
                onChange(p.id);
                setOpen(false);
              }}
            >
              {p.label}
              {p.is_creator ? <span className="ml-1 text-ink-muted">(me)</span> : null}
            </button>
          ))}
          <button
            type="button"
            role="option"
            aria-selected={ownerId === null}
            className="tap w-full rounded-lg px-3 text-left text-ink-muted hover:bg-paper-2"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            Not sure
          </button>
          {onAddParticipant ? (
            adding ? (
              <form
                className="mt-1 flex gap-1"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newLabel.trim()) return;
                  await onAddParticipant(newLabel.trim());
                  setNewLabel("");
                  setAdding(false);
                  setOpen(false);
                }}
              >
                <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Name" aria-label="New person name" className="tap min-w-0 flex-1 rounded-lg border border-line px-2" />
                <button type="submit" className="btn-primary px-3">
                  Add
                </button>
              </form>
            ) : (
              <button type="button" className="tap w-full rounded-lg px-3 text-left text-accent hover:bg-paper-2" onClick={() => setAdding(true)}>
                + Add person
              </button>
            )
          ) : null}
        </div>
      ) : null}
    </span>
  );
}
