/**
 * Authentication helpers for /api/affiliate/payout-method
 * Layer: app/api/affiliate/payout-method
 * @module app/api/affiliate/payout-method/payout-method-auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export async function authenticateAndGetDb(): Promise<{
  user: { id: string };
  db: NonNullable<Awaited<ReturnType<typeof getD1>>>;
} | { error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const db = await getD1();
  if (!db) {
    logger.error('[Affiliate/PayoutMethod] D1 unavailable');
    return { error: NextResponse.json({ error: 'service_unavailable' }, { status: 503 }) };
  }

  return { user, db };
}