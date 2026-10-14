/**
 * POST/GET /api/cron/error-digest
 * Daily 05:00 UTC — queries error_log, sends fingerprint-only summary to OpenRouter,
 * emails founder + Telegram message.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pushFatalLog } from '@/seed/observability/telemetry/better-stack-client';
import { getErrorMessage } from '@/seed/utils/to-error';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';
import {
  CRON_NAME,
  IDEMPOTENCY_WINDOW_MS,
  GlobalEnv,
  verifyCronSecret,
  callOpenRouter,
  sendTelegram,
  sendFounderEmail,
  fetchRecentErrors,
  checkAndEmitThreshold,
  ErrorRow,
} from './digest-core';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handler(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handler(request);
}

async function handler(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cronCtx = startCronCheckIn(CRON_NAME);
  const bsConfig = {
    logsToken: process.env.BETTER_STACK_LOGS_TOKEN ?? '',
    ingestingHost: process.env.BETTER_STACK_INGESTING_HOST,
  };

  const db = (globalThis as unknown as GlobalEnv).DB;
  if (!db) {
    await pushFatalLog('D1_UNAVAILABLE', 'DB binding missing in error-digest', bsConfig);
    failCronCheckIn(cronCtx, CRON_NAME, new Error('D1_UNAVAILABLE'));
    return NextResponse.json({ ok: false, reason: 'D1_UNAVAILABLE' }, { status: 200 });
  }

  if (await wasRecentlyRun(db as unknown as D1Database, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  let rows: ErrorRow[] = [];
  try {
    rows = await fetchRecentErrors(db);
  } catch (d1Err) {
    const errMsg = getErrorMessage(d1Err);
    await pushFatalLog('D1_UNAVAILABLE', errMsg, bsConfig);
    await recordCronRun(db as unknown as D1Database, CRON_NAME, 'failure', errMsg);
    failCronCheckIn(cronCtx, CRON_NAME, d1Err);
    return NextResponse.json({ ok: false, reason: 'D1_UNAVAILABLE' }, { status: 200 });
  }

  const summary = await callOpenRouter(rows);
  const errorCount = rows.reduce((acc, r) => acc + r.c, 0);
  const dateStr = new Date().toISOString().slice(0, 10);

  checkAndEmitThreshold(db, rows, errorCount);

  const report =
    rows.length === 0
      ? `*[Sophia] Daily Error Digest — ${dateStr}*\n\nNo errors in the past 24 hours.`
      : `*[Sophia] Daily Error Digest — ${dateStr}*\n\n` +
        `Total errors: ${errorCount} across ${rows.length} unique fingerprints\n\n` +
        `*Top 3 to investigate:*\n${summary}`;

  const founderEmail = process.env.FOUNDER_EMAIL ?? '';
  if (founderEmail) {
    await sendFounderEmail(
      founderEmail,
      `[Sophia] Daily Error Digest — ${dateStr}`,
      report.replace(/\*/g, '')
    );
  }
  await sendTelegram(report);

  await recordCronRun(db as unknown as D1Database, CRON_NAME, 'success');
  finishCronCheckIn(cronCtx, CRON_NAME);

  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
    errorCount,
    uniqueFingerprints: rows.length,
  });
}
