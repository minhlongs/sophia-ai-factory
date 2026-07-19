import { NextResponse } from "next/server";

/**
 * Legacy Supabase Magic Link callback. Sophia migrated to Better Auth, which
 * owns its own callback flow under /api/auth/[...all]. Any remaining inbound
 * magic-link redirects land here and forward to /login.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`);
}
