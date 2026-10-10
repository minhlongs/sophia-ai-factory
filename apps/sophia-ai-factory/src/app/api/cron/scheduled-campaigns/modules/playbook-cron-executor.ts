import { NextResponse } from 'next/server';
import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { recordCronRun } from '@/land/cron/run-tracker';
import {
  finishCronCheckIn,
  failCronCheckIn,
  type CronRunContext,
} from '@/seed/observability/cron-check-in';
import { processRecurringCampaignBatch } from '@/forest/playbook/batch-scheduler';
import { CRON_NAME } from './scheduled-types';

export async function handlePlaybookCron(
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
