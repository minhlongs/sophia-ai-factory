import { verifyInboundWebhook } from '@/land/webhooks/signature';

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortDeep(obj[key]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * PayOS canonicalization: sort data keys alphabetically, join as key=value&...
 * Receives raw JSON string from request body; parses and re-serializes as canonical string.
 * PayOS IPN spec — signature covers sorted key=value pairs from the `data` object,
 * with nested objects and array element objects recursively key-sorted before JSON serialization.
 */
export function payOsCanonicalize(rawBody: string): string {
  const parsed = JSON.parse(rawBody) as { data?: Record<string, unknown> };
  // PayOS signs over the `data` sub-object keys, not the full payload
  const dataObj = parsed.data ?? (parsed as Record<string, unknown>);
  return Object.keys(dataObj)
    .sort()
    .map((k) => {
      const value = dataObj[k];
      if (value === null || value === undefined || value === 'null' || value === 'undefined') {
        return `${k}=`;
      }
      if (typeof value === 'object') {
        return `${k}=${JSON.stringify(sortDeep(value))}`;
      }
      return `${k}=${String(value)}`;
    })
    .join('&');
}

/**
 * Verify PayOS IPN webhook signature using HMAC-SHA256.
 * Accepts raw body string (must be captured via request.text() before JSON.parse).
 * Uses unified verifyInboundWebhook with SHA-256 + payos canonicalization.
 *
 * @param rawBody    - Raw request body string (NOT parsed JSON)
 * @param signature  - x-checksum header value from PayOS
 * @param checksumKey - PAYOS_CHECKSUM_KEY secret
 */
export async function verifyPayOsWebhook(
  rawBody: string,
  signature: string,
  checksumKey: string,
): Promise<boolean> {
  return verifyInboundWebhook(rawBody, signature, checksumKey, {
    algo: 'SHA-256',
    canonicalize: payOsCanonicalize,
  });
}
