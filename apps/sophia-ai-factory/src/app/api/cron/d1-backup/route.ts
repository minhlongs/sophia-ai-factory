/**
 * POST/GET /api/cron/d1-backup
 *
 * Daily D1 backup cron: dumps all user tables to a SQL file and uploads to R2
 * `sophia-backups` bucket. Triggered by external scheduler (Upstash QStash)
 * since GitHub Actions scheduled workflows are blocked at account level.
 *
 * Auth: CRON_SECRET via Bearer token, x-cron-secret header, or ?token= query.
 * Observability: records run result to `cron_run_log`; pings Better Stack
 * heartbeat (if `BACKUP_HEARTBEAT_URL` configured) on success.
 *
 * R2 layout: `sophia-backups/d1-YYYY-MM-DD.sql` (one object per day; 30-day
 * lifecycle handles retention).
 *
 * @module app/api/cron/d1-backup
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import {
  startCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';
import {
  CRON_NAME,
  type D1BackupEnv,
  executeD1BackupUpload,
} from './d1-backup-runner';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handler(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handler(request);
}

async function handler(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const globalBindings = globalThis as unknown as {
    __env__?: D1BackupEnv;
    __env?: D1BackupEnv;
    [key: symbol]: { env?: D1BackupEnv } | undefined;
  } & D1BackupEnv;
  const env = globalBindings.__env__ ?? globalBindings.__env ??
    globalBindings[Symbol.for('__cloudflare-context__')]?.env ?? globalBindings;
  const db = env.DB;
  const bucket = env.BACKUPS_BUCKET;

  if (!db) {
    failCronCheckIn(cronCtx, CRON_NAME, new Error('DB binding unavailable'));
    return NextResponse.json(
      { ok: false, reason: 'DB binding unavailable' },
      { status: 500 },
    );
  }
  if (!bucket) {
    failCronCheckIn(cronCtx, CRON_NAME, new Error('BACKUPS_BUCKET binding unavailable'));
    return NextResponse.json(
      { ok: false, reason: 'BACKUPS_BUCKET binding unavailable' },
      { status: 500 },
    );
  }

  const bsConfig = {
    logsToken: process.env.BETTER_STACK_LOGS_TOKEN ?? '',
    ingestingHost: process.env.BETTER_STACK_INGESTING_HOST,
  };
  return executeD1BackupUpload({
    db, bucket, heartbeatUrl: env.BACKUP_HEARTBEAT_URL ?? '', bsConfig, cronCtx,
  });
}
