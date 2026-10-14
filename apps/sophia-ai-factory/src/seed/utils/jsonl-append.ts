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
import { logger } from '@/seed/utils/logger-utility';
import {
  recordFailure,
  recordSuccess,
  shouldAllowRequest,
} from '@/seed/security/circuit-breaker';
import {
  classifyError,
  FailureKind,
} from '@/seed/types/failure-kind';
import {
  JSONL_SERVICE_NAME as SERVICE_NAME,
  getAuditBucket,
  readJsonl,
  auditTrailHealth,
} from './jsonl-read-helpers';

export { getAuditBucket, readJsonl, auditTrailHealth };

const MAX_OBJECT_SIZE_BYTES = 95 * 1024 * 1024; // 95MB soft limit before rotation

export interface JsonlAppendResult {
  appended: number;
  totalLines: number;
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
