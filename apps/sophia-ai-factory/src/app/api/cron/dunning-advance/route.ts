/**
 * Dunning Advance Cron
 *
 * Advances overdue dunning states:
 * - past_due + grace period expired → suspended
 * - delinquent + no retry in window → suspended
 *
 * Schedule: Daily via Cloudflare Cron Trigger (0 1 * * *)
 * Auth: x-cron-secret header or x-cf-cron: true
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { transitionDunningState } from '@/land/billing/dunning/dunning-state-machine';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { recordCronRun, wasRecentlyRun } from '@/lib/cron/run-tracker';
import { verifyCronAuth } from '@/seed/security/cron-auth';

const CRON_NAME = 'dunning-advance';
/** Daily — skip if ran within last 12 hours */
const IDEMPOTENCY_WINDOW_MS = 12 * 60 * 60 * 1000;

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

interface DunningSettingsRow {
  id: string;
  user_id: string;
  license_nonce: string;
  dunning_state: string;
  dunning_state_changed_at: string;
  grace_period_days: number;
}

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const d1 = getD1();

  if (d1 && await wasRecentlyRun(d1, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  let advanced = 0;
  let errors = 0;

  try {
    const db = createServerClient();
    const now = new Date();

    const { data: pastDueRows } = await db
      .from('dunning_settings')
      .select('id, user_id, license_nonce, dunning_state, dunning_state_changed_at, grace_period_days')
      .eq('dunning_state', 'past_due') as { data: DunningSettingsRow[] | null };

    for (const row of pastDueRows ?? []) {
      try {
        const stateChangedAt = new Date(row.dunning_state_changed_at);
        const graceEndsAt = new Date(
          stateChangedAt.getTime() + row.grace_period_days * 24 * 60 * 60 * 1000
        );

        if (graceEndsAt > now) continue;

        logger.info('[DunningAdvance] Advancing past_due → suspended', {
          licenseNonce: row.license_nonce.slice(0, 8),
          graceExpiredAt: graceEndsAt.toISOString(),
        });

        await transitionDunningState(row.license_nonce, row.user_id, 'suspended');

        await db.from('billing_events').insert({
          user_id: row.user_id,
          license_nonce: row.license_nonce,
          event_type: 'suspension_started',
          event_category: 'dunning',
          event_data: { reason: 'grace_period_expired', automated: true },
        } as Record<string, unknown>);

        advanced++;
      } catch (innerErr) {
        errors++;
        logger.error('[DunningAdvance] Error advancing past_due row', toError(innerErr), {
          license_nonce: row.license_nonce.slice(0, 8),
        });
      }
    }

    const { data: delinquentRows } = await db
      .from('dunning_settings')
      .select('id, user_id, license_nonce, dunning_state, dunning_state_changed_at, grace_period_days')
      .eq('dunning_state', 'delinquent') as { data: DunningSettingsRow[] | null };

    for (const row of delinquentRows ?? []) {
      try {
        const { data: pendingRetry } = await db
          .from('dunning_attempts')
          .select('next_retry_at')
          .eq('license_nonce', row.license_nonce)
          .eq('success', false)
          .gt('next_retry_at', now.toISOString())
          .limit(1);

        if (pendingRetry?.length) continue;

        const stateChangedAt = new Date(row.dunning_state_changed_at);
        const delinquentFor = (now.getTime() - stateChangedAt.getTime()) / (1000 * 60 * 60 * 24);

        if (delinquentFor < row.grace_period_days) continue;

        logger.info('[DunningAdvance] Advancing delinquent → suspended', {
          licenseNonce: row.license_nonce.slice(0, 8),
          delinquentDays: Math.floor(delinquentFor),
        });

        await transitionDunningState(row.license_nonce, row.user_id, 'suspended');

        await db.from('billing_events').insert({
          user_id: row.user_id,
          license_nonce: row.license_nonce,
          event_type: 'suspension_started',
          event_category: 'dunning',
          event_data: { reason: 'delinquent_max_retries_exceeded', automated: true },
        } as Record<string, unknown>);

        advanced++;
      } catch (innerErr) {
        errors++;
        logger.error('[DunningAdvance] Error advancing delinquent row', toError(innerErr), {
          license_nonce: row.license_nonce.slice(0, 8),
        });
      }
    }

    logger.info('[DunningAdvance] Cron complete', { advanced, errors });
    if (d1) await recordCronRun(d1, CRON_NAME, 'success');
    return NextResponse.json({ success: true, advanced, errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[DunningAdvance] Critical error', new Error(message));
    if (d1) await recordCronRun(d1, CRON_NAME, 'failure', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
