/**
 * Scheduled Campaigns Cron — Phase 5 Auto-Creative Playbook Integration
 *
 * Coordinates scheduled campaign batches with CRON_SECRET authorization.
 * Supports:
 * 1. Playbook Engine: `processRecurringCampaignBatch` for winning pattern
 *    blueprint generation, fail-closed 7-gate preflight, MCU credit CAS deductions,
 *    and multi-track generation (triggered via `?engine=playbook` or `x-campaign-engine: playbook`).
 * 2. Standard Campaign Engine: queued campaign creation for scheduled_campaigns table.
 *
 * Schedule: Daily 03:00 UTC via Cloudflare Cron Trigger
 * Auth: x-cron-secret header, Authorization Bearer, x-cf-cron: true, or ?token= query param
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getD1Safe, type D1Client, type D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
  type CronRunContext,
} from '@/seed/observability/cron-check-in';
import { processRecurringCampaignBatch } from '@/forest/playbook/batch-scheduler';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'scheduled-campaigns';
/** Daily — skip if ran within last 12 hours */
const IDEMPOTENCY_WINDOW_MS = 12 * 60 * 60 * 1000;

function scheduledCampaignRunId(scheduleId: string, runDate: string): string {
  return `scheduled_${scheduleId}_${runDate.replace(/-/g, '')}`;
}

