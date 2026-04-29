/**
 * Wallet Rebuild Cron Endpoint
 *
 * Hourly cron that rebuilds the user_wallets materialized table
 * from affiliate_conversions aggregation.
 *
 * Schedule: "10 * * * *" — hourly at :10 (after clearance-promote at :00)
 * Auth: Authorization: Bearer <CRON_SECRET> | x-cron-secret header | token param
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';
import { rebuildAllWallets } from '@/lib/wallet/wallet-rebuilder';
import { recordCronRun, wasRecentlyRun } from '@/lib/cron/run-tracker';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'wallet-rebuild';
/** Hourly — skip if ran within last 30 minutes (strict for mutating cron) */
const IDEMPOTENCY_WINDOW_MS = 30 * 60 * 1000;

function getD1Binding(): D1Database | null {
  try {
    const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch {
    return null;
  }
}

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  if (req.headers.get('authorization') === `Bearer ${secret}`) return true;

  const cronHeader =
    req.headers.get('x-cron-secret') || req.headers.get('x-cf-cron');
  const token = req.nextUrl.searchParams.get('token');

  return token === secret || cronHeader === secret || cronHeader === 'true';
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getD1Binding();

  if (db && await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  const start = Date.now();
  try {
    const result = await rebuildAllWallets();
    const elapsed = Date.now() - start;

    logger.info('[cron/wallet-rebuild] Done', { ...result, elapsed });
    if (db) await recordCronRun(db, CRON_NAME, 'success');
    return NextResponse.json({ ok: true, ...result, elapsed });
  } catch (error) {
    const msg = toError(error).message;
    logger.error('[cron/wallet-rebuild] Failed', toError(error));
    if (db) await recordCronRun(db, CRON_NAME, 'failure', msg);
    return NextResponse.json({ error: 'Wallet rebuild failed' }, { status: 500 });
  }
}
