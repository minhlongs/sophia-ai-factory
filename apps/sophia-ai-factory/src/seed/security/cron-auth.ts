/**
 * Cron Job Authentication Utility
 *
 * Verifies that requests to /api/cron/* endpoints are authenticated
 * via CRON_SECRET bearer token, x-cron-secret header, or ?token= query param.
 *
 * SECURITY: The x-cf-cron header bypass has been removed (2026-05-02).
 * Any caller setting x-cf-cron: true is no longer trusted without a real secret.
 * The scheduled() handler in inject-scheduled-handler.mjs now sends
 * `Authorization: Bearer <CRON_SECRET>` instead.
 *
 * OPERATOR: Run `scripts/set-cron-secret.sh` once before first deploy.
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Verify cron authentication from request.
 * Returns NextResponse 401 if auth fails, null if auth succeeds.
 */
export function verifyCronAuth(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  // Dev mode bypass — only in non-production runtimes
  if (process.env.NODE_ENV === 'development') return null;

  // Bearer token via Authorization header (primary path — used by scheduled handler)
  if (authHeader?.startsWith('Bearer ') && cronSecret) {
    const token = authHeader.substring(7);
    if (token === cronSecret) return null;
  }

  // x-cron-secret header with exact secret match (legacy compat — no 'true' shortcut)
  const cronSecretHeader = req.headers.get('x-cron-secret');
  if (cronSecret && cronSecretHeader === cronSecret) {
    return null;
  }

  // Query param: ?token=<CRON_SECRET> (external monitors like UptimeRobot)
  const tokenParam = req.nextUrl?.searchParams?.get('token');
  if (cronSecret && tokenParam === cronSecret) return null;

  return NextResponse.json(
    { error: 'Unauthorized - Cron authentication required' },
    { status: 401 }
  );
}
