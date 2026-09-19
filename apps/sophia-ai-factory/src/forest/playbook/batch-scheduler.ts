/**
 * Recurring Campaign Batch Scheduler — Phase 5: Auto-Creative Playbook
 *
 * Evaluates active recurring campaign schedules, verifies tier quota,
 * synthesizes campaign blueprints from winning patterns, executes fail-closed
 * 7-gate preflight checks, deducts MCU credits via atomic CAS, and dispatches
 * multi-track generation missions.
 *
 * Layer: forest (infrastructure and orchestrator — depends only on seed, tree, and forest)
 *
 * @module forest/playbook/batch-scheduler
 */

import { createServerClient, getD1, type D1Client, type D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getUserTier } from '@/seed/db/get-user-tier';
import { checkMissionQuota } from '@/forest/quota/mission-quota';
import { runMissionPreflightCheck } from '@/tree/mission/preflight-check';
import { deductCredits } from '@/tree/mcu/credits-repo';
import { createMission } from '@/tree/mission/repository';
import { dispatchMultiTrackMission } from '@/tree/mission/executor-bridge';
import { generateCampaignBlueprint } from './campaign-generator';
import type { RecurringCampaignScheduleRow } from '@/seed/types/playbook-pattern';

export interface BatchRunResult {
  processed: number;
  dispatched: number;
  skippedQuota: number;
  skippedPreflight: number;
  failures: string[];
}

export interface ScheduledCampaignRow {
  id: string;
  workspace_id?: string | null;
  user_id: string;
  topic: string;
  template_script?: string | null;
  interval_days?: number | null;
  next_run_date: string;
  last_run_date?: string | null;
  is_active: number;
  created_at?: string;
  updated_at?: string;
}

