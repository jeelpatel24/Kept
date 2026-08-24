"use client";
// Home record button + consent modal (first use per browser session). Implements: PRD-F1, PRD-F3, TRD-3.1.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConsentModal } from "@/components/ConsentModal";

const CONSENT_KEY = "kept.consent.shown";

export function RecordButton() {
  const router = useRouter();
  const [showConsent, setShowConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      // Request the mic inside the user gesture so the permission prompt is allowed.
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("This browser can’t record audio. Try Chrome or Safari.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop()); // release; the recorder page reacquires (permission is now granted)

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not start a session");
      const { session } = (await res.json()) as { session: { id: string } };
      router.push(`/record/${session.id}?autostart=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start recording");
      setBusy(false);
    }
  }

  function onTap() {
    let shown = false;
    try {
      shown = sessionStorage.getItem(CONSENT_KEY) === "1";
    } catch {
      shown = false;
    }
    if (!shown) {
      setShowConsent(true);
      return;
    }
    void start();
  }

  function onConsentContinue() {
    try {
      sessionStorage.setItem(CONSENT_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowConsent(false);
    void start();
  }

  return (
    <>
      <button
        type="button"
        onClick={onTap}
        disabled={busy}
        aria-label="Start recording"
        className="flex h-44 w-44 items-center justify-center rounded-full bg-rec text-white shadow-lg transition-transform active:scale-95 disabled:opacity-60"
      >
        <span className="flex flex-col items-center">
          <span className="block h-12 w-12 rounded-full border-4 border-white" aria-hidden />
          <span className="mt-2 text-xl font-bold">{busy ? "Starting…" : "Record"}</span>
        </span>
      </button>
      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-danger-bg p-3 text-danger">
          {error}
        </p>
      ) : null}
      {showConsent ? <ConsentModal onContinue={onConsentContinue} onCancel={() => setShowConsent(false)} /> : null}
    </>
  );
}
