import { verifyInboundWebhook } from '@/land/webhooks/signature';

/**
 * PayOS canonicalization: sort data keys alphabetically, join as key=value&...
 * Receives raw JSON string from request body; parses and re-serializes as canonical string.
 * PayOS IPN spec — signature covers sorted key=value pairs from the `data` object.
 */
export function payOsCanonicalize(rawBody: string): string {
  const parsed = JSON.parse(rawBody) as { data?: Record<string, unknown> };
  // PayOS signs over the `data` sub-object keys, not the full payload
  const dataObj = parsed.data ?? (parsed as Record<string, unknown>);
  return Object.keys(dataObj)
    .sort()
    .map((k) => {
      const value = dataObj[k];
      const normalized =
        value === null || value === undefined || value === 'null' || value === 'undefined'
          ? ''
          : typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
      return `${k}=${normalized}`;
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
