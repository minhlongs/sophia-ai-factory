/**
 * @module forest/playbook/scheduler/batch-queue-manager
 * Schedule query retrieval and atomic CAS advance routines.
 */

import type { D1Client, D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { ScheduledCampaignRow } from './types';

export function calculateNextRunDate(todayStr: string, intervalDays: number): string {
  const nextDate = new Date(`${todayStr}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + (intervalDays > 0 ? intervalDays : 7));
  return nextDate.toISOString().split('T')[0];
}

export async function fetchDueSchedulesFromClient(
  db: D1Client,
  effectiveToday: string,
): Promise<ScheduledCampaignRow[]> {
  try {
    const { data, error } = await db
      .from('scheduled_campaigns')
      .select('*')
      .eq('is_active', 1)
      .lte('next_run_date', effectiveToday);

    if (error) {
      const msg = (error as { message?: string }).message ?? String(error);
      if (msg.includes('no such table') || msg.includes('does not exist')) {
        logger.info('[BatchScheduler] scheduled_campaigns table not yet created — skipping');
      } else {
        logger.warn('[BatchScheduler] Client fetch scheduled_campaigns error', { error: msg });
      }
      return [];
    }
    return Array.isArray(data) ? (data as unknown as ScheduledCampaignRow[]) : [];
  } catch (err) {
    logger.warn('[BatchScheduler] createServerClient query threw', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export async function fetchDueSchedulesFromD1(
  d1: D1Database,
  effectiveToday: string,
): Promise<ScheduledCampaignRow[]> {
  try {
    const d1Res = await d1
      .prepare(
        `SELECT id, workspace_id, user_id, topic, template_script, interval_days, next_run_date, last_run_date, is_active
         FROM scheduled_campaigns
         WHERE is_active = 1 AND next_run_date <= ?`,
      )
      .bind(effectiveToday)
      .all<ScheduledCampaignRow>();

    return d1Res.results ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('no such table')) {
      logger.warn('[BatchScheduler] Direct D1 query for scheduled_campaigns failed', { error: msg });
    }
    return [];
  }
}

export async function advanceScheduleCAS(
  schedule: ScheduledCampaignRow,
  effectiveToday: string,
  d1: D1Database | null,
  db: D1Client,
): Promise<void> {
  const intervalDays =
    typeof schedule.interval_days === 'number' && schedule.interval_days > 0
      ? schedule.interval_days
      : 7;
  const nextRunDateStr = calculateNextRunDate(effectiveToday, intervalDays);

  let casSuccess = false;
  if (d1) {
    const casResult = await d1
      .prepare(
        `UPDATE scheduled_campaigns
         SET next_run_date = ?, last_run_date = ?, updated_at = datetime('now')
         WHERE id = ? AND next_run_date = ?`,
      )
      .bind(nextRunDateStr, effectiveToday, schedule.id, schedule.next_run_date)
      .run();

    casSuccess = (casResult.meta?.changes ?? 0) > 0;
  } else {
    const updateRes = await db
      .from('scheduled_campaigns')
      .update({
        next_run_date: nextRunDateStr,
        last_run_date: effectiveToday,
        updated_at: new Date().toISOString(),
      })
      .eq('id', schedule.id)
      .eq('next_run_date', schedule.next_run_date);

    casSuccess = !updateRes.error;
  }

  if (!casSuccess) {
    logger.warn('[BatchScheduler] Atomic CAS advance next_run_date found 0 modified rows', {
      scheduleId: schedule.id,
      expectedNextRunDate: schedule.next_run_date,
    });
  }
}
