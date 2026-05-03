/**
 * SOP Scheduler Cron Endpoint
 *
 * Triggered every 5 minutes by Cloudflare Cron → inject-scheduled-handler.mjs.
 * Claims and executes due SOP installations.
 *
 * Auth: Bearer CRON_SECRET (same pattern as all cron routes).
 * Idempotency: claimDueInstallations advances schedule atomically.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { handleSopSchedulerTick } from '@/lib/cron/sop-scheduler';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const db = getD1();
  if (!db) {
    logger.error('[cron/sop-scheduler] D1 binding not available');
    return NextResponse.json({ ok: false, error: 'DB binding unavailable' }, { status: 500 });
  }

  try {
    const { processed } = await handleSopSchedulerTick(db);
    logger.info('[cron/sop-scheduler] Complete', { processed });
    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[cron/sop-scheduler] Fatal error', err instanceof Error ? err : new Error(msg));
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return GET(request);
}
