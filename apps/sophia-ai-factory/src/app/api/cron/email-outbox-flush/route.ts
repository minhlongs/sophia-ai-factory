/**
 * Email Outbox Flush Cron
 * Processes pending welcome emails with retry logic.
 * Schedule: Every 1 minute (reuses existing cron slot: every-1-min)
 * @module app/api/cron/email-outbox-flush
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/security/cron-auth';
import { flushOutbox } from '@/lib/outbox/email-outbox';
import { logger } from '@/lib/utils/logger-utility';

export const dynamic = 'force-dynamic';

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const db = getD1();
  if (!db) {
    logger.warn('[email-outbox-flush] D1 not available');
    return NextResponse.json({ ok: false, error: 'D1 not available' }, { status: 503 });
  }

  try {
    const summary = await flushOutbox(db);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[email-outbox-flush] Flush failed', err instanceof Error ? err : new Error(msg));
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
