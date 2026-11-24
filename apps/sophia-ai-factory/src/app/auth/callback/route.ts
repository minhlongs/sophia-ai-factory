import { NextResponse } from "next/server";
import { enforceAllowedRequestHost, getSafeOriginFromRequest } from "@/seed/domain";

/**
 * Legacy Supabase Magic Link callback. Sophia migrated to Better Auth, which
 * owns its own callback flow under /api/auth/[...all]. Any remaining inbound
 * magic-link redirects land here and forward to /login on a validated origin.
 */
export async function GET(request: Request) {
  const hostDenied = enforceAllowedRequestHost(request);
  if (hostDenied) return hostDenied;

  const origin = getSafeOriginFromRequest(request);
  return NextResponse.redirect(`${origin}/login`);
}
