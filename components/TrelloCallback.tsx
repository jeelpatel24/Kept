"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function TrelloCallback() {
  const router = useRouter();
  const [msg, setMsg] = useState("Connecting to Trello…");

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const token = params.get("token");
    // Clear the fragment immediately so the token doesn't linger in history.
    history.replaceState(null, "", window.location.pathname);
    if (!token) {
      setMsg(params.get("error") ? "Trello access was declined." : "No token was returned by Trello.");
      return;
    }
    void (async () => {
      const res = await fetch("/api/trello/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      if (!res.ok) {
        setMsg((await res.json().catch(() => ({}))).error ?? "Could not save the Trello connection.");
        return;
      }
      router.replace("/settings/trello?connected=1");
    })();
  }, [router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <p role="status">{msg}</p>
      <a href="/settings/trello" className="btn-secondary mt-4">
        Back to Trello settings
      </a>
    </main>
  );
}
