import { buildD1Dump } from './d1-dump-builder';

export const CRON_NAME = 'd1-backup';
export const IDEMPOTENCY_WINDOW_MS = 12 * 60 * 60 * 1000;
export const MAX_DUMP_BYTES = 50 * 1024 * 1024;

export interface D1BackupEnv {
  DB?: D1Database;
  BACKUPS_BUCKET?: R2Bucket;
  BACKUP_HEARTBEAT_URL?: string;
}

export type BackupResult = {
  ok: boolean;
  reason?: string;
  skipped?: boolean;
  artifactPresent?: boolean;
  objectKey?: string;
  sizeBytes?: number;
  durationMs?: number;
  reusedExistingArtifact?: boolean;
};

function validArtifact(object: R2Object | null): object is R2Object {
  return object !== null && object.size > 0 && object.size <= MAX_DUMP_BYTES &&
    object.httpMetadata?.contentType === 'application/sql' &&
    object.customMetadata?.sizeBytes === String(object.size) &&
    Number.isFinite(Date.parse(object.customMetadata?.generatedAt ?? ''));
}

async function record(db: D1Database, status: 'success' | 'failure', threshold: number): Promise<void> {
  // Preserve a concurrent recent success on failure. D1 and R2 are not one transaction:
  // competing runs can both dump, and a delayed success may outlive another lookup.
  const result = await db.prepare(`INSERT INTO cron_run_log
    (cron_name, last_run_at, last_status, last_error, run_count) VALUES (?1, ?2, ?3, ?4, 1)
    ON CONFLICT(cron_name) DO UPDATE SET last_run_at = excluded.last_run_at,
    last_status = excluded.last_status, last_error = excluded.last_error,
    run_count = cron_run_log.run_count + 1
    WHERE excluded.last_status = 'success' OR cron_run_log.last_status != 'success'
      OR cron_run_log.last_run_at < ?5`)
    .bind(CRON_NAME, Math.floor(Date.now() / 1000), status, status === 'failure' ? 'backup_failed' : null, threshold).run();
  if (!result.success) throw new Error('backup_tracking_failed');
}

async function resolveOrUploadArtifact(
  db: D1Database,
  bucket: R2Bucket,
  objectKey: string,
  startedAt: number,
): Promise<{ artifact: R2Object; reusedExistingArtifact: boolean }> {
  const existing = await bucket.head(objectKey);
  if (existing) {
    if (!validArtifact(existing)) throw new Error('invalid_backup_artifact');
    return { artifact: existing, reusedExistingArtifact: true };
  }
  const bytes = new TextEncoder().encode(await buildD1Dump(db));
  if (bytes.byteLength > MAX_DUMP_BYTES) throw new Error('backup_too_large');
  const uploaded = await bucket.put(objectKey, bytes, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: 'application/sql' },
    customMetadata: { generatedAt: new Date(startedAt).toISOString(), sizeBytes: String(bytes.byteLength) },
  });
  if (uploaded) return { artifact: uploaded, reusedExistingArtifact: false };
  const winner = await bucket.head(objectKey);
  if (!validArtifact(winner)) throw new Error('invalid_backup_artifact');
  return { artifact: winner, reusedExistingArtifact: true };
}

/** Trusted binding-only entry point: no HTTP, framework, logger, or telemetry imports. */
export async function runScheduledD1Backup(env: D1BackupEnv): Promise<BackupResult> {
  const { DB: db, BACKUPS_BUCKET: bucket } = env;
  if (!db || !bucket) return { ok: false, reason: !db ? 'DB binding unavailable' : 'BACKUPS_BUCKET binding unavailable' };
  const startedAt = Date.now();
  const threshold = Math.floor((startedAt - IDEMPOTENCY_WINDOW_MS) / 1000);
  const objectKey = `d1-${new Date(startedAt).toISOString().slice(0, 10)}.sql`;
  try {
    const row = await db.prepare(`SELECT last_run_at FROM cron_run_log
      WHERE cron_name = ?1 AND last_run_at >= ?2 AND last_status = 'success' LIMIT 1`)
      .bind(CRON_NAME, threshold).first<{ last_run_at: number }>();
    if (row) return { ok: true, skipped: true, reason: 'recently_run' };
  } catch {
    return { ok: false, reason: 'backup_tracking_failed' };
  }

  let resolved: { artifact: R2Object; reusedExistingArtifact: boolean };
  try {
    resolved = await resolveOrUploadArtifact(db, bucket, objectKey, startedAt);
  } catch {
    try { await record(db, 'failure', threshold); } catch {
      return { ok: false, reason: 'backup_failed', objectKey, artifactPresent: false };
    }
    return { ok: false, reason: 'backup_failed', objectKey, artifactPresent: false };
  }
  const confirmed = {
    objectKey,
    artifactPresent: true,
    sizeBytes: resolved.artifact.size,
    reusedExistingArtifact: resolved.reusedExistingArtifact,
    durationMs: Date.now() - startedAt,
  };
  try { await record(db, 'success', threshold); } catch {
    return { ok: false, reason: 'backup_tracking_failed', ...confirmed };
  }
  return { ok: true, ...confirmed };
}
