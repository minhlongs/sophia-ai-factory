/**
 * JSONL Append Utility — append-only JSONL file writer for R2.
 *
 * Reads the existing object, appends new line-delimited JSON records,
 * and writes back in a single atomic put. Suitable for audit trails,
 * event logs, and append-only data stores on Cloudflare R2.
 *
 * Limitations (inherent to R2 put-overwrite):
 * - Not atomic under concurrent writers; last-writer-wins.
 *   Use a D1 advisory lock or mutex for high-concurrency paths.
 * - Large files (>100MB) should be rotated to a new key.
 */

import type { R2Bucket } from '@cloudflare/workers-types';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { logger } from '@/seed/utils/logger-utility';
import {
  recordFailure,
  recordSuccess,
  shouldAllowRequest,
} from '@/seed/security/circuit-breaker';
import {
  classifyError,
  classifyHttpStatus,
  FailureKind,
} from '@/seed/types/failure-kind';

const SERVICE_NAME = 'r2-jsonl-append';
const MAX_OBJECT_SIZE_BYTES = 95 * 1024 * 1024; // 95MB soft limit before rotation
const HEALTH_TOKEN_KEY = 'audit-trail-health';

export interface JsonlAppendResult {
  appended: number;
  totalLines: number;
}

/**
 * Retrieve the AUDIT_BUCKET R2 binding from Cloudflare Workers runtime.
 * Returns null when binding is unavailable (local dev, test, or misconfigured).
 */
export async function getAuditBucket(): Promise<R2Bucket | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = (env as { AUDIT_BUCKET?: R2Bucket }).AUDIT_BUCKET;
    return bucket ?? null;
  } catch {
    return null;
  }
}

/**
 * Append one or more JSONL records to an R2 object.
 *
 * @param bucket   - R2Bucket binding
 * @param key      - Object key (e.g. 'audit/byok/{tenantId}.jsonl')
 * @param records  - Objects to serialize as JSONL lines
 * @returns        - Number of lines appended and total line count
 */
export async function appendJsonl(
  bucket: R2Bucket,
  key: string,
  records: Record<string, unknown>[],
): Promise<JsonlAppendResult> {
  if (records.length === 0) return { appended: 0, totalLines: 0 };

  if (!shouldAllowRequest(SERVICE_NAME)) {
    logger.warn('[jsonl-append] Circuit breaker open — skipping append', { key });
    return { appended: 0, totalLines: 0 };
  }

  try {
    const existing = await bucket.get(key);
    let existingBody = '';

    if (existing) {
      const size = existing.size ?? 0;
      if (size > MAX_OBJECT_SIZE_BYTES) {
        logger.warn('[jsonl-append] Object exceeds soft size limit — skipping', {
          key,
          size,
        });
        recordFailure(SERVICE_NAME, FailureKind.SERVER_ERROR);
        return { appended: 0, totalLines: 0 };
      }
      existingBody = await existing.text();
    }

    const newLines = records
      .map((r) => JSON.stringify(r))
      .join('\n');
    const separator = existingBody.endsWith('\n') || existingBody.length === 0
      ? ''
      : '\n';
    const combined = existingBody + separator + newLines + '\n';

    await bucket.put(key, combined, {
      httpMetadata: { contentType: 'application/jsonl' },
    });

    const totalLines = combined.split('\n').filter((l) => l.length > 0).length;

    recordSuccess(SERVICE_NAME);
    return { appended: records.length, totalLines };
  } catch (err) {
    const kind = classifyError(err);
    recordFailure(SERVICE_NAME, kind);
    throw err;
  }
}

/**
 * Read JSONL records from an R2 object with optional filtering.
 *
 * @param bucket       - R2Bucket binding
 * @param key          - Object key
 * @param filter       - Optional predicate to filter records
 * @param limit        - Max records to return (default 100)
 * @param offset       - Records to skip (default 0)
 * @returns            - Filtered records, total count before limit/offset
 */
export async function readJsonl<T extends Record<string, unknown>>(
  bucket: R2Bucket,
  key: string,
  filter?: (record: T) => boolean,
  limit = 100,
  offset = 0,
): Promise<{ records: T[]; total: number }> {
  if (!shouldAllowRequest(SERVICE_NAME)) {
    logger.warn('[jsonl-read] Circuit breaker open — skipping read', { key });
    return { records: [], total: 0 };
  }

  try {
    const existing = await bucket.get(key);
    if (!existing) return { records: [], total: 0 };

    const body = await existing.text();
    const allLines = body
      .split('\n')
      .filter((l) => l.length > 0);

    let parsed: T[];
    try {
      parsed = allLines.map((line) => JSON.parse(line) as T);
    } catch {
      logger.error('[jsonl-read] Malformed JSONL — returning partial', { key });
      return { records: [], total: 0 };
    }

    const filtered = filter ? parsed.filter(filter) : parsed;
    const sliced = filtered.slice(offset, offset + limit);

    recordSuccess(SERVICE_NAME);
    return { records: sliced, total: filtered.length };
  } catch (err) {
    const kind = classifyError(err);
    recordFailure(SERVICE_NAME, kind);
    throw err;
  }
}

/**
 * Health check for the audit trail JSONL store.
 * Returns status and basic metrics about the audit trail.
 */
export async function auditTrailHealth(): Promise<{
  status: 'ok' | 'error' | 'unavailable';
  bucketAvailable: boolean;
  error?: string;
}> {
  try {
    const bucket = await getAuditBucket();
    if (!bucket) {
      return { status: 'unavailable', bucketAvailable: false };
    }

    const probe = await bucket.get(HEALTH_TOKEN_KEY);
    if (!probe) {
      await bucket.put(HEALTH_TOKEN_KEY, new Date().toISOString(), {
        httpMetadata: { contentType: 'text/plain' },
      });
    }

    return { status: 'ok', bucketAvailable: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'unknown';
    logger.error('[jsonl-append] Audit trail health check failed', {
      error: errorMessage,
    });
    return {
      status: 'error',
      bucketAvailable: false,
      error: 'Health check failed',
    };
  }
}
