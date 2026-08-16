/**
 * BYOK Audit Writer — append-only JSONL audit trail for BYOK key events.
 *
 * Writes structured audit events to R2 via the JSONL append utility.
 * Events include: key.created, key.rotated, key.revoked, key.used, key.validation_failed.
 *
 * Security: API keys are NEVER logged — only 4-char prefix + provider name.
 * No PII beyond tenant ID is stored in audit events.
 *
 * @module tree/byok/byok-audit-writer
 */

import { z } from 'zod';
import { getAuditBucket, appendJsonl } from '@/seed/utils/jsonl-append';
import { logger } from '@/seed/utils/logger-utility';
import {
  recordFailure,
  recordSuccess,
  shouldAllowRequest,
} from '@/seed/security/circuit-breaker';
import { classifyError, FailureKind } from '@/seed/types/failure-kind';

const SERVICE_NAME = 'byok-audit-writer';

export const AuditEventSchema = z.object({
  ts: z.string().describe('ISO-8601 timestamp'),
  tenantId: z.string().describe('Tenant identifier'),
  event: z.enum([
    'key.created',
    'key.rotated',
    'key.revoked',
    'key.used',
    'key.validation_failed',
  ]),
  provider: z.string().describe('Provider name (openrouter, elevenlabs, d-id, etc.)'),
  keyPrefix: z.string().describe('First 4 characters of the API key'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional event context'),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

/**
 * Redact an API key to a safe 4-character prefix.
 * Never logs the full key.
 */
export function redactKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 4) return '****';
  return apiKey.slice(0, 4);
}

/**
 * R2 object key for a tenant's BYOK audit trail.
 */
function auditKey(tenantId: string): string {
  return `audit/byok/${tenantId}.jsonl`;
}

/**
 * Write a BYOK audit event to R2.
 *
 * @param tenantId  - The tenant who owns the key
 * @param event     - Audit event type
 * @param provider  - Provider name
 * @param apiKey    - The raw API key (will be redacted before logging)
 * @param metadata  - Optional extra context for the event
 */
export async function writeByokAuditEvent(
  tenantId: string,
  event: AuditEvent['event'],
  provider: string,
  apiKey: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!shouldAllowRequest(SERVICE_NAME)) {
    logger.warn('[byok-audit] Circuit breaker open — skipping audit write', {
      tenantId,
      event,
      provider,
    });
    return;
  }

  try {
    const bucket = await getAuditBucket();
    if (!bucket) {
      logger.warn('[byok-audit] AUDIT_BUCKET unavailable — audit event dropped', {
        tenantId,
        event,
        provider,
      });
      recordFailure(SERVICE_NAME, FailureKind.SERVER_ERROR);
      return;
    }

    const auditRecord: AuditEvent = {
      ts: new Date().toISOString(),
      tenantId,
      event,
      provider,
      keyPrefix: redactKey(apiKey),
      ...(metadata ? { metadata } : {}),
    };

    const validated = AuditEventSchema.safeParse(auditRecord);
    if (!validated.success) {
      logger.error('[byok-audit] Invalid audit event', undefined, {
        tenantId,
        event,
        provider,
        errors: validated.error.format(),
      });
      return;
    }

    const key = auditKey(tenantId);
    const result = await appendJsonl(bucket, key, [validated.data]);

    recordSuccess(SERVICE_NAME);
    logger.debug('[byok-audit] Event written', {
      tenantId,
      event,
      provider,
      keyPrefix: auditRecord.keyPrefix,
      appended: result.appended,
      totalLines: result.totalLines,
    });
  } catch (err) {
    const kind = classifyError(err);
    recordFailure(SERVICE_NAME, kind);
    logger.error('[byok-audit] Failed to write audit event', undefined, {
      tenantId,
      event,
      provider,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
}
