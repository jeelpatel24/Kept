"use client";
// S2 recorder: MediaRecorder, 30s chunked progressive upload, real level meter, 18-min warning, 20-min hard stop,
// persistent indicator + tab title. Implements: PRD-F1, PRD-F3, TRD-3.1, UX-BRIEF S2, §7 (SR announcements).
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const CHUNK_MS = 30_000;
const WARN_MS = 18 * 60_000;
const HARD_STOP_MS = 20 * 60_000;

type Phase = "idle" | "starting" | "recording" | "stopping" | "uploading" | "done" | "error";

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function announce(text: string) {
  const el = document.getElementById("live-region");
  if (el) el.textContent = text;
}

export function Recorder({ sessionId, initialStatus, autostart }: { sessionId: string; initialStatus: string; autostart: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(initialStatus === "recording" ? "idle" : "done");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ sent: number; total: number }>({ sent: 0, total: 0 });

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAt = useRef<number>(0);
  const chunkIndex = useRef(0);
  const uploads = useRef<Promise<void>[]>([]);
  const failedChunks = useRef<number[]>([]);
  const stoppingRef = useRef(false);

  const uploadChunk = useCallback(
    async (blob: Blob, index: number) => {
      const form = new FormData();
      form.append("index", String(index));
      form.append("chunk", blob, `chunk-${index}`);
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(`/api/sessions/${sessionId}/audio`, { method: "POST", body: form });
          if (res.ok) {
            setUploadProgress((p) => ({ ...p, sent: p.sent + 1 }));
            return;
          }
          lastErr = new Error(`upload ${res.status}`);
        } catch (e) {
          lastErr = e;
        }
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
      failedChunks.current.push(index);
      throw lastErr instanceof Error ? lastErr : new Error("upload failed");
    },
    [sessionId],
  );

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    void audioCtxRef.current?.close().catch(() => undefined);
    document.title = "Kept";
  }, []);

  const finish = useCallback(async () => {
    setPhase("uploading");
    const durationMs = Math.min(Date.now() - startedAt.current, HARD_STOP_MS);
    await Promise.allSettled(uploads.current);
    if (failedChunks.current.length > 0) {
      setPhase("error");
      setError(`Lost ${failedChunks.current.length} audio chunk(s) during upload (network). What was uploaded is kept — you can still transcribe it, but it may be incomplete.`);
    }
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "uploaded", durationMs, chunkCount: Math.max(1, chunkIndex.current - failedChunks.current.length) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Could not close session (${res.status})`);
      if (failedChunks.current.length === 0) {
        setPhase("done");
        announce("Recording stopped. Processing.");
        router.push(`/record/${sessionId}/processing`);
      }
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Could not finish the session");
    }
  }, [router, sessionId]);

  const stop = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    setPhase("stopping");
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = () => {
        cleanup();
        void finish();
      };
      rec.stop();
    } else {
      cleanup();
      void finish();
    }
  }, [cleanup, finish]);

  const start = useCallback(async () => {
    setPhase("starting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : { audioBitsPerSecond: 32_000 });
      recRef.current = rec;

      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          const idx = chunkIndex.current++;
          setUploadProgress((p) => ({ ...p, total: p.total + 1 }));
          uploads.current.push(uploadChunk(ev.data, idx).catch(() => undefined));
        }
      };
      rec.onerror = () => {
        setError("The recorder hit an error. Stopping and keeping what was captured.");
        stop();
      };

      // Level meter from real input (UX-BRIEF S2: not decorative)
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = ((buf[i] ?? 128) - 128) / 128;
          sum += v * v;
        }
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      startedAt.current = Date.now();
      rec.start(CHUNK_MS);
      setPhase("recording");
      document.title = "● Recording — Kept";
      announce("Recording started.");
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error && e.name === "NotAllowedError" ? "Microphone access was blocked. Allow the mic in your browser settings and try again." : e instanceof Error ? e.message : "Could not start recording");
    }
  }, [stop, uploadChunk]);

  // Timer, warning, hard stop
  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => {
      const e = Date.now() - startedAt.current;
      setElapsed(e);
      if (e >= HARD_STOP_MS) stop();
    }, 250);
    return () => clearInterval(t);
  }, [phase, stop]);

  useEffect(() => {
    if (phase === "recording" && elapsed >= WARN_MS && elapsed < WARN_MS + 400) announce("Two minutes left. Recording stops at twenty minutes.");
  }, [elapsed, phase]);

  const autostarted = useRef(false);
  useEffect(() => {
    if (autostart && phase === "idle" && !autostarted.current) {
      autostarted.current = true;
      void start();
    }
  }, [autostart, phase, start]);

  useEffect(() => () => cleanup(), [cleanup]);

  if (phase === "done") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5">
        <p className="text-ink-muted">This session is already finished.</p>
        <button type="button" className="btn-primary mt-4" onClick={() => router.push(`/record/${sessionId}/processing`)}>
          Continue
        </button>
      </main>
    );
  }

  const isRec = phase === "recording";
  const warning = isRec && elapsed >= WARN_MS;
  const progress = Math.min(1, elapsed / HARD_STOP_MS);
  const R = 88;
  const CIRC = 2 * Math.PI * R;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-5">
      <div role="status" aria-live="assertive" className="flex justify-center">
        {isRec ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-rec px-5 py-2.5 font-display text-sm font-extrabold tracking-[0.12em] text-white shadow-[0_3px_0_#92291d]">
            <span className="rec-dot inline-block h-2.5 w-2.5 rounded-full bg-white" aria-hidden />
            RECORDING
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 font-display text-sm font-extrabold tracking-[0.12em] text-ink-muted">
            {phase === "starting" ? "STARTING…" : phase === "stopping" || phase === "uploading" ? "SAVING…" : phase === "error" ? "STOPPED" : "READY"}
          </span>
        )}
      </div>

      {warning ? (
        <div role="alert" className="mt-4 rounded-[14px] border border-amber-line bg-amber-bg p-3 text-center font-semibold text-amber">
          <span aria-hidden>⚠</span> 2 minutes left — recording stops at 20:00
        </div>
      ) : null}

      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative" aria-hidden>
          <svg width="230" height="230" viewBox="0 0 230 230">
            <circle cx="115" cy="115" r={R} fill="#ffffff" stroke="var(--color-line)" strokeWidth="10" />
            <circle
              cx="115"
              cy="115"
              r={R}
              fill="none"
              stroke={isRec ? "var(--color-rec)" : "var(--color-line)"}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
              transform="rotate(-90 115 115)"
              style={{ transition: "stroke-dashoffset 0.25s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-mono text-5xl font-semibold tabular-nums" aria-hidden>
              {fmt(elapsed)}
            </p>
            <p className="meta mt-1">of 20:00 max</p>
          </div>
        </div>
        <p className="sr-only" aria-live="off">{`Elapsed ${fmt(elapsed)} of 20 minutes`}</p>

        <div className="mt-8 h-2.5 w-full max-w-xs overflow-hidden rounded-full bg-paper-2 ring-1 ring-line" aria-hidden>
          <div className="h-full rounded-full bg-accent transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
        </div>
        <p className="meta mt-2">{isRec ? "level — live from your mic" : "\u00a0"}</p>

        {phase === "uploading" ? (
          <p className="meta mt-3">
            uploading {uploadProgress.sent}/{uploadProgress.total} chunks…
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-5 rounded-[14px] bg-danger-bg p-3 text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <div className="pb-2">
        {isRec ? (
          <button
            type="button"
            onClick={stop}
            className="tap w-full rounded-[16px] border border-danger-edge bg-white py-5 font-display text-2xl font-extrabold tracking-wide text-danger shadow-[0_5px_0_var(--color-danger-edge),0_8px_14px_rgba(27,36,48,0.12)] transition-all duration-75 active:translate-y-[5px] active:shadow-none"
          >
            ■ STOP
          </button>
        ) : phase === "idle" || phase === "error" ? (
          <div className="flex flex-col gap-2">
            {phase === "error" && chunkIndex.current > 0 ? (
              <button type="button" onClick={() => router.push(`/record/${sessionId}/processing`)} className="btn-primary w-full text-lg">
                Continue with what was captured
              </button>
            ) : null}
            {chunkIndex.current === 0 ? (
              <button type="button" onClick={() => void start()} className="btn-primary w-full text-lg">
                Start recording
              </button>
            ) : null}
            <button type="button" onClick={() => router.push("/")} className="btn-quiet w-full">
              Back
            </button>
          </div>
        ) : (
          <button type="button" disabled className="btn-secondary w-full text-lg">
            {phase === "starting" ? "Starting…" : "Saving…"}
          </button>
        )}
      </div>
    </main>
  );
}
