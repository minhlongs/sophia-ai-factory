import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Auth callback handler for Supabase Magic Link flow.
 * Supabase redirects here after user clicks the magic link in their email.
 * Exchanges the auth code for a session, then redirects to /dashboard.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // If no code or exchange failed, redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
