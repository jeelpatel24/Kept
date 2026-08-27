// S9 — Follow-ups. Every open commitment across all confirmed notes, most urgent first.
// Implements: PRD-F16, PRD-F17 (docs/PRD-AMENDMENT-01.md).
import { Followups } from "@/components/Followups";
import { loadFollowups, sortFollowups } from "@/lib/followups/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FollowupsPage() {
  const supabase = await createSupabaseServerClient();
  const items = sortFollowups(await loadFollowups(supabase));
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("users").select("reminders_enabled, email").eq("id", user.id).maybeSingle() : { data: null };

  return <Followups initialItems={items} remindersEnabled={profile?.reminders_enabled ?? false} email={profile?.email ?? ""} />;
}
