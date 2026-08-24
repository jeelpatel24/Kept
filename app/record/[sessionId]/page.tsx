// S2 — Recording active. Implements: PRD-F1, F2, F3 · TRD-3.1 · UX-BRIEF §5 S2.
import { notFound } from "next/navigation";
import { Recorder } from "@/components/Recorder";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ autostart?: string }>;
}) {
  const { sessionId } = await params;
  const { autostart } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: session } = await supabase.from("sessions").select("id, status").eq("id", sessionId).is("deleted_at", null).maybeSingle();
  if (!session) notFound();

  return <Recorder sessionId={session.id} initialStatus={session.status} autostart={autostart === "1"} />;
}
