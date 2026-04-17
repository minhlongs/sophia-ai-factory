/**
 * Dunning Advance Cron
 *
 * Advances overdue dunning states:
 * - past_due + grace period expired → suspended
 * - delinquent + no retry in window → suspended
 *
 * Schedule: Daily via Cloudflare Cron Trigger
 * Auth: x-cron-secret header or x-cf-cron: true
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { transitionDunningState } from '@/lib/billing/dunning/dunning-state-machine';
import { logger } from '@/lib/utils/logger-utility';

function verifyCronAuth(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;

  const expectedSecret = process.env.CRON_SECRET;
  // P2: Accept Authorization: Bearer <CRON_SECRET> (standard CF Workers cron pattern)
  if (expectedSecret && request.headers.get('authorization') === `Bearer ${expectedSecret}`) return true;

  const cronSecret = request.headers.get('x-cron-secret');
  if (expectedSecret && cronSecret === expectedSecret) return true;

  const cfCron = request.headers.get('x-cf-cron');
  if (cfCron === 'true') return true;

  return false;
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
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let advanced = 0;
  let errors = 0;

  try {
    const db = createServerClient();
    const now = new Date();

    // Find past_due accounts whose grace period has expired
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

        if (graceEndsAt > now) continue; // Still within grace period

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
        logger.error('[DunningAdvance] Error advancing past_due row', innerErr as Error, {
          license_nonce: row.license_nonce.slice(0, 8),
        });
      }
    }

    // Find delinquent accounts with no pending retry scheduled (max retry exceeded)
    const { data: delinquentRows } = await db
      .from('dunning_settings')
      .select('id, user_id, license_nonce, dunning_state, dunning_state_changed_at, grace_period_days')
      .eq('dunning_state', 'delinquent') as { data: DunningSettingsRow[] | null };

    for (const row of delinquentRows ?? []) {
      try {
        // Check for a future retry attempt
        const { data: pendingRetry } = await db
          .from('dunning_attempts')
          .select('next_retry_at')
          .eq('license_nonce', row.license_nonce)
          .eq('success', false)
          .gt('next_retry_at', now.toISOString())
          .limit(1);

        if (pendingRetry?.length) continue; // Has upcoming retry, skip

        // No future retry — check delinquent for > grace_period_days since state change
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
        logger.error('[DunningAdvance] Error advancing delinquent row', innerErr as Error, {
          license_nonce: row.license_nonce.slice(0, 8),
        });
      }
    }

    logger.info('[DunningAdvance] Cron complete', { advanced, errors });
    return NextResponse.json({ success: true, advanced, errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[DunningAdvance] Critical error', new Error(message));
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
