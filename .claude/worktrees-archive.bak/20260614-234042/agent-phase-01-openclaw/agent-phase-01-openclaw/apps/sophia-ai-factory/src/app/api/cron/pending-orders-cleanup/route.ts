/**
 * Stale Pending Orders Cleanup Cron — /api/cron/pending-orders-cleanup
 *
 * Marks pending_orders as 'abandoned' if they have been in 'pending' status
 * for more than 24 hours. Prevents unbounded growth of abandoned checkouts.
 *
 * Schedule: daily (e.g. "0 0 * * *" registered in wrangler.jsonc + inject-scheduled-handler.mjs)
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

type D1Binding = {
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => {
      run: () => Promise<{ meta: { changes: number } }>;
    };
  };
};

function getD1Binding(): D1Binding | null {
  try {
    const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
    if (env?.DB) return env.DB as D1Binding;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Binding | undefined;
    return globalDb ?? null;
  } catch {
    return null;
  }
}

/**
 * Mark pending_orders older than 24h as 'abandoned'.
 * Returns the number of rows updated.
 */
export async function cleanupStalePendingOrders(db: D1Binding): Promise<number> {
  const cutoff = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  const result = await db
    .prepare(
      'UPDATE pending_orders SET status = ?, updated_at = ? WHERE status = ? AND created_at < ?',
    )
    .bind('abandoned', Math.floor(Date.now() / 1000), 'pending', cutoff)
    .run();
  return result.meta?.changes ?? 0;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const db = getD1Binding();
  if (!db) {
    logger.error('[cron/pending-orders-cleanup] D1 binding unavailable');
    return NextResponse.json({ error: 'D1 binding unavailable' }, { status: 503 });
  }

  try {
    const cleaned = await cleanupStalePendingOrders(db);
    logger.info('[cron/pending-orders-cleanup] Success', { cleaned });
    return NextResponse.json({ ok: true, cleaned, cron: 'pending-orders-cleanup' });
  } catch (err) {
    logger.error(
      '[cron/pending-orders-cleanup] Failed',
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json({ error: 'Failed to cleanup pending orders' }, { status: 500 });
  }
}
