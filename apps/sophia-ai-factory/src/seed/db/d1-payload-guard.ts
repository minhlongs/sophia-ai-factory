/**
 * SEC-08: Cloudflare D1 1 MiB Row/Statement Size & Base64 Media Guard
 *
 * Prevents `SQLITE_TOOBIG` (1,048,576 bytes limit) and blocks raw base64 media
 * blobs from being persisted in D1 columns instead of Cloudflare R2 object keys.
 *
 * Layer: seed (foundational primitive)
 * @module seed/db/d1-payload-guard
 */

import { failure, success, type Result } from '@/seed/types/result';

export const D1_MAX_STATEMENT_BYTES = 1_048_576; // 1 MiB Cloudflare D1 hard limit
export const D1_SAFE_ROW_CEILING_BYTES = 900_000; // 900 KB guard ceiling with safety margin

const BASE64_MEDIA_DATA_URI_REGEX =
  /^data:(?:video|audio|image|application\/octet-stream)\/[a-zA-Z0-9.+-]*;base64,/i;

export interface D1PayloadViolation {
  readonly code: 'D1_BASE64_MEDIA_FORBIDDEN' | 'D1_PAYLOAD_TOO_LARGE';
  readonly message: string;
  readonly byteLength: number;
  readonly offendingField?: string;
}

function findBase64MediaField(value: unknown, path = 'root'): string | null {
  if (typeof value === 'string') {
    if (BASE64_MEDIA_DATA_URI_REGEX.test(value.trim())) {
      return path;
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findBase64MediaField(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const hit = findBase64MediaField(v, `${path}.${k}`);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Validates that a row or parameters destined for D1 contain no inline base64 media
 * data URIs and stay strictly below the 1 MiB D1 row/statement limit.
 */
export function assertD1PayloadCompliance(
  payload: unknown,
  maxBytes: number = D1_SAFE_ROW_CEILING_BYTES,
): Result<{ byteLength: number }, D1PayloadViolation> {
  const offendingField = findBase64MediaField(payload);
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
  const byteLength = new TextEncoder().encode(serialized).byteLength;

  if (offendingField) {
    return failure({
      code: 'D1_BASE64_MEDIA_FORBIDDEN',
      message: `Inline base64 media is forbidden in D1 (${offendingField}); store media in R2 and persist the r2:// key instead.`,
      byteLength,
      offendingField,
    });
  }

  const effectiveLimit = Math.min(maxBytes, D1_MAX_STATEMENT_BYTES);
  if (byteLength > effectiveLimit) {
    return failure({
      code: 'D1_PAYLOAD_TOO_LARGE',
      message: `D1 payload size (${byteLength} bytes) exceeds safe ceiling (${effectiveLimit} bytes).`,
      byteLength,
    });
  }

  return success({ byteLength });
}
