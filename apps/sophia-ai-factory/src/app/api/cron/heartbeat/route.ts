/**
 * POST/GET /api/cron/heartbeat
 * Scheduled every 10 min — pings Better Stack heartbeat URL to confirm liveness.
 * RED-TEAM #3: CRON_SECRET auth required.
 * RED-TEAM #5: Probes D1 with SELECT 1 first.
 *   - D1 ok  → push heartbeat (BS shows green)
 *   - D1 fail → SKIP heartbeat (silence triggers BS missed-heartbeat alert) + push fatal log
 *
 * TODO: future migration to CF scheduled() handler removes HTTP exposure.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pushHeartbeat, pushFatalLog } from '@/lib/telemetry/better-stack-client';

export const dynamic = 'force-dynamic';

interface Env {
  DB?: {
    prepare: (sql: string) => { first: () => Promise<unknown> };
  };
  CRON_SECRET?: string;
  BETTER_STACK_HEARTBEAT_URL?: string;
  BETTER_STACK_LOGS_TOKEN?: string;
  BETTER_STACK_INGESTING_HOST?: string;
}

function verifyCronSecret(request: NextRequest, cronSecret: string | undefined): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  if (!cronSecret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handler(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handler(request);
}

async function handler(request: NextRequest): Promise<NextResponse> {
  // RED-TEAM #3: verify CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!verifyCronSecret(request, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    try {
      await db.prepare('SELECT 1').first();
    } catch (d1Err) {
      const errMsg = d1Err instanceof Error ? d1Err.message : String(d1Err);
      // D1 unavailable: push fatal log, SKIP heartbeat (silence = BS missed-heartbeat alert)
      await pushFatalLog('D1_UNAVAILABLE', errMsg, bsConfig);
      return NextResponse.json(
        { ok: false, reason: 'D1_UNAVAILABLE — heartbeat skipped' },
        { status: 200 }
      );
    }
  }

  // D1 healthy: confirm liveness to Better Stack
  await pushHeartbeat(heartbeatUrl);

  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
