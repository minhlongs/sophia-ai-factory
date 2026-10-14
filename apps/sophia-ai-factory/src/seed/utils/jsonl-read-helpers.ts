/**
 * JSONL Read and Audit Trail Health Check Helpers for Cloudflare R2.
 * @module seed/utils/jsonl-read-helpers
 */

import type { R2Bucket } from '@cloudflare/workers-types';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { logger } from '@/seed/utils/logger-utility';
import {
  recordFailure,
  recordSuccess,
  shouldAllowRequest,
} from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

export const JSONL_SERVICE_NAME = 'r2-jsonl-append';
const HEALTH_TOKEN_KEY = 'audit-trail-health';

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
 * Read JSONL records from an R2 object with optional filtering.
 */
export async function readJsonl<T extends Record<string, unknown>>(
  bucket: R2Bucket,
  key: string,
  filter?: (record: T) => boolean,
  limit = 100,
  offset = 0,
): Promise<{ records: T[]; total: number }> {
  if (!shouldAllowRequest(JSONL_SERVICE_NAME)) {
    logger.warn('[jsonl-read] Circuit breaker open — skipping read', { key });
    return { records: [], total: 0 };
  }

  try {
    const existing = await bucket.get(key);
    if (!existing) return { records: [], total: 0 };

    const body = await existing.text();
    const allLines = body.split('\n').filter((l) => l.length > 0);

    let parsed: T[];
    try {
      parsed = allLines.map((line) => JSON.parse(line) as T);
    } catch {
      logger.error('[jsonl-read] Malformed JSONL — returning partial', { key });
      return { records: [], total: 0 };
    }

    const filtered = filter ? parsed.filter(filter) : parsed;
    const sliced = filtered.slice(offset, offset + limit);

    recordSuccess(JSONL_SERVICE_NAME);
    return { records: sliced, total: filtered.length };
  } catch (err) {
    const kind = classifyError(err);
    recordFailure(JSONL_SERVICE_NAME, kind);
    throw err;
  }
}

/**
 * Health check for the audit trail JSONL store.
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
