// LLM router with ordered fallback chain (TRD-2.6, TRD-3.4).
// complete(task, payload): tries providers in env-configured order; 429 → immediate next provider;
// each provider call has its own timeout + retries (lib/http.ts). Results cached by content hash (TRD-2.7).
// Token usage + status logged to llm_calls (SCHEMA §2).
import "server-only";
import { env } from "@/lib/env";
import { ExternalCallError } from "@/lib/http";
import { cacheGet, cacheSet } from "@/lib/llm/cache";
import { groqProvider } from "@/lib/llm/providers/groq";
import { openrouterProvider } from "@/lib/llm/providers/openrouter";
import type {
  ExtractPayload,
  ExtractResult,
  LlmTask,
  Provider,
  ProviderCallMeta,
  TranscribePayload,
  TranscribeResult,
} from "@/lib/llm/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PROVIDERS: Record<string, Provider> = {
  groq: groqProvider,
  openrouter: openrouterProvider,
};

export function chainFor(task: LlmTask): Provider[] {
  const raw = task === "transcribe" ? env.LLM_CHAIN_TRANSCRIBE : env.LLM_CHAIN_EXTRACT;
  const names = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const chain = names.map((n) => PROVIDERS[n]).filter((p): p is Provider => Boolean(p) && Boolean(task === "transcribe" ? p?.transcribe : p?.extract));
  if (chain.length === 0) throw new Error(`No providers configured for task "${task}" (LLM_CHAIN_${task.toUpperCase()})`);
  return chain;
}

interface CallLog {
  sessionId: string | null;
  task: LlmTask;
  provider: string;
  model: string;
  cacheHit: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  status: "ok" | "rate_limited" | "failed";
}

async function logCall(c: CallLog) {
  try {
    const db = createSupabaseAdminClient();
    await db.from("llm_calls").insert({
      session_id: c.sessionId,
      task: c.task,
      provider: c.provider,
      model: c.model,
      cache_hit: c.cacheHit,
      input_tokens: c.inputTokens,
      output_tokens: c.outputTokens,
      latency_ms: c.latencyMs,
      status: c.status,
    });
  } catch (e) {
    // Observability must never break the pipeline.
    if (env.IS_DEV) console.warn("[llm] failed to log call", e);
  }
  if (env.IS_DEV) {
    console.info(`[llm] ${c.task} ${c.provider}/${c.model} ${c.status}${c.cacheHit ? " (cache)" : ""} in=${c.inputTokens ?? "-"} out=${c.outputTokens ?? "-"} ${c.latencyMs ?? "-"}ms`);
  }
}

export class LlmChainExhausted extends Error {
  constructor(
    public readonly task: LlmTask,
    public readonly failures: { provider: string; kind: string; message: string }[],
  ) {
    super(`All providers failed for ${task}: ${failures.map((f) => `${f.provider}=${f.kind}`).join(", ")}`);
    this.name = "LlmChainExhausted";
  }
}

export interface CompleteResult<T> {
  result: T;
  meta: ProviderCallMeta;
  cacheHit: boolean;
}

type PayloadFor<T extends LlmTask> = T extends "transcribe" ? TranscribePayload : ExtractPayload;
type ResultFor<T extends LlmTask> = T extends "transcribe" ? TranscribeResult : ExtractResult;

export async function complete<T extends LlmTask>(
  task: T,
  payload: PayloadFor<T>,
  opts: { sessionId?: string | null; skipCache?: boolean } = {},
): Promise<CompleteResult<ResultFor<T>>> {
  const sessionId = opts.sessionId ?? null;
  const inputHash = task === "transcribe" ? (payload as TranscribePayload).audioHash : (payload as ExtractPayload).inputHash;

  if (!opts.skipCache) {
    const hit = await cacheGet<ResultFor<T>>(task, inputHash);
    if (hit) {
      await logCall({ sessionId, task, provider: hit.provider, model: hit.model, cacheHit: true, inputTokens: 0, outputTokens: 0, latencyMs: 0, status: "ok" });
      return { result: hit.result, meta: { provider: hit.provider, model: hit.model, inputTokens: 0, outputTokens: 0, latencyMs: 0 }, cacheHit: true };
    }
  }

  const failures: { provider: string; kind: string; message: string }[] = [];
  for (const provider of chainFor(task)) {
    try {
      const out =
        task === "transcribe"
          ? await provider.transcribe!(payload as TranscribePayload)
          : await provider.extract!(payload as ExtractPayload);
      await logCall({ sessionId, task, provider: out.meta.provider, model: out.meta.model, cacheHit: false, inputTokens: out.meta.inputTokens, outputTokens: out.meta.outputTokens, latencyMs: out.meta.latencyMs, status: "ok" });
      await cacheSet(task, inputHash, out.meta.provider, out.meta.model, out.result);
      return { result: out.result as ResultFor<T>, meta: out.meta, cacheHit: false };
    } catch (e) {
      const kind = e instanceof ExternalCallError ? e.kind : "unknown";
      const message = e instanceof Error ? e.message : String(e);
      failures.push({ provider: provider.name, kind, message });
      if (env.IS_DEV) console.warn(`[llm] ${task} ${provider.name} ${kind}: ${message.slice(0, 400)}`);
      await logCall({ sessionId, task, provider: provider.name, model: "-", cacheHit: false, inputTokens: null, outputTokens: null, latencyMs: null, status: kind === "rate_limited" ? "rate_limited" : "failed" });
      // 429 → immediately try the next provider (TRD-3.4). Other failures also move on after their own retries.
      continue;
    }
  }
  throw new LlmChainExhausted(task, failures);
}
