// Groq provider: Whisper large-v3 transcription (primary) and JSON-mode chat (extraction fallback).
// Implements: TRD-3.2, TRD-3.4
import "server-only";
import { env } from "@/lib/env";
import { ExternalCallError, fetchWithTimeout } from "@/lib/http";
import type { Provider, TranscribeResult, TranscriptSegment } from "@/lib/llm/types";

const GROQ_BASE = "https://api.groq.com/openai/v1";

interface WhisperVerboseSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}
interface WhisperVerboseResponse {
  text: string;
  duration?: number;
  segments?: WhisperVerboseSegment[];
}

function normaliseWhisper(json: WhisperVerboseResponse): TranscribeResult {
  const segs: TranscriptSegment[] = (json.segments ?? [])
    .map((s, i) => ({
      index: i,
      startMs: Math.round(s.start * 1000),
      endMs: Math.round(s.end * 1000),
      text: s.text.trim(),
    }))
    .filter((s) => s.text.length > 0);
  if (segs.length === 0 && json.text?.trim()) {
    segs.push({ index: 0, startMs: 0, endMs: Math.round((json.duration ?? 0) * 1000), text: json.text.trim() });
  }
  return { segments: segs, durationMs: json.duration ? Math.round(json.duration * 1000) : null };
}

export const groqProvider: Provider = {
  name: "groq",

  async transcribe(p) {
    if (!env.GROQ_API_KEY) throw new ExternalCallError("auth", "GROQ_API_KEY not set", undefined, "groq");
    const model = env.GROQ_TRANSCRIBE_MODEL;
    const form = new FormData();
    const ext = p.mimeType.includes("ogg") ? "ogg" : p.mimeType.includes("mp4") ? "m4a" : p.mimeType.includes("wav") ? "wav" : "webm";
    form.append("file", new Blob([p.audio as BlobPart], { type: p.mimeType }), `audio.${ext}`);
    form.append("model", model);
    form.append("response_format", "verbose_json");
    form.append("language", "en");
    form.append("temperature", "0");

    const t0 = Date.now();
    const res = await fetchWithTimeout(`${GROQ_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: form,
      timeoutMs: 120_000,
      retries: 1,
      provider: "groq",
    });
    if (!res.ok) throw new ExternalCallError("http", `groq transcription ${res.status}: ${await res.text()}`, res.status, "groq");
    const json = (await res.json()) as WhisperVerboseResponse;
    return {
      result: normaliseWhisper(json),
      meta: { provider: "groq", model, inputTokens: null, outputTokens: null, latencyMs: Date.now() - t0 },
    };
  },

  async extract(p) {
    if (!env.GROQ_API_KEY) throw new ExternalCallError("auth", "GROQ_API_KEY not set", undefined, "groq");
    const model = env.GROQ_EXTRACT_MODEL;
    const t0 = Date.now();
    const res = await fetchWithTimeout(`${GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: p.system },
          { role: "user", content: p.user },
        ],
      }),
      timeoutMs: 60_000,
      retries: 2,
      provider: "groq",
    });
    if (!res.ok) throw new ExternalCallError("http", `groq chat ${res.status}: ${await res.text()}`, res.status, "groq");
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const raw = json.choices?.[0]?.message?.content;
    if (typeof raw !== "string") throw new ExternalCallError("malformed", "groq returned no content", undefined, "groq");
    return {
      result: { raw },
      meta: {
        provider: "groq",
        model,
        inputTokens: json.usage?.prompt_tokens ?? null,
        outputTokens: json.usage?.completion_tokens ?? null,
        latencyMs: Date.now() - t0,
      },
    };
  },
};