function isUniqueConstraintError(error: { message?: string } | null | undefined): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    message.includes('unique constraint') ||
    message.includes('primary key') ||
    message.includes('duplicate')
  );
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function addDays(date: string, days: number): string {
  const nextDate = new Date(`${date}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate.toISOString().split('T')[0];
}

interface ScheduledCampaignRow {
  id: string;
  user_id: string;
  topic: string;
  template_script: string | null;
  interval_days: number | null;
  next_run_date: string;
  is_active: number;
}

async function handlePlaybookCron(
  today: string,
  d1: D1Database | null,
  cronCtx: CronRunContext,
): Promise<NextResponse> {
  try {
    const batchResult = await processRecurringCampaignBatch(today);

    logger.info(
      `[scheduled-campaigns] Playbook batch executed: processed=${batchResult.processed} dispatched=${batchResult.dispatched} skippedQuota=${batchResult.skippedQuota} skippedPreflight=${batchResult.skippedPreflight} failures=${batchResult.failures.length}`,
    );

    if (d1) {
      await recordCronRun(
        d1,
        CRON_NAME,
        batchResult.failures.length > 0 ? 'failure' : 'success',
        batchResult.failures.length > 0
          ? `Failed schedules: ${batchResult.failures.join(', ')}`
          : undefined,
      );
    }

    finishCronCheckIn(cronCtx, CRON_NAME);

    return NextResponse.json({
      success: true,
      today,
      created: batchResult.dispatched,
      dispatched: batchResult.dispatched,
      processed: batchResult.processed,
      skippedQuota: batchResult.skippedQuota,
      skippedPreflight: batchResult.skippedPreflight,
      failures: batchResult.failures.length > 0 ? batchResult.failures : undefined,
    });
  } catch (e) {
    const message = toError(e).message;
    logger.error('[scheduled-campaigns] Playbook batch failed', toError(e));
    if (d1) await recordCronRun(d1, CRON_NAME, 'failure', message);
    failCronCheckIn(cronCtx, CRON_NAME, e);
    return NextResponse.json({ error: 'Cron failed', details: message }, { status: 500 });
  }
}

async function processLegacyScheduleRow(
  schedule: ScheduledCampaignRow,
  today: string,
  db: D1Client,
): Promise<{ created: boolean; failureId?: string }> {
  try {
    const runDate = dateOnly(schedule.next_run_date);
    let insertedCampaign = true;

    const { error: insertError } = await db.from('campaigns').insert({
      id: scheduledCampaignRunId(schedule.id, runDate),
      user_id: schedule.user_id,
      title: `${schedule.topic} — ${runDate}`,
      topic: schedule.topic,
      audience: null,
      script_content: {
        source: 'scheduled_campaign',
        schedule_id: schedule.id,
        script: schedule.template_script ?? '',
      },
      status: 'queued',
      progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      if (isUniqueConstraintError(insertError)) {
        insertedCampaign = false;
        logger.info(
          `[scheduled-campaigns] Campaign already exists for schedule ${schedule.id} on ${runDate}`,
        );
      } else {
        logger.error(
          `[scheduled-campaigns] Insert failed for schedule ${schedule.id}`,
          new Error(insertError.message),
        );
        return { created: false, failureId: schedule.id };
      }
    }

    const { data: updatedSchedules, error: updateError } = await db
      .from('scheduled_campaigns')
      .update({
        next_run_date: addDays(today, schedule.interval_days ?? 7),
        last_run_date: runDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', schedule.id)
      .eq('user_id', schedule.user_id)
      .returning('id');

    if (updateError) {
      logger.error(
        `[scheduled-campaigns] Schedule advance failed for ${schedule.id}`,
        new Error(updateError.message),
      );
      return { created: false, failureId: schedule.id };
    }

    if (!updatedSchedules?.[0]) {
      logger.error(
        `[scheduled-campaigns] Schedule advance matched no rows for ${schedule.id}`,
        new Error('Scheduled campaign not found for user'),
      );
      return { created: false, failureId: schedule.id };
    }

    return { created: insertedCampaign };
  } catch (e) {
    logger.error(`[scheduled-campaigns] Failed for schedule ${schedule.id}`, toError(e));
    return { created: false, failureId: schedule.id };
  }
}

async function fetchLegacySchedules(
  db: D1Client,
  today: string,
): Promise<{ schedules: ScheduledCampaignRow[] | null; tableMissing?: boolean; error?: unknown }> {
  const { data, error } = await db
    .from('scheduled_campaigns')
    .select('*')
    .eq('is_active', 1)
    .lte('next_run_date', today);

  if (error) {
    const msg = (error as { message?: string }).message ?? String(error);
    if (
      msg.includes('no such table') ||
      msg.includes('relation') ||
      msg.includes('does not exist')
    ) {
      return { schedules: null, tableMissing: true };
    }
    return { schedules: null, error };
  }

  return { schedules: (data ?? []) as unknown as ScheduledCampaignRow[] };
}

function checkEmptyOrMissingSchedules(
  schedules: ScheduledCampaignRow[] | null,
  tableMissing: boolean | undefined,
): { skippedResponse?: NextResponse } {
  if (tableMissing) {
    logger.info('[scheduled-campaigns] Table not yet created — skipping');
    return {
      skippedResponse: NextResponse.json({
        success: true,
        created: 0,
        message: 'Table not yet available',
      }),
    };
  }

  if (!schedules || schedules.length === 0) {
    return {
      skippedResponse: NextResponse.json({
        success: true,
        created: 0,
        message: 'No scheduled campaigns due',
      }),
    };
  }

  return {};
}

async function executeLegacyScheduleBatch(
  schedules: ScheduledCampaignRow[],
  today: string,
  db: D1Client,
): Promise<{ created: number; failures: string[] }> {
  let created = 0;
  const failures: string[] = [];

  for (const schedule of schedules) {
    const res = await processLegacyScheduleRow(schedule, today, db);
    if (res.failureId) {
      failures.push(res.failureId);
    } else if (res.created) {
      created++;
    }
  }

  return { created, failures };
}

async function handleLegacyCron(
  today: string,
  d1: D1Database | null,
  cronCtx: CronRunContext,
): Promise<NextResponse> {
  try {
    const db = createServerClient();
    const { schedules, tableMissing, error: fetchError } = await fetchLegacySchedules(db, today);

    const { skippedResponse } = checkEmptyOrMissingSchedules(schedules, tableMissing);
    if (skippedResponse) {
      if (d1) await recordCronRun(d1, CRON_NAME, 'success');
      finishCronCheckIn(cronCtx, CRON_NAME);
      return skippedResponse;
    }

    if (fetchError) {
      throw fetchError;
    }

    const { created, failures } = await executeLegacyScheduleBatch(schedules!, today, db);

    logger.info(`[scheduled-campaigns] Done: created=${created} failures=${failures.length}`);
    if (d1) {
      await recordCronRun(
        d1,
        CRON_NAME,
        failures.length > 0 ? 'failure' : 'success',
        failures.length > 0 ? `Failed schedules: ${failures.join(', ')}` : undefined,
      );
    }

    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({
      success: true,
      created,
      total: schedules!.length,
      failures: failures.length > 0 ? failures : undefined,
    });
  } catch (e) {
    const message = toError(e).message;
    logger.error('[scheduled-campaigns] Cron failed', toError(e));
    if (d1) await recordCronRun(d1, CRON_NAME, 'failure', message);
    failCronCheckIn(cronCtx, CRON_NAME, e);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const d1 = await getD1Safe();

  if (d1 && (await wasRecentlyRun(d1, CRON_NAME, IDEMPOTENCY_WINDOW_MS))) {
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  const today = new Date().toISOString().split('T')[0];

  const url = req.nextUrl ?? new URL(req.url);
  const isPlaybookEngine =
    url.searchParams.get('engine') === 'playbook' ||
    req.headers.get('x-campaign-engine') === 'playbook';

  if (isPlaybookEngine) {
    return handlePlaybookCron(today, d1, cronCtx);
  }

  return handleLegacyCron(today, d1, cronCtx);
}

export async function POST(req: NextRequest) {
  return GET(req);
}
