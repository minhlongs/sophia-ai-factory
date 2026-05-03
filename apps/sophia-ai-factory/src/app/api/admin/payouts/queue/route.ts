/**
 * GET /api/admin/payouts/queue
 *
 * Returns users with balance_available >= MIN_PAYOUT_USD, ordered by balance desc.
 * Admin-only (session role check).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { QueueQuerySchema, MIN_PAYOUT_USD } from '@/land/wallet/payout-validators';

export const dynamic = 'force-dynamic';

interface QueueRow {
  user_id: string;
  balance_available: number;
  balance_pending: number;
  currency: string;
  last_rebuilt_at: number | null;
}

function getD1Binding(): D1Database {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
  if (env?.DB) return env.DB as D1Database;
  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  if (globalDb) return globalDb;
  throw new Error('D1 database binding not available');
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parseResult = QueueQuerySchema.safeParse(rawParams);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query params', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { limit, cursor } = parseResult.data;
    const db = getD1Binding();

    let sql = `
      SELECT user_id, balance_available, balance_pending, currency, last_rebuilt_at
      FROM user_wallets
      WHERE balance_available >= ?`;
    const binds: (string | number)[] = [MIN_PAYOUT_USD];

    if (cursor) {
      sql += ` AND user_id > ?`;
      binds.push(cursor);
    }
    sql += ` ORDER BY balance_available DESC LIMIT ?`;
    binds.push(limit);

    const { results } = await db
      .prepare(sql)
      .bind(...binds)
      .all<QueueRow>();

    const rows = results ?? [];
    const nextCursor = rows.length === limit ? (rows[rows.length - 1]?.user_id ?? null) : null;

    logger.info('[admin/payouts/queue] Fetched queue', { count: rows.length });
    return NextResponse.json({ items: rows, next_cursor: nextCursor, min_payout_usd: MIN_PAYOUT_USD });
  } catch (error) {
    logger.error('[admin/payouts/queue] Error', toError(error));
    return NextResponse.json({ error: 'Failed to fetch payout queue' }, { status: 500 });
  }
}
