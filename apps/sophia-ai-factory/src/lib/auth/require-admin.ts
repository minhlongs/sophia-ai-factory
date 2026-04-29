import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/lib/better-auth-session';
import type { User } from '@/lib/db/client';

export type RequireAdminResult = { user: User } | NextResponse;

/**
 * Gate a route on Better Auth session + role === 'admin'.
 * Returns { user } on success, or a NextResponse with 401/403 on failure.
 *
 * Usage:
 *   const auth = await requireAdmin(request);
 *   if (auth instanceof NextResponse) return auth;
 *   const { user } = auth;
 */
export async function requireAdmin(
  request: NextRequest | Request,
): Promise<RequireAdminResult> {
  const headers =
    request instanceof Request
      ? request.headers
      : (request as NextRequest).headers;
  const user = await getCurrentUserFromHeaders(headers);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: admin role required' },
      { status: 403 },
    );
  }
  return { user };
}
