// S3 — Processing. Implements: PRD-F2, F4, F15 · UX-BRIEF §5 S3 (staged progress, transcript shown as soon as it exists, retry on failure).
import { notFound } from "next/navigation";
import { Processing } from "@/components/Processing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProcessingPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: session } = await supabase.from("sessions").select("id, status").eq("id", sessionId).is("deleted_at", null).maybeSingle();
  if (!session) notFound();
  return <Processing sessionId={session.id} />;
}
