/**
	 * Credit Pack Expiry Cron — daily at 03:00 UTC
	 * Finds one-time credit pack purchases past their TTL and marks them expired.
	 * Zeroes credits_remaining so balance queries exclude them.
	 *
	 * Schedule: "0 3 * * *" (registered in wrangler.jsonc)
	 * Auth: CRON_SECRET bearer token
	 */
import { NextRequest, NextResponse } from 'next/server';
import type { D1Database } from '@cloudflare/workers-types';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { logger } from '@/seed/utils/logger-utility';
import { createServerClient } from '@/seed/db/client';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { startCronCheckIn, finishCronCheckIn, failCronCheckIn } from '@/seed/observability/cron-check-in';

const CRON_NAME = 'credit-expiry';
const IDEMPOTENCY_WINDOW_MS = 23 * 60 * 60 * 1000;

export async function GET(request: NextRequest): Promise<NextResponse> {
		const authError = verifyCronAuth(request);
		if (authError) return authError;
	
		const cronCtx = startCronCheckIn(CRON_NAME);
		const nowSec = Math.floor(Date.now() / 1000);
		let expired = 0;
		let errors = 0;
	
		try {
		const db = createServerClient() as unknown as D1Database;
	
		// Idempotency guard — skip if recently run
		const recentRun = await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS);
		if (recentRun) {
	      logger.info(`[${CRON_NAME}] Skipped — recently run`);
	      finishCronCheckIn(cronCtx, CRON_NAME);
		return NextResponse.json({ ok: true, skipped: true, reason: 'recently_run' });
	    }

	    // Find paid one-time credit pack purchases past their TTL
	    const { results } = await db.prepare(
	      `SELECT id, user_id, credits_remaining, expires_at
	       FROM user_purchases
	       WHERE kind = 'one_time'
	         AND status = 'paid'
	         AND expires_at IS NOT NULL
	         AND expires_at <= ?1
	         AND credits_remaining > 0`
	    ).bind(nowSec).all<{
	      id: string;
	      user_id: string;
	      credits_remaining: number;
	      expires_at: number;
	    }>();

	    const expiredPurchases = results ?? [];

	    if (expiredPurchases.length === 0) {
	      logger.info(`[${CRON_NAME}] No expired credit packs found`);
	      await recordCronRun(db, CRON_NAME, 'success');
	      finishCronCheckIn(cronCtx, CRON_NAME);
	      return NextResponse.json({ ok: true, expired: 0, timestamp: new Date().toISOString() });
	    }

	    // Batch update: expire all in one atomic statement
	    const ids = expiredPurchases.map(p => p.id);
	    const placeholders = ids.map(() => '?').join(', ');
	    const nowIso = new Date().toISOString();

	    const result = await db.prepare(
	      `UPDATE user_purchases
	       SET status = 'expired', credits_remaining = 0, updated_at = ?1
	       WHERE id IN (${placeholders})`
	    ).bind(nowSec, ...ids).run();

	    expired = result.meta.changes ?? 0;

	    // Log individual expiry for audit trail
	    for (const purchase of expiredPurchases) {
	      logger.info(`[${CRON_NAME}] Expired purchase ${purchase.id}`, {
	        user_id: purchase.user_id,
	        credits_returned: 0,
	        credits_were: purchase.credits_remaining,
	        expires_at: purchase.expires_at,
	      });
	    }

	    await recordCronRun(db, CRON_NAME, 'success');
	    logger.info(`[${CRON_NAME}] Done`, { expired });
	    finishCronCheckIn(cronCtx, CRON_NAME);

	    return NextResponse.json({
	      ok: true,
	      expired,
	      timestamp: new Date().toISOString(),
	    });
	  } catch (err) {
	    logger.error(`[${CRON_NAME}] Fatal error`, err instanceof Error ? err : new Error(String(err)));
	    failCronCheckIn(cronCtx, CRON_NAME, err);
	    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'unknown' }, { status: 500 });
	  }
}
