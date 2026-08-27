"use client";
// S3 client: drives transcribe → extract, polls status, shows transcript as it lands.
// Implements: PRD-F2, PRD-F4, PRD-F15, TRD-3.2 (retry), UX-BRIEF S3 + §6 (rate-limited copy).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Segment = { seq: number; start_ms: number; end_ms: number; text: string; speaker_label: string | null };
type Status = {
  session: { id: string; status: string; error_detail: string | null };
  segments: Segment[];
  note: { id: string; status: string } | null;
};

type Stage = "loading" | "transcribing" | "extracting" | "done" | "transcription_failed" | "extraction_failed";

export function Processing({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("loading");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [message, setMessage] = useState<string>("");
  const [detail, setDetail] = useState<string | null>(null);
  const running = useRef(false);

  const fetchStatus = useCallback(async (): Promise<Status | null> => {
    const res = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Status;
  }, [sessionId]);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setDetail(null);
    try {
      let status = await fetchStatus();
      if (!status) throw new Error("Could not load session");

      if (status.note) {
        setStage("done");
        router.replace(status.note.status === "draft" ? `/notes/${status.note.id}/review` : `/notes/${status.note.id}`);
        return;
      }

      if (status.session.status !== "transcribed") {
        setStage("transcribing");
        setMessage("Transcribing…");
        const res = await fetch(`/api/sessions/${sessionId}/transcribe`, { method: "POST" });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !body.ok) {
          const err = body.error ?? `Transcription failed (${res.status})`;
          setStage("transcription_failed");
          setDetail(err);
          setMessage(/rate_limited/.test(err) ? "Busy — the transcription providers are rate-limited. Try again in a moment." : "Transcription failed.");
          return;
        }
        status = await fetchStatus();
        if (status) setSegments(status.segments);
      } else {
        setSegments(status.segments);
      }

      setStage("extracting");
      setMessage("Finding commitments…");
      const ex = await fetch(`/api/sessions/${sessionId}/extract`, { method: "POST" });
      const exBody = (await ex.json().catch(() => ({}))) as { ok?: boolean; noteId?: string; error?: string; kind?: string };
      if (!ex.ok || !exBody.ok || !exBody.noteId) {
        setStage("extraction_failed");
        setDetail(exBody.error ?? `Extraction failed (${ex.status})`);
        setMessage(exBody.kind === "rate_limited" ? "Busy, retrying with backup didn’t help. The transcript is safe below." : "Couldn’t extract commitments. The transcript is safe below.");
        return;
      }
      setStage("done");
      router.replace(`/notes/${exBody.noteId}/review`);
    } catch (e) {
      setStage("transcription_failed");
      setDetail(e instanceof Error ? e.message : "Unknown error");
      setMessage("Something went wrong.");
    } finally {
      running.current = false;
    }
  }, [fetchStatus, router, sessionId]);

  useEffect(() => {
    void run();
  }, [run]);

  const failed = stage === "transcription_failed" || stage === "extraction_failed";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
      <h1 className="text-3xl font-extrabold">Working through it</h1>
      <p className="mt-1 text-ink-muted">About 30 seconds for a two-minute conversation.</p>
      <ol className="card mt-4 flex flex-col gap-3" aria-label="Progress">
        <StepRow label="Audio uploaded" state="done" />
        <StepRow label="Transcribed" state={stage === "transcribing" ? "active" : stage === "transcription_failed" ? "failed" : stage === "loading" ? "pending" : "done"} />
        <StepRow label="Finding commitments & dates" state={stage === "extracting" ? "active" : stage === "extraction_failed" ? "failed" : stage === "done" ? "done" : "pending"} />
      </ol>
      <p role="status" aria-live="polite" className={`mt-4 ${failed ? "rounded-xl bg-danger-bg p-3 text-danger" : "text-ink-muted"}`}>
        {message}
      </p>
      {detail && failed ? <p className="mt-2 break-words text-sm text-ink-muted">{detail}</p> : null}

      {failed ? (
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" className="btn-primary" onClick={() => void run()}>
            Retry
          </button>
          <Link href="/" className="btn-secondary">
            Back home
          </Link>
        </div>
      ) : null}

      {segments.length > 0 ? (
        <section className="mt-8" aria-labelledby="transcript-h">
          <h2 id="transcript-h" className="label">
            Transcript so far
          </h2>
          <ol className="mt-2 flex flex-col gap-2">
            {segments.map((s) => (
              <li key={s.seq} className="card !p-3 text-ink">
                <span className="meta mr-2">{fmtMs(s.start_ms)}</span>
                {s.text}
              </li>
            ))}
          </ol>
        </section>
      ) : stage === "extraction_failed" || stage === "transcription_failed" ? (
        <p className="mt-6 text-ink-muted">No transcript yet.</p>
      ) : null}
    </main>
  );
}

function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function StepRow({ label, state }: { label: string; state: "pending" | "active" | "done" | "failed" }) {
  return (
    <li className={`flex items-center gap-3 font-medium ${state === "pending" ? "text-ink-muted" : state === "failed" ? "text-danger" : "text-ink"}`}>
      {state === "done" ? (
        <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-ok text-sm font-bold text-white">✓</span>
      ) : state === "failed" ? (
        <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-danger text-sm font-bold text-white">✕</span>
      ) : state === "active" ? (
        <span aria-hidden className="spinner h-7 w-7 rounded-full border-[3px] border-accent border-t-transparent" />
      ) : (
        <span aria-hidden className="h-7 w-7 rounded-full border-2 border-line" />
      )}
      <span className="sr-only">{state}:</span>
      {label}
    </li>
  );
}