function calculateNextRunDate(todayStr: string, intervalDays: number): string {
  const nextDate = new Date(`${todayStr}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + (intervalDays > 0 ? intervalDays : 7));
  return nextDate.toISOString().split('T')[0];
}

async function fetchDueSchedulesFromClient(
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

async function fetchDueSchedulesFromD1(
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

async function advanceScheduleCAS(
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

async function executeSingleSchedule(
  schedule: ScheduledCampaignRow,
  effectiveToday: string,
  d1: D1Database | null,
  db: D1Client,
  result: BatchRunResult,
): Promise<void> {
  result.processed++;
  const userId = schedule.user_id;
  const workspaceId = schedule.workspace_id || userId;

  try {
    const userTier = await getUserTier(userId);
    const quota = await checkMissionQuota(userId, userTier, 'missions');
    if (!quota.allowed) {
      result.skippedQuota++;
      return;
    }

    const blueprint = await generateCampaignBlueprint(workspaceId, schedule.topic);
    const estimatedCostCents = blueprint.estimatedCostCents ?? 150;

    const preflight = await runMissionPreflightCheck({
      userId,
      workspaceId,
      requiredCapabilities: ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'],
      estimatedCostCents,
    });

    if (!preflight.passed) {
      result.skippedPreflight++;
      return;
    }

    const missionId = `m_sched_${schedule.id}_${Date.now()}`;
    const nowSec = Math.floor(Date.now() / 1000);
    const mission = await createMission({
      id: missionId,
      workspaceId,
      creatorId: userId,
      title: `${schedule.topic} — ${effectiveToday}`,
      objective: `Automated recurring playbook campaign for ${schedule.topic}`,
      audience: 'Target audience derived from playbook patterns',
      geography: 'global',
      timeframeStart: nowSec,
      timeframeEnd: nowSec + 7 * 86400,
      budgetCents: estimatedCostCents,
      spentCents: 0,
      autonomyLevel: 3,
      channels: [blueprint.targetPlatform],
      monetizationGoals: ['conversion'],
      constraints: {
        blueprintId: blueprint.id,
        scheduleId: schedule.id,
        source: 'playbook_recurring_batch',
        hookStyle: blueprint.hookStyle,
        voiceStyle: blueprint.voiceStyle,
      },
      successMetrics: {},
      status: 'draft',
      currentPhase: 'init',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const creditDeducted = await deductCredits(
      userId,
      estimatedCostCents,
      mission.id,
      'recurring_campaign_dispatch',
    );

    if (!creditDeducted) {
      result.failures.push(schedule.id);
      return;
    }

    await dispatchMultiTrackMission(mission.id, {
      userId,
      workspaceId,
      topic: schedule.topic,
      durationSeconds: blueprint.durationSeconds,
      aspectRatio: blueprint.aspectRatio,
      estimatedScenes: blueprint.estimatedScenes,
      estimatedCostCents,
      voiceStyle: blueprint.voiceStyle,
    });

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

async function processRecurringCampaignRunsTable(
  d1: D1Database,
  effectiveToday: string,
  result: BatchRunResult,
): Promise<void> {
  try {
    const nowMs = Date.now();
    const recurringRunsRes = await d1
      .prepare(
        `SELECT * FROM recurring_campaign_runs
         WHERE is_active = 1 AND next_run_at <= ?`,
      )
      .bind(nowMs)
      .all<RecurringCampaignScheduleRow>();

    const recurringRuns = recurringRunsRes.results ?? [];
    for (const rec of recurringRuns) {
      result.processed++;
      const userTier = await getUserTier(rec.user_id);
      const quota = await checkMissionQuota(rec.user_id, userTier, 'missions');
      if (!quota.allowed) {
        result.skippedQuota++;
        continue;
      }

      const blueprint = await generateCampaignBlueprint(rec.workspace_id, 'Recurring Playbook Campaign');
      const batchSize = Math.max(1, rec.batch_size ?? 1);
      const totalCostCents = batchSize * (blueprint.estimatedCostCents ?? 150);

      const preflight = await runMissionPreflightCheck({
        userId: rec.user_id,
        workspaceId: rec.workspace_id,
        requiredCapabilities: ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'],
        estimatedCostCents: totalCostCents,
      });

      if (!preflight.passed) {
        result.skippedPreflight++;
        continue;
      }

      const missionId = `m_rec_${rec.id}_${Date.now()}`;
      const nowSec = Math.floor(Date.now() / 1000);
      const mission = await createMission({
        id: missionId,
        workspaceId: rec.workspace_id,
        creatorId: rec.user_id,
        title: `Campaign Run — ${effectiveToday}`,
        objective: `Automated recurring run for blueprint ${rec.blueprint_id}`,
        audience: 'Playbook audience',
        geography: 'global',
        timeframeStart: nowSec,
        timeframeEnd: nowSec + 7 * 86400,
        budgetCents: totalCostCents,
        spentCents: 0,
        autonomyLevel: 3,
        channels: [blueprint.targetPlatform],
        monetizationGoals: ['conversion'],
        constraints: { blueprintId: rec.blueprint_id, scheduleId: rec.id, batchSize },
        successMetrics: {},
        status: 'draft',
        currentPhase: 'init',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      const creditDeducted = await deductCredits(
        rec.user_id,
        totalCostCents,
        mission.id,
        'recurring_campaign_dispatch',
      );

      if (!creditDeducted) {
        result.failures.push(rec.id);
        continue;
      }

      await dispatchMultiTrackMission(mission.id, {
        userId: rec.user_id,
        workspaceId: rec.workspace_id,
        topic: 'Recurring Campaign Batch',
        durationSeconds: blueprint.durationSeconds,
        aspectRatio: blueprint.aspectRatio,
        estimatedScenes: blueprint.estimatedScenes,
        estimatedCostCents: totalCostCents,
      });

      const nextRunAt = nowMs + 7 * 86400 * 1000;
      await d1
        .prepare(
          `UPDATE recurring_campaign_runs
           SET next_run_at = ?, last_run_at = ?, total_runs = total_runs + 1, last_status = 'running', updated_at = ?
           WHERE id = ? AND next_run_at = ?`,
        )
        .bind(nextRunAt, nowMs, nowMs, rec.id, rec.next_run_at)
        .run();

      result.dispatched++;
    }
  } catch {
    // Non-fatal if table does not exist or query fails
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
