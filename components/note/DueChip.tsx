"use client";
// Due date chip: normal (high), amber "confirm?" (low, untouched), "add date" (null). Never colour alone (UX-BRIEF §7).
// Implements: PRD-F6, PRD-F7, UX-BRIEF S4 + §6.
import { useRef, useState } from "react";
import { formatDueDate } from "@/lib/format";

export function DueChip({
  dueDate,
  confidence,
  confirmed,
  editable,
  onSetDate,
  onConfirm,
}: {
  dueDate: string | null;
  confidence: "high" | "low" | null;
  confirmed: boolean;
  editable: boolean;
  onSetDate: (iso: string | null) => void;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const needsConfirm = dueDate !== null && confidence === "low" && !confirmed;

  const chip =
    dueDate === null ? (
      <span className="chip border-dashed bg-white text-ink-muted">
        <span aria-hidden>＋</span> {editable ? "Add date" : "No date"}
      </span>
    ) : needsConfirm ? (
      <span className="chip chip-amber">
        <span aria-hidden className="font-bold">!</span> {formatDueDate(dueDate)} — confirm?
      </span>
    ) : (
      <span className="chip chip-date">{formatDueDate(dueDate)}</span>
    );

  if (!editable) return chip;

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={dueDate === null ? "No due date — add one" : needsConfirm ? `Due ${formatDueDate(dueDate)}, low confidence — confirm or change` : `Due ${formatDueDate(dueDate)}. Change`}
        className="rounded-full"
      >
        {chip}
      </button>
      {open ? (
        <div className="absolute left-0 z-20 mt-2 w-64 rounded-xl border border-line bg-white p-3 shadow-lg">
          {needsConfirm ? (
            <p className="mb-2 text-sm text-amber">
              <span aria-hidden>⚠</span> We weren’t sure about this date. Is {formatDueDate(dueDate)} right?
            </p>
          ) : null}
          {needsConfirm ? (
            <button
              type="button"
              className="btn-primary mb-2 w-full"
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
            >
              Yes, that’s right
            </button>
          ) : null}
          <label className="block text-sm text-ink-muted" htmlFor="due-input">
            {needsConfirm ? "Or pick another date" : "Due date"}
          </label>
          <input
            id="due-input"
            ref={inputRef}
            type="date"
            defaultValue={dueDate ?? ""}
            className="tap mt-1 w-full rounded-lg border border-line px-2"
            onChange={(e) => {
              if (e.target.value) {
                onSetDate(e.target.value);
                setOpen(false);
              }
            }}
          />
          {dueDate !== null ? (
            <button
              type="button"
              className="tap mt-2 w-full rounded-lg px-3 text-left text-ink-muted hover:bg-paper-2"
              onClick={() => {
                onSetDate(null);
                setOpen(false);
              }}
            >
              No date
            </button>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}
