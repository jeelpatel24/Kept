// OpenRouter provider: Gemini Flash for extraction (primary) and native-audio transcription (fallback).
// Implements: TRD-3.2 (fallback), TRD-3.3, TRD-3.4
import "server-only";
import { env } from "@/lib/env";
import { ExternalCallError, fetchWithTimeout } from "@/lib/http";
import type { Provider, TranscribeResult } from "@/lib/llm/types";
import { TRANSCRIBE_FALLBACK_PROMPT } from "@/lib/prompts/transcribe.v1";

const OR_BASE = "https://openrouter.ai/api/v1";

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

async function chat(body: Record<string, unknown>, timeoutMs: number): Promise<ChatResponse> {
  if (!env.OPENROUTER_API_KEY) throw new ExternalCallError("auth", "OPENROUTER_API_KEY not set", undefined, "openrouter");
  const res = await fetchWithTimeout(`${OR_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.APP_URL,
      "X-Title": "Kept",
    },
    body: JSON.stringify(body),
    timeoutMs,
    retries: 2,
    provider: "openrouter",
  });
  if (!res.ok) throw new ExternalCallError("http", `openrouter ${res.status}: ${await res.text()}`, res.status, "openrouter");
  return (await res.json()) as ChatResponse;
}

function stripFence(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export const openrouterProvider: Provider = {
  name: "openrouter",

  async extract(p) {
    const model = env.OPENROUTER_EXTRACT_MODEL;
    const t0 = Date.now();
    const json = await chat(
      {
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: p.system },
          { role: "user", content: p.user },
        ],
      },
      60_000,
    );
    const raw = json.choices?.[0]?.message?.content;
    if (typeof raw !== "string") throw new ExternalCallError("malformed", "openrouter returned no content", undefined, "openrouter");
    return {
      result: { raw: stripFence(raw) },
      meta: {
        provider: "openrouter",
        model,
        inputTokens: json.usage?.prompt_tokens ?? null,
        outputTokens: json.usage?.completion_tokens ?? null,
        latencyMs: Date.now() - t0,
      },
    };
  },

  async transcribe(p) {
    const model = env.OPENROUTER_TRANSCRIBE_MODEL;
    const format = p.mimeType.includes("ogg") ? "ogg" : p.mimeType.includes("mp4") ? "m4a" : p.mimeType.includes("wav") ? "wav" : "webm";
    const b64 = Buffer.from(p.audio).toString("base64");
    const t0 = Date.now();
    const json = await chat(
      {
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: TRANSCRIBE_FALLBACK_PROMPT },
              { type: "input_audio", input_audio: { data: b64, format } },
            ],
          },
        ],
      },
      120_000,
    );
    const raw = json.choices?.[0]?.message?.content;
    if (typeof raw !== "string") throw new ExternalCallError("malformed", "openrouter returned no content", undefined, "openrouter");
    let parsed: { segments?: { start: number; end: number; text: string }[] };
    try {
      parsed = JSON.parse(stripFence(raw)) as typeof parsed;
    } catch {
      throw new ExternalCallError("malformed", "openrouter transcription was not JSON", undefined, "openrouter");
    }
    const segments = (parsed.segments ?? [])
      .filter((s) => typeof s.text === "string" && s.text.trim().length > 0)
      .map((s, i) => ({
        index: i,
        startMs: Math.max(0, Math.round((Number(s.start) || 0) * 1000)),
        endMs: Math.max(0, Math.round((Number(s.end) || 0) * 1000)),
        text: s.text.trim(),
      }));
    if (segments.length === 0) throw new ExternalCallError("malformed", "openrouter transcription empty", undefined, "openrouter");
    const result: TranscribeResult = { segments, durationMs: segments[segments.length - 1]?.endMs ?? null };
    return {
      result,
      meta: {
        provider: "openrouter",
        model,
        inputTokens: json.usage?.prompt_tokens ?? null,
        outputTokens: json.usage?.completion_tokens ?? null,
        latencyMs: Date.now() - t0,
      },
    };
  },
};
