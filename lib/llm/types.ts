// Shared LLM types. Implements: TRD-3.2 (TranscriptSegment), TRD-3.4 (router contract).

export interface TranscriptSegment {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface TranscribePayload {
  audio: Uint8Array;
  mimeType: string;
  /** Used for the cache key. sha256 of audio bytes. */
  audioHash: string;
}

export interface TranscribeResult {
  segments: TranscriptSegment[];
  durationMs: number | null;
}

export interface ExtractPayload {
  /** The fully-rendered prompt (system + user). Prompts live in lib/prompts. */
  system: string;
  user: string;
  /** Cache key — sha256(prompt version + transcript + recordedAt + tz). */
  inputHash: string;
}

export interface ExtractResult {
  /** Raw model text. Validated by the caller against the Zod schema (CLAUDE.md §4). */
  raw: string;
}

export type LlmTask = "transcribe" | "extract";

export interface ProviderCallMeta {
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
}

export interface Provider {
  name: string;
  transcribe?: (p: TranscribePayload) => Promise<{ result: TranscribeResult; meta: ProviderCallMeta }>;
  extract?: (p: ExtractPayload) => Promise<{ result: ExtractResult; meta: ProviderCallMeta }>;
}
