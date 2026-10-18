/**
 * @module forest/playbook/scheduler/batch-scheduler
 * Core batch scheduler runner for recurring campaigns.
 */

import { createServerClient, getD1, type D1Client, type D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { BatchRunResult, ScheduledCampaignRow } from './types';
import {
  fetchDueSchedulesFromClient,
  fetchDueSchedulesFromD1,
  advanceScheduleCAS,
} from './batch-queue-manager';
import { processRecurringCampaignRunsTable } from './cron-trigger-evaluator';
import { preflightAndDispatchMission } from './schedule-executor-helper';

export async function executeSingleSchedule(
  schedule: ScheduledCampaignRow,
  effectiveToday: string,
  d1: D1Database | null,
  db: D1Client,
  result: BatchRunResult,
): Promise<void> {
  result.processed++;

  try {
    const success = await preflightAndDispatchMission(schedule, effectiveToday, result);
    if (!success) return;

    await advanceScheduleCAS(schedule, effectiveToday, d1, db);
    result.dispatched++;
  } catch (err) {
    logger.error(
      '[BatchScheduler] Unexpected error executing scheduled campaign',
      err instanceof Error ? err : new Error(String(err)),
      { scheduleId: schedule.id },
    );
    result.failures.push(schedule.id);
  }
}

/**
 * Process a batch of due recurring campaign schedules.
 */
export async function processRecurringCampaignBatch(todayStr?: string): Promise<BatchRunResult> {
  const effectiveToday = todayStr?.trim() || new Date().toISOString().split('T')[0];

  const result: BatchRunResult = {
    processed: 0,
    dispatched: 0,
    skippedQuota: 0,
    skippedPreflight: 0,
    failures: [],
  };

  const db = createServerClient();
  const d1 = await getD1();

  let dueSchedules = await fetchDueSchedulesFromClient(db, effectiveToday);
  if (dueSchedules.length === 0 && d1) {
    dueSchedules = await fetchDueSchedulesFromD1(d1, effectiveToday);
  }

  for (const schedule of dueSchedules) {
    await executeSingleSchedule(schedule, effectiveToday, d1, db, result);
  }

  if (d1) {
    await processRecurringCampaignRunsTable(d1, effectiveToday, result);
  }

  return result;
}
