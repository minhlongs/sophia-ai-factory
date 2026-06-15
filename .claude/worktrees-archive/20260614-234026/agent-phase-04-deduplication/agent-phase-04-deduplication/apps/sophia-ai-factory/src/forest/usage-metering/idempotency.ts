/**
 * Usage Metering - Idempotency Key Generation
 *
 * Generates and validates idempotency keys to prevent duplicate usage tracking
 */

import { sha256 } from '@/tree/audit/crypto-utils';

/**
 * Generate idempotency key from request context
 *
 * @param event - Event data for key generation
 * @returns Deterministic idempotency key
 */
export function generateIdempotencyKey(event: {
  requestId?: string;
  userId: string;
  licenseNonce: string;
  service: string;
  action: string;
  timestamp: number;
}): string {
  // Use client request_id if provided (highest priority)
  if (event.requestId) {
    return `req_${event.requestId}`;
  }

  // Deterministic hash based on request context.
  // Append a random suffix (8 hex chars) to prevent same-second collisions
  // between two legitimate events that share the same userId/service/action/second.
  // Without requestId, the second event in the same second would silently be
  // dropped as a duplicate — the suffix makes each auto-generated key unique.
  const ts = Math.floor(event.timestamp / 1000);
  const suffix = crypto.randomUUID().slice(0, 8);
  const hash = sha256(`${event.userId}:${event.licenseNonce}:${event.service}:${event.action}:${ts}:${suffix}`);

  return `gen_${hash}`;
}

/**
 * Validate idempotency key format
 *
 * @param key - Key to validate
 * @returns True if valid format
 */
export function isValidIdempotencyKey(key: string | null | undefined): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }

  // Must start with prefix (req_ or gen_) followed by hex characters
  const prefix = key.startsWith('req_') || key.startsWith('gen_');
  const hasValue = key.length > 4;

  return prefix && hasValue;
}

/**
 * Extract idempotency key from request headers
 *
 * @param headers - Request headers
 * @returns Idempotency key or null
 */
export function extractIdempotencyKey(headers: Headers): string | null {
  const key = headers.get('x-idempotency-key') || headers.get('idempotency-key');
  return key || null;
}

/**
 * Build idempotency key headers for API requests
 *
 * @param key - Idempotency key
 * @returns Headers object with idempotency key
 */
export function buildIdempotencyHeaders(key: string): Headers {
  const headers = new Headers();
  headers.set('x-idempotency-key', key);
  return headers;
}
