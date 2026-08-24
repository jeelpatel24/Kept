// Magic-link callback. Implements: TRD-5.1
// Supports two link shapes:
//  1. token_hash + type — set by the customised Supabase email template (see README §1). Works from ANY browser/device,
//     because it does not depend on the PKCE verifier cookie that only exists in the browser that requested the link.
//  2. code — Supabase's default PKCE link. Only works in the same browser that requested it.
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "recovery", "invite", "email_change"];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const fail = (msg: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, url.origin));

  const supabase = await createSupabaseServerClient();

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
    return fail(error.message);
  }

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
    return fail(error.message.includes("code verifier") ? "This link was opened in a different browser than the one that requested it. Open it in the same browser, or request a new link from this one." : error.message);
  }
  return fail("missing_code");
}
