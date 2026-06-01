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
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { pushHeartbeat, pushFatalLog } from '@/land/telemetry/better-stack-client';
import { getErrorMessage, toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';
import { buildD1Dump } from '@/forest/dr/d1-dump-builder';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'd1-backup';
/** Idempotency: skip if a backup already succeeded in the last 12 hours. */
const IDEMPOTENCY_WINDOW_MS = 12 * 60 * 60 * 1000;
/**
 * Hard ceiling on dump size — Workers have a 128 MiB memory limit and we
 * also double-buffer via TextEncoder. 50 MiB leaves headroom for the
 * encoding step + R2.put body buffer. Tables that push above this need a
 * streaming/multipart upload (future enhancement).
 */
const MAX_DUMP_BYTES = 50 * 1024 * 1024;

interface Env {
  DB?: D1Database;
  BACKUPS_BUCKET?: R2Bucket;
  BACKUP_HEARTBEAT_URL?: string;
  BETTER_STACK_LOGS_TOKEN?: string;
  BETTER_STACK_INGESTING_HOST?: string;
}

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
  const env = globalThis as unknown as Env;
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
  const heartbeatUrl = env.BACKUP_HEARTBEAT_URL ?? '';

  // Idempotency guard: avoid re-running within 12h window.
  // Even on skip we ping heartbeat + log to keep BetterStack happy and
  // surface the no-op in cron_run_log so missed runs vs. skipped runs are
  // distinguishable in incident review.
  const alreadyRan = await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS);
  if (alreadyRan) {
    if (heartbeatUrl) {
      await pushHeartbeat(heartbeatUrl).catch(() => {});
    }
    await recordCronRun(db, CRON_NAME, 'skipped');
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, skipped: true, reason: 'recently_run' });
  }
  const dateKey = new Date().toISOString().slice(0, 10);
  const objectKey = `d1-${dateKey}.sql`;
  const startedAt = Date.now();

  try {
    const dump = await buildD1Dump(db);
    const bytes = new TextEncoder().encode(dump);
    if (bytes.byteLength > MAX_DUMP_BYTES) {
      const sizeMb = (bytes.byteLength / 1024 / 1024).toFixed(1);
      const msg = `dump size ${sizeMb} MiB exceeds MAX_DUMP_BYTES (${MAX_DUMP_BYTES / 1024 / 1024} MiB) — implement streaming upload`;
      logger.error('[d1-backup] dump too large', new Error(msg), { sizeMb });
      await pushFatalLog('D1_BACKUP_TOO_LARGE', msg, bsConfig).catch(() => {});
      await recordCronRun(db, CRON_NAME, 'failure', msg);
      failCronCheckIn(cronCtx, CRON_NAME, new Error(msg));
      return NextResponse.json({ ok: false, reason: msg }, { status: 500 });
    }
    await bucket.put(objectKey, bytes, {
      httpMetadata: { contentType: 'application/sql' },
      customMetadata: {
        generatedAt: new Date(startedAt).toISOString(),
        sizeBytes: String(bytes.byteLength),
      },
    });

    const durationMs = Date.now() - startedAt;
    logger.info('[d1-backup] dump uploaded', {
      objectKey,
      sizeBytes: bytes.byteLength,
      durationMs,
    });

    // Heartbeat (best-effort)
    if (heartbeatUrl) {
      await pushHeartbeat(heartbeatUrl).catch((err) =>
        logger.warn('[d1-backup] heartbeat push failed', toError(err)),
      );
    }

    await recordCronRun(db, CRON_NAME, 'success');

    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({
      ok: true,
      objectKey,
      sizeBytes: bytes.byteLength,
      durationMs,
    });
  } catch (err) {
    const errMsg = getErrorMessage(err);
    logger.error('[d1-backup] dump failed', toError(err), { objectKey });
    await pushFatalLog('D1_BACKUP_FAILED', errMsg, bsConfig).catch(() => {});
    await recordCronRun(db, CRON_NAME, 'failure', errMsg);
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ ok: false, reason: errMsg }, { status: 500 });
  }
}
