/**
 * Cron Job Authentication Utility
 *
 * Verifies that requests to /api/cron/* endpoints are authenticated
 * via cron secret or Vercel Cron header
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger-utility';

/**
 * Verify cron authentication from request
 * Returns NextResponse error if auth fails, null if auth succeeds
 */
export function verifyCronAuth(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  const vercelCronHeader = req.headers.get('x-vercel-cron');
  const authHeader = req.headers.get('authorization');

  // Check for Vercel Cron header (trusted)
  if (vercelCronHeader === 'true') {
    logger.info('[Cron Auth] Verified via Vercel Cron header');
    return null;
  }

  // Check for Authorization header with Bearer token
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (cronSecret && token === cronSecret) {
      logger.info('[Cron Auth] Verified via Bearer token');
      return null;
    }
  }

  // Check for x-cron-secret header
  const cronSecretHeader = req.headers.get('x-cron-secret');
  if (cronSecretHeader === cronSecret) {
    logger.info('[Cron Auth] Verified via x-cron-secret header');
    return null;
  }

  // Allow localhost/development without auth
  if (process.env.NODE_ENV === 'development') {
    logger.warn('[Cron Auth] Development mode - skipping auth check');
    return null;
  }

  // Auth failed
  logger.warn('[Cron Auth] Authentication failed', {
    hasCronSecret: !!cronSecret,
    hasVercelHeader: !!vercelCronHeader,
    hasAuthHeader: !!authHeader,
  });

  return NextResponse.json(
    { error: 'Unauthorized - Cron authentication required' },
    { status: 401 }
  );
}
