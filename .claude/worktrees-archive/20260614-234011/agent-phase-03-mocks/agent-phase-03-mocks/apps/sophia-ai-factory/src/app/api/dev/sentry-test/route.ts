/**
 * GET /api/dev/sentry-test
 * Admin-gated smoke test that fires a single warning event through the Sentry forwarder.
 * Used for one-time post-deploy verification that NEXT_PUBLIC_SENTRY_DSN is wired.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
import { forwardToSentry } from '@/land/observability/sentry-forwarder';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const adminSecret = process.env.ADMIN_DEBUG_TOKEN;

  let authorized = !!(adminSecret && token === adminSecret);
  if (!authorized) {
    try {
      const user = await getCurrentUserFromHeaders(request.headers);
      if (user && (await isUserAdmin(user))) authorized = true;
    } catch { /* unauth */ }
  }
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await forwardToSentry({
    level: 'warning',
    message: 'sentry-test',
    tags: { source: 'manual-verify' },
  });

  return NextResponse.json({
    sent: true,
    dsnConfigured: !!process.env.NEXT_PUBLIC_SENTRY_DSN || !!process.env.SENTRY_DSN,
  });
}
