// Service-role client. Bypasses RLS. Use ONLY for: storage, llm_cache/llm_calls writes,
// and guest share-link handlers that have already validated the signed token (SCHEMA §1).
// Implements: TRD-3.6, TRD-5.1
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/db/types";

let cached: ReturnType<typeof createClient<Database>> | null = null;

export function createSupabaseAdminClient() {
  if (cached) return cached;
  cached = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
