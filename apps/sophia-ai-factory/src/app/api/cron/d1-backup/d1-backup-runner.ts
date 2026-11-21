import { NextResponse } from 'next/server';
import { runScheduledD1Backup } from '@/forest/dr/scheduled-d1-backup';
import { pushHeartbeat, pushFatalLog } from '@/seed/observability/telemetry/better-stack-client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { startCronCheckIn, finishCronCheckIn, failCronCheckIn } from '@/seed/observability/cron-check-in';

export { CRON_NAME, IDEMPOTENCY_WINDOW_MS, MAX_DUMP_BYTES, type D1BackupEnv } from '@/forest/dr/scheduled-d1-backup';

/** HTTP adapter preserves telemetry; the scheduled entry point never loads this module. */
export async function executeD1BackupUpload(params: {
  db: D1Database;
  bucket: R2Bucket;
  heartbeatUrl: string;
  bsConfig: { logsToken: string; ingestingHost?: string };
  cronCtx: ReturnType<typeof startCronCheckIn>;
}): Promise<NextResponse> {
  const { db, bucket, heartbeatUrl, bsConfig, cronCtx } = params;
  const result = await runScheduledD1Backup({ DB: db, BACKUPS_BUCKET: bucket });
  if (result.ok) {
    if (heartbeatUrl) await pushHeartbeat(heartbeatUrl).catch((error) => logger.warn('[d1-backup] heartbeat push failed', toError(error)));
    finishCronCheckIn(cronCtx, 'd1-backup');
  } else {
    const error = new Error(result.reason);
    logger.error('[d1-backup] execution failed', error, { artifactPresent: result.artifactPresent });
    await pushFatalLog('D1_BACKUP_FAILED', result.reason ?? 'backup_failed', bsConfig)
      .catch((failure) => logger.warn('[d1-backup] failure notification failed', toError(failure)));
    failCronCheckIn(cronCtx, 'd1-backup', error);
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
