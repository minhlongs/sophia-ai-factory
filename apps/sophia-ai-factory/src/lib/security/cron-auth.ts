/**
 * Cron Job Authentication Utility
 *
 * Verifies that requests to /api/cron/* endpoints are authenticated
 * via cron secret or Cloudflare Cron Trigger internal header
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Verify cron authentication from request
 * Returns NextResponse error if auth fails, null if auth succeeds
 */
export function verifyCronAuth(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  const cfCronHeader = req.headers.get('x-cf-cron');
  const authHeader = req.headers.get('authorization');

  // Cloudflare Workers cron triggers set x-cf-cron internally
  if (cfCronHeader === 'true') {
    return null;
  }

  // Bearer token (Authorization header)
  if (authHeader?.startsWith('Bearer ') && cronSecret) {
    const token = authHeader.substring(7);
    if (token === cronSecret) return null;
  }

  // x-cron-secret header (literal 'true' for legacy CF triggers, or exact secret)
  const cronSecretHeader = req.headers.get('x-cron-secret');
  if (cronSecretHeader === 'true' || (cronSecret && cronSecretHeader === cronSecret)) {
    return null;
  }

  // Query param: ?token=<CRON_SECRET> (external monitors like UptimeRobot)
  const tokenParam = req.nextUrl?.searchParams?.get('token');
  if (cronSecret && tokenParam === cronSecret) return null;

  // Dev mode bypass
  if (process.env.NODE_ENV === 'development') return null;

  return NextResponse.json(
    { error: 'Unauthorized - Cron authentication required' },
    { status: 401 }
  );
}
