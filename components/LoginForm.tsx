"use client";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createSupabaseBrowserClient();
    const redirect = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
    if (error) {
      setState("error");
      setMessage(error.message);
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <p className="mt-8 rounded-xl bg-ok-bg p-4 text-ok" role="status">
        Check <strong>{email}</strong> for a sign-in link. Open it on this phone.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
      <label htmlFor="email" className="font-medium">
        Email
      </label>
      <input
        id="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="tap rounded-xl border-2 border-line bg-white px-4 text-lg"
        placeholder="you@company.com"
      />
      <button type="submit" className="btn-primary text-lg" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {state === "error" ? (
        <p role="alert" className="text-danger">
          {message}
        </p>
      ) : null}
    </form>
  );
}
