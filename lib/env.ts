// Server-side env access. Never import this from a client component.
// Implements: TRD §7, TRD-4.3 (no secret reaches the client bundle).
import "server-only";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function opt(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  get SUPABASE_URL() {
    return process.env.SUPABASE_URL ?? req("NEXT_PUBLIC_SUPABASE_URL");
  },
  get SUPABASE_ANON_KEY() {
    return process.env.SUPABASE_ANON_KEY ?? req("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get SUPABASE_SERVICE_KEY() {
    return req("SUPABASE_SERVICE_KEY");
  },
  get GROQ_API_KEY() {
    return opt("GROQ_API_KEY");
  },
  get OPENROUTER_API_KEY() {
    return opt("OPENROUTER_API_KEY");
  },
  get LLM_CHAIN_TRANSCRIBE() {
    return opt("LLM_CHAIN_TRANSCRIBE", "groq,openrouter");
  },
  get LLM_CHAIN_EXTRACT() {
    return opt("LLM_CHAIN_EXTRACT", "openrouter,groq");
  },
  get GROQ_TRANSCRIBE_MODEL() {
    return opt("GROQ_TRANSCRIBE_MODEL", "whisper-large-v3");
  },
  get GROQ_EXTRACT_MODEL() {
    return opt("GROQ_EXTRACT_MODEL", "llama-3.3-70b-versatile");
  },
  get OPENROUTER_EXTRACT_MODEL() {
    return opt("OPENROUTER_EXTRACT_MODEL", "google/gemini-2.5-flash");
  },
  get OPENROUTER_TRANSCRIBE_MODEL() {
    return opt("OPENROUTER_TRANSCRIBE_MODEL", "google/gemini-2.5-flash");
  },
  get TRELLO_API_KEY() {
    return req("TRELLO_API_KEY");
  },
  get ENCRYPTION_KEY() {
    return req("ENCRYPTION_KEY");
  },
  get SHARE_TOKEN_SECRET() {
    return req("SHARE_TOKEN_SECRET");
  },
  get RESEND_API_KEY() {
    return opt("RESEND_API_KEY");
  },
  get EMAIL_FROM() {
    return opt("EMAIL_FROM", "Kept <onboarding@resend.dev>");
  },
  get APP_URL() {
    return opt("APP_URL", "http://localhost:3000").replace(/\/$/, "");
  },
  get IS_DEV() {
    return process.env.NODE_ENV !== "production";
  },
};
