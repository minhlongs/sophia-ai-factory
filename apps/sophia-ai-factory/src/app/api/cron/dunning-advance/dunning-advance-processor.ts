/**
 * Row processors for Dunning Advance Cron.
 *
 * @module app/api/cron/dunning-advance/dunning-advance-processor
 */

import { createServerClient } from '@/seed/db/client';
import { transitionDunningState } from '@/land/billing/dunning/dunning-state-machine';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export interface DunningSettingsRow {
  id: string;
  user_id: string;
  license_nonce: string;
  dunning_state: string;
  dunning_state_changed_at: string;
  grace_period_days: number;
}

type DbClient = ReturnType<typeof createServerClient>;

export async function processPastDueRow(
  db: DbClient,
  row: DunningSettingsRow,
  now: Date,
): Promise<'advanced' | 'skipped' | 'error'> {
  try {
    const stateChangedAt = new Date(row.dunning_state_changed_at);
    const graceEndsAt = new Date(
      stateChangedAt.getTime() + row.grace_period_days * 24 * 60 * 60 * 1000,
    );

    if (graceEndsAt > now) return 'skipped';

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

    return 'advanced';
  } catch (innerErr) {
    logger.error('[DunningAdvance] Error advancing past_due row', toError(innerErr), {
      license_nonce: row.license_nonce.slice(0, 8),
    });
    return 'error';
  }
}

export async function processDelinquentRow(
  db: DbClient,
  row: DunningSettingsRow,
  now: Date,
): Promise<'advanced' | 'skipped' | 'error'> {
  try {
    const { data: pendingRetry } = await db
      .from('dunning_attempts')
      .select('next_retry_at')
      .eq('license_nonce', row.license_nonce)
      .eq('success', false)
      .gt('next_retry_at', now.toISOString())
      .limit(1);

    if (pendingRetry?.length) return 'skipped';

    const stateChangedAt = new Date(row.dunning_state_changed_at);
    const delinquentFor = (now.getTime() - stateChangedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (delinquentFor < row.grace_period_days) return 'skipped';

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

    return 'advanced';
  } catch (innerErr) {
    logger.error('[DunningAdvance] Error advancing delinquent row', toError(innerErr), {
      license_nonce: row.license_nonce.slice(0, 8),
    });
    return 'error';
  }
}

export async function runDunningAdvanceBatch(
  db: DbClient,
  now: Date,
): Promise<{ advanced: number; errors: number }> {
  const { data: pastDueRows } = await db
    .from('dunning_settings')
    .select('id, user_id, license_nonce, dunning_state, dunning_state_changed_at, grace_period_days')
    .eq('dunning_state', 'past_due') as { data: DunningSettingsRow[] | null };

  const { data: delinquentRows } = await db
    .from('dunning_settings')
    .select('id, user_id, license_nonce, dunning_state, dunning_state_changed_at, grace_period_days')
    .eq('dunning_state', 'delinquent') as { data: DunningSettingsRow[] | null };

  const outcomes = await Promise.all([
    ...(pastDueRows ?? []).map((row) => processPastDueRow(db, row, now)),
    ...(delinquentRows ?? []).map((row) => processDelinquentRow(db, row, now)),
  ]);

  return {
    advanced: outcomes.filter((o) => o === 'advanced').length,
    errors: outcomes.filter((o) => o === 'error').length,
  };
}
