import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';
import {
  CRON_NAME,
  IDEMPOTENCY_WINDOW_MS,
  REMINDER_DAYS,
} from './types';
import { processReminderWindow } from './reminder-processor';

export async function handleSubscriptionRemindersCron(
  request: NextRequest,
): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const d1 = await getD1();

  if (d1 && (await wasRecentlyRun(d1, CRON_NAME, IDEMPOTENCY_WINDOW_MS))) {
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  let remindersSent = 0;
  let errors = 0;

  try {
    const db = createServerClient();
    const now = new Date();

    for (const days of REMINDER_DAYS) {
      const windowResult = await processReminderWindow(db, days, now);
      remindersSent += windowResult.sent;
      errors += windowResult.errors;
    }

    logger.info('[RenewalReminder] Cron complete', { remindersSent, errors });
    if (d1) await recordCronRun(d1, CRON_NAME, 'success');
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ success: true, remindersSent, errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[RenewalReminder] Critical error', new Error(message));
    if (d1) await recordCronRun(d1, CRON_NAME, 'failure', message);
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
