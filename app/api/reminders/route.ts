// GET/PATCH the current user's reminder opt-in (PRD-F17). Opt-in is explicit — default off.
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const patchSchema = z.object({ enabled: z.boolean() });

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthenticated", 401);
  const { data } = await supabase.from("users").select("reminders_enabled, email").eq("id", user.id).maybeSingle();
  return Response.json({ enabled: data?.reminders_enabled ?? false, email: data?.email ?? user.email });
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Unauthenticated", 401);
  const body = patchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Invalid input", 400);
  const { error } = await supabase.from("users").update({ reminders_enabled: body.data.enabled }).eq("id", user.id);
  if (error) return jsonError(error.message, 500);
  return Response.json({ ok: true, enabled: body.data.enabled });
}
