/**
 * Clearance Promote Cron Endpoint
 *
 * Daily cron that promotes affiliate_conversions from 'pending_clearance'
 * to 'available' once the 60-day hold window has passed.
 *
 * Schedule: "0 0 * * *" — daily at midnight UTC
 * Auth: Authorization: Bearer <CRON_SECRET> | x-cron-secret header | token param
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';

export const dynamic = 'force-dynamic';

function getD1Binding(): D1Database {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
  if (env?.DB) return env.DB as D1Database;
  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  if (globalDb) return globalDb;
  throw new Error('D1 database binding not available');
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

interface RunResult {
  changes?: number;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getD1Binding();
    const result = await db
      .prepare(
        `UPDATE affiliate_conversions
         SET payout_status = 'available'
         WHERE payout_status = 'pending_clearance'
           AND available_at IS NOT NULL
           AND available_at <= unixepoch()`
      )
      .run() as RunResult;

    const promoted = result.changes ?? 0;
    logger.info('[cron/clearance-promote] Done', { promoted });
    return NextResponse.json({ ok: true, promoted });
  } catch (error) {
    logger.error('[cron/clearance-promote] Failed', toError(error));
    return NextResponse.json({ error: 'Clearance promote failed' }, { status: 500 });
  }
}
