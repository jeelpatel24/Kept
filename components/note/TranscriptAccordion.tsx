"use client";
// Transcript accordion — always available (PRD-F15). Speaker labels editable in review (PRD-F5). Jump-to-source target.
import { useEffect, useState } from "react";
import type { Participant, Segment } from "@/components/note/types";
import { fmtMs } from "@/lib/format";

export function segmentDomId(seq: number) {
  return `seg-${seq}`;
}

export function TranscriptAccordion({
  segments,
  participants,
  editable,
  highlightSeq,
  defaultOpen = false,
  onSpeakerChange,
}: {
  segments: Segment[];
  participants: Participant[];
  editable: boolean;
  highlightSeq: number | null;
  defaultOpen?: boolean;
  onSpeakerChange?: (seq: number, label: string | null) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (highlightSeq === null) return;
    setOpen(true);
    const t = setTimeout(() => {
      document.getElementById(segmentDomId(highlightSeq))?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return () => clearTimeout(t);
  }, [highlightSeq]);

  return (
    <section className="mt-8" aria-labelledby="transcript-h">
      <button type="button" className="tap flex w-full items-center justify-between rounded-xl border border-line bg-white px-4 text-left" aria-expanded={open} aria-controls="transcript-body" onClick={() => setOpen((v) => !v)}>
        <span id="transcript-h" className="text-lg font-semibold">
          Transcript
        </span>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <ol id="transcript-body" className="mt-2 flex flex-col gap-3">
          {segments.length === 0 ? <li className="text-ink-muted">No transcript was produced.</li> : null}
          {segments.map((s) => {
            const hl = s.seq === highlightSeq;
            return (
              <li key={s.seq} id={segmentDomId(s.seq)} className={`rounded-xl p-3 ${hl ? "bg-amber-bg ring-2 ring-amber-line" : "bg-white"}`}>
                <div className="mb-1 flex items-center gap-2 text-sm text-ink-muted">
                  <span className="font-mono">{fmtMs(s.start_ms)}</span>
                  {editable && onSpeakerChange ? (
                    <select
                      aria-label={`Speaker for segment at ${fmtMs(s.start_ms)}`}
                      value={s.speaker_label ?? ""}
                      onChange={(e) => onSpeakerChange(s.seq, e.target.value || null)}
                      className="tap rounded-lg border border-line bg-white px-2 py-1 text-ink"
                    >
                      <option value="">Unknown speaker</option>
                      {participants.map((p) => (
                        <option key={p.id} value={p.label}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-medium text-ink">{s.speaker_label ?? "—"}</span>
                  )}
                </div>
                <p className="select-text">{s.text}</p>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
