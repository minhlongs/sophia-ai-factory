/**
 * POST/GET /api/cron/heartbeat
 * Scheduled every 10 min — pings Better Stack heartbeat URL to confirm liveness.
 * RED-TEAM #3: CRON_SECRET auth required.
 * RED-TEAM #5: Probes D1 with SELECT 1 first.
 *   - D1 ok  → push heartbeat (BS shows green)
 *   - D1 fail → SKIP heartbeat (silence triggers BS missed-heartbeat alert) + push fatal log
 *
 * Observability: records run result to cron_run_log via run-tracker (migration 0026).
 * Idempotency: skips execution if run within last 5 minutes.
 *
 * Architecture note: currently triggered via wrangler cron (HTTP GET/POST).
 * Future: migrate to CF Workers scheduled() handler to remove HTTP exposure entirely.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pushHeartbeat, pushFatalLog } from '@/seed/observability/telemetry/better-stack-client';
import { getErrorMessage } from '@/seed/utils/to-error';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';

export const dynamic = 'force-dynamic';

interface Env {
  DB?: {
    prepare: (sql: string) => { first: () => Promise<unknown> };
  };
  BETTER_STACK_HEARTBEAT_URL?: string;
  BETTER_STACK_LOGS_TOKEN?: string;
  BETTER_STACK_INGESTING_HOST?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handler(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handler(request);
}

const CRON_NAME = 'heartbeat';
/** Idempotency window: skip if ran within last 5 minutes */
const IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;

async function handler(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const bsConfig = {
    logsToken: process.env.BETTER_STACK_LOGS_TOKEN ?? '',
    ingestingHost: process.env.BETTER_STACK_INGESTING_HOST,
  };
  const heartbeatUrl = process.env.BETTER_STACK_HEARTBEAT_URL ?? '';

  // RED-TEAM #5: probe D1 before confirming liveness
  // Access env bindings via process.env pattern for Next.js compat;
  // actual D1 binding accessed via globalThis in CF Worker runtime
  const db = (globalThis as unknown as Env).DB;

  if (db) {
    // Idempotency: skip if recently run to prevent double-execution
    const alreadyRan = await wasRecentlyRun(db as D1Database, CRON_NAME, IDEMPOTENCY_WINDOW_MS);
    if (alreadyRan) {
      finishCronCheckIn(cronCtx, CRON_NAME);
      return NextResponse.json({ ok: true, skipped: true, reason: 'recently_run' }, { status: 200 });
    }

    try {
      await db.prepare('SELECT 1').first();
    } catch (d1Err) {
      const errMsg = getErrorMessage(d1Err);
      // D1 unavailable: push fatal log, SKIP heartbeat (silence = BS missed-heartbeat alert)
      await pushFatalLog('D1_UNAVAILABLE', errMsg, bsConfig);
      await recordCronRun(db as D1Database, CRON_NAME, 'failure', errMsg);
      failCronCheckIn(cronCtx, CRON_NAME, d1Err);
      return NextResponse.json(
        { ok: false, reason: 'D1_UNAVAILABLE — heartbeat skipped' },
        { status: 200 }
      );
    }
  }

  try {
    // D1 healthy: confirm liveness to Better Stack
    await pushHeartbeat(heartbeatUrl);

    if (db) {
      await recordCronRun(db as D1Database, CRON_NAME, 'success');
    }

    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    const errMsg = getErrorMessage(err);
    if (db) {
      await recordCronRun(db as D1Database, CRON_NAME, 'failure', errMsg);
    }
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ ok: false, reason: errMsg }, { status: 500 });
  }
}
