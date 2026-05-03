/**
 * GET /api/user/wallet
 *
 * Returns the authenticated user's wallet balances and recent conversions.
 * Reads from materialized user_wallets table for <100ms p95 latency.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

interface WalletRow {
  user_id: string;
  balance_pending: number;
  balance_available: number;
  balance_paid_out: number;
  currency: string;
  last_rebuilt_at: number | null;
  updated_at: string;
}

interface ConversionRow {
  id: string;
  event_type: string;
  gross_amount: number;
  commission_user: number;
  currency: string;
  payout_status: string;
  offer_id: string | null;
  created_at: string;
}

function getD1Binding(): D1Database {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
  if (env?.DB) return env.DB as D1Database;
  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  if (globalDb) return globalDb;
  throw new Error('D1 database binding not available');
}

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getD1Binding();

    const wallet = await db
      .prepare(`SELECT * FROM user_wallets WHERE user_id = ?`)
      .bind(user.id)
      .first<WalletRow>();

    const { results: recentConversions } = await db
      .prepare(
        `SELECT id, event_type, gross_amount, commission_user, currency, payout_status, offer_id, created_at
         FROM affiliate_conversions
         WHERE user_id = ? AND event_type != 'TEST'
         ORDER BY created_at DESC
         LIMIT 20`
      )
      .bind(user.id)
      .all<ConversionRow>();

    return NextResponse.json({
      balance_pending: wallet?.balance_pending ?? 0,
      balance_available: wallet?.balance_available ?? 0,
      balance_paid_out: wallet?.balance_paid_out ?? 0,
      currency: wallet?.currency ?? 'USD',
      last_rebuilt_at: wallet?.last_rebuilt_at ?? null,
      recent_conversions: recentConversions ?? [],
    });
  } catch (error) {
    logger.error('[/api/user/wallet] Error', toError(error));
    return NextResponse.json({ error: 'Failed to fetch wallet' }, { status: 500 });
  }
}
