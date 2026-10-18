/**
 * BYOK Audit Schema & Key Redaction Helpers.
 *
 * Security: API keys are NEVER logged — only 4-char prefix + provider name.
 *
 * @module tree/byok/byok-audit-schema
 */

import { z } from 'zod';

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
export function auditKey(tenantId: string): string {
  return `audit/byok/${tenantId}.jsonl`;
}
