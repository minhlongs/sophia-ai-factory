/**
 * Database helper & Cron interval calculations for Playbook Schedules.
 *
 * Layer: land (business workflows / Server Actions)
 *
 * @module land/playbook/actions/schedule-db-helper
 */

import { logger } from '@/seed/utils/logger-utility';
import type { D1Client, D1Database } from '@/seed/db/client';

export function parseCronIntervalDays(cronExpr: string): number {
  const cron = (cronExpr || '').trim();
  if (cron.includes('*/3') || cron.includes('3d')) return 3;
  if (cron === '0 0 * * *' || cron.includes('1d') || cron.includes('* * *')) return 1;
  if (cron.includes('*/14') || cron.includes('2w')) return 14;
  if (cron.includes('0 0 1 * *') || cron.includes('30d') || cron.includes('1m')) return 30;
  return 7;
}

export interface UpsertScheduleRecordParams {
  scheduleId: string;
  workspaceId: string;
  userId: string;
  blueprintId: string;
  scheduleCron: string;
  batchSize: number;
  isActive: boolean;
  intervalDays: number;
  nextRunAt: number;
  nextRunDate: string;
  now: number;
}

export async function upsertRecurringScheduleDb(
  d1: D1Database | null,
  p: UpsertScheduleRecordParams,
): Promise<void> {
  if (!d1) return;

  try {
    await d1
      .prepare(
        `INSERT INTO recurring_campaign_runs (
           id, workspace_id, user_id, blueprint_id, schedule_cron, batch_size,
           next_run_at, last_run_at, is_active, total_runs, last_status,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 0, 'idle', ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           blueprint_id = excluded.blueprint_id,
           schedule_cron = excluded.schedule_cron,
           batch_size = excluded.batch_size,
           is_active = excluded.is_active,
           updated_at = excluded.updated_at`,
      )
      .bind(
        p.scheduleId,
        p.workspaceId,
        p.userId,
        p.blueprintId,
        p.scheduleCron,
        p.batchSize,
        p.nextRunAt,
        p.isActive ? 1 : 0,
        p.now,
        p.now,
      )
      .run();
  } catch (err) {
    logger.warn('[upsertRecurringScheduleDb] recurring_campaign_runs failed', { error: String(err) });
  }

  try {
    await d1
      .prepare(
        `INSERT INTO scheduled_campaigns (
           id, user_id, topic, interval_days, next_run_date, last_run_date,
           is_active, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, NULL, ?, datetime('now'), datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           topic = excluded.topic,
           interval_days = excluded.interval_days,
           next_run_date = excluded.next_run_date,
           is_active = excluded.is_active,
           updated_at = datetime('now')`,
      )
      .bind(
        p.scheduleId,
        p.userId,
        p.blueprintId,
        p.intervalDays,
        p.nextRunDate,
        p.isActive ? 1 : 0,
      )
      .run();
  } catch (err) {
    logger.warn('[upsertRecurringScheduleDb] scheduled_campaigns failed', { error: String(err) });
  }
}

export async function updateScheduleActiveStatus(
  d1: D1Database | null,
  client: D1Client | null,
  scheduleId: string,
  isActive: boolean,
  now: number,
): Promise<void> {
  const activeInt = isActive ? 1 : 0;
  if (d1) {
    await d1
      .prepare(`UPDATE recurring_campaign_runs SET is_active = ?, updated_at = ? WHERE id = ?`)
      .bind(activeInt, now, scheduleId)
      .run();
    await d1
      .prepare(`UPDATE scheduled_campaigns SET is_active = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(activeInt, scheduleId)
      .run();
  } else if (client) {
    await client.execute(
      `UPDATE recurring_campaign_runs SET is_active = ?, updated_at = ? WHERE id = ?`,
      [activeInt, now, scheduleId],
    );
    await client.execute(
      `UPDATE scheduled_campaigns SET is_active = ?, updated_at = datetime('now') WHERE id = ?`,
      [activeInt, scheduleId],
    );
  }
}
