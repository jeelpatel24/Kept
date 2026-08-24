"use client";
// Consent prompt before first record. Implements: PRD-F3, TRD-3.1, UX-BRIEF S2 ("a prompt, explicitly not legal advice").
import { useEffect, useRef } from "react";

export function ConsentModal({ onContinue, onCancel }: { onContinue: () => void; onCancel: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="consent-title" className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="consent-title" className="text-xl font-bold">
          Before you record
        </h2>
        <p className="mt-2 text-ink-muted">Let the other person know. A line you can say out loud:</p>
        <blockquote className="mt-3 rounded-xl bg-paper-2 p-4 text-lg font-medium">
          “I’m going to record this so we both get the same notes — okay with you?”
        </blockquote>
        <p className="mt-3 text-sm text-ink-muted">
          This is a suggested prompt, not legal advice. Recording rules differ by place; it’s your call. The other person will be able to see the note.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button ref={first} type="button" className="btn-primary text-lg" onClick={onContinue}>
            They’re okay with it — record
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
