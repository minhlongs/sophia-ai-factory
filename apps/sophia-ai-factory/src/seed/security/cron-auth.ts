/**
 * Cron Job Authentication Utility
 *
 * Verifies that requests to /api/cron/* endpoints are authenticated
 * via CRON_SECRET bearer token or x-cron-secret header.
 *
 * SECURITY NOTES (2026-07-01 hardening):
 * - Query param ?token= removed — secrets in URLs are logged by proxies/CF.
 * - All comparisons use timing-safe equal (M2 fix).
 * - The x-cf-cron header bypass was removed (2026-05-02).
 * - The scheduled() handler in inject-scheduled-handler.mjs sends
 *   `Authorization: Bearer <CRON_SECRET>` instead.
 *
 * OPERATOR: Run `scripts/set-cron-secret.sh` once before first deploy.
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Timing-safe string comparison.
 * Constant-time: does not short-circuit on first differing byte.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still compare all bytes to avoid length leak, then reject.
    let diff = a.length ^ b.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      diff |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0);
    }
    return diff === 0; // always false when lengths differ
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verify cron authentication from request.
 * Returns NextResponse 401 if auth fails, null if auth succeeds.
 */
export function verifyCronAuth(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  // Dev mode bypass — only in non-production runtimes and not during E2E tests
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_MOCK_AI_SERVICES !== 'true' &&
    !process.env.PLAYWRIGHT_TEST_BASE_URL
  ) {
    return null;
  }

  // Bearer token via Authorization header (primary path — used by scheduled handler)
  if (authHeader?.startsWith('Bearer ') && cronSecret) {
    const token = authHeader.substring(7);
    if (timingSafeEqual(token, cronSecret)) return null;
  }

  // x-cron-secret header with exact secret match (legacy compat — no 'true' shortcut)
  const cronSecretHeader = req.headers.get('x-cron-secret');
  if (cronSecret && cronSecretHeader && timingSafeEqual(cronSecretHeader, cronSecret)) {
    return null;
  }

  // Query param ?token= removed (M3 fix 2026-07-01) — secrets in URLs are logged
  // by proxies, load balancers, and Cloudflare. Use Bearer token or x-cron-secret header instead.

  return NextResponse.json(
    { error: 'Unauthorized - Cron authentication required' },
    { status: 401 }
  );
}
