// Content-hash cache (TRD-2.7, CLAUDE.md §5). Service-role only.
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LlmTask } from "@/lib/llm/types";

export async function cacheGet<T>(task: LlmTask, inputHash: string): Promise<{ result: T; provider: string; model: string } | null> {
  const db = createSupabaseAdminClient();
  const { data } = await db.from("llm_cache").select("result, provider, model").eq("task", task).eq("input_hash", inputHash).maybeSingle();
  if (!data) return null;
  return { result: data.result as T, provider: data.provider, model: data.model };
}

export async function cacheSet(task: LlmTask, inputHash: string, provider: string, model: string, result: unknown): Promise<void> {
  const db = createSupabaseAdminClient();
  await db.from("llm_cache").upsert({ task, input_hash: inputHash, provider, model, result: result as never }, { onConflict: "task,input_hash" });
}
