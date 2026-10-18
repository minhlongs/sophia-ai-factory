/**
 * D1 Backup Cron Execution Helpers
 *
 * @module app/api/cron/d1-backup/d1-backup-runner
 */

import { NextResponse } from 'next/server';
import { recordCronRun } from '@/land/cron/run-tracker';
import { pushHeartbeat, pushFatalLog } from '@/seed/observability/telemetry/better-stack-client';
import { getErrorMessage, toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';
import { buildD1Dump } from '@/forest/dr/d1-dump-builder';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';

export const CRON_NAME = 'd1-backup';
/** Idempotency: skip if a backup already succeeded in the last 12 hours. */
export const IDEMPOTENCY_WINDOW_MS = 12 * 60 * 60 * 1000;
/**
 * Hard ceiling on dump size — Workers have a 128 MiB memory limit and we
 * also double-buffer via TextEncoder. 50 MiB leaves headroom for the
 * encoding step + R2.put body buffer.
 */
export const MAX_DUMP_BYTES = 50 * 1024 * 1024;

export interface D1BackupEnv {
  DB?: D1Database;
  BACKUPS_BUCKET?: R2Bucket;
  BACKUP_HEARTBEAT_URL?: string;
  BETTER_STACK_LOGS_TOKEN?: string;
  BETTER_STACK_INGESTING_HOST?: string;
}

export async function executeD1BackupUpload(params: {
  db: D1Database;
  bucket: R2Bucket;
  heartbeatUrl: string;
  bsConfig: { logsToken: string; ingestingHost?: string };
  cronCtx: ReturnType<typeof startCronCheckIn>;
}): Promise<NextResponse> {
  const { db, bucket, heartbeatUrl, bsConfig, cronCtx } = params;
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
