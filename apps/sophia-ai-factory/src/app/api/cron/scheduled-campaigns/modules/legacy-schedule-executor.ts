import { NextResponse } from 'next/server';
import { createServerClient, type D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { recordCronRun } from '@/land/cron/run-tracker';
import {
  finishCronCheckIn,
  failCronCheckIn,
  type CronRunContext,
} from '@/seed/observability/cron-check-in';
import { CRON_NAME } from './scheduled-types';
import {
  processLegacyScheduleRow,
  fetchLegacySchedules,
} from './legacy-schedule-row-processor';

export { processLegacyScheduleRow, fetchLegacySchedules };

export async function handleLegacyCron(
  today: string,
  d1: D1Database | null,
  cronCtx: CronRunContext,
): Promise<NextResponse> {
  try {
    const db = createServerClient();
    const { schedules, tableMissing, error: fetchError } = await fetchLegacySchedules(db, today);

    if (tableMissing) {
      logger.info('[scheduled-campaigns] Table not yet created — skipping');
      if (d1) await recordCronRun(d1, CRON_NAME, 'success');
      finishCronCheckIn(cronCtx, CRON_NAME);
      return NextResponse.json({
        success: true,
        created: 0,
        message: 'Table not yet available',
      });
    }

    if (!schedules || schedules.length === 0) {
      if (d1) await recordCronRun(d1, CRON_NAME, 'success');
      finishCronCheckIn(cronCtx, CRON_NAME);
      return NextResponse.json({
        success: true,
        created: 0,
        message: 'No scheduled campaigns due',
      });
    }

    if (fetchError) {
      throw fetchError;
    }

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
      total: schedules.length,
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
