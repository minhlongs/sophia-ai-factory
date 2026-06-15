/**
 * Promo TOCTOU Cleanup Cron — /api/cron/promo-cleanup
 *
 * Runs daily or regularly to cleanup reserved promo codes that expired/were not fully redeemed
 * to prevent permanent quota leak.
 *
 * Runs:
 * UPDATE promo_code_redemptions SET status='reverted' WHERE status='reserved' AND redeemed_at < strftime('%s','now') - 7200
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

async function handleCleanup(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const db = getD1Binding();
  if (!db) {
    logger.error('[cron/promo-cleanup] D1 binding unavailable');
    return NextResponse.json({ error: 'D1 binding unavailable' }, { status: 503 });
  }

  try {
    const result = await db
      .prepare(
        `UPDATE promo_code_redemptions
         SET status = 'reverted'
         WHERE status = 'reserved'
           AND redeemed_at < strftime('%s','now') - 7200`
      )
      .bind()
      .run();

    const changes = result.meta?.changes ?? 0;
    logger.info('[cron/promo-cleanup] Success', { reverted: changes });
    return NextResponse.json({ ok: true, reverted: changes });
  } catch (err) {
    logger.error('[cron/promo-cleanup] Failed to cleanup reserved promo codes', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Failed to cleanup' }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleCleanup(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleCleanup(request);
}
