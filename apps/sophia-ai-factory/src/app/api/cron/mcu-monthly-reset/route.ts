/**
 * MCU Monthly Reset Cron
 *
 * Schedule: "0 0 1 * *" — 1st of month at 00:00 UTC
 * Tops up each subscribed user's MCU balance to their tier's monthly allocation.
 *
 * Auth: CRON_SECRET bearer token
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { addCredits } from '@/lib/mcu/credits-repo';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import { logger } from '@/seed/utils/logger-utility';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { recordCronRun, wasRecentlyRun } from '@/lib/cron/run-tracker';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'mcu-monthly-reset';
const IDEMPOTENCY_WINDOW_MS = 23 * 60 * 60 * 1000;

// Map DB tier string to UNIFIED_TIERS key
const TIER_MAP: Record<string, keyof typeof UNIFIED_TIERS> = {
  basic: 'BASIC',
  premium: 'PREMIUM',
  enterprise: 'ENTERPRISE',
  master: 'MASTER',
  BASIC: 'BASIC',
  PREMIUM: 'PREMIUM',
  ENTERPRISE: 'ENTERPRISE',
  MASTER: 'MASTER',
};

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

interface UserTierRow {
  id: string;
  tier: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const d1 = getD1Binding();

  if (d1 && await wasRecentlyRun(d1, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    return NextResponse.json({ skipped: true, reason: 'recently_run' });
  }

  const db = createServerClient();
  let processedCount = 0;
  let errorCount = 0;

  try {
    // Fetch all users with active subscriptions
    const { data: users } = await db
      .from('user_subscriptions')
      .select('id, tier')
      .eq('status', 'active') as { data: UserTierRow[] | null; error: unknown };

    const activeUsers = users ?? [];

    for (const user of activeUsers) {
      try {
        const tierKey = TIER_MAP[user.tier];
        if (!tierKey) continue;

        const tierConfig = UNIFIED_TIERS[tierKey];
        const monthlyMcu = tierConfig.mcuMonthly;

        if (monthlyMcu <= 0) continue;

        await addCredits(user.id, monthlyMcu, 'monthly_subscription_reset', {
          tier: tierKey,
          month: new Date().toISOString().slice(0, 7),
        });
        processedCount++;
      } catch (err) {
        logger.error('[mcu-monthly-reset] Error processing user', { userId: user.id, err });
        errorCount++;
      }
    }

    if (d1) await recordCronRun(d1, CRON_NAME, 'success');

    return NextResponse.json({
      ok: true,
      processed: processedCount,
      errors: errorCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[mcu-monthly-reset] Fatal error', err instanceof Error ? err : new Error(String(err)));
    if (d1) await recordCronRun(d1, CRON_NAME, 'failure', String(err));
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
