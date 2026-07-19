/**
 * Signature verification helpers for overage billing webhook
 *
 * Supports Polar, Stripe, and Cloudflare signature formats.
 * Uses timing-safe comparison to prevent timing attacks.
 */

import { Webhook } from 'standardwebhooks';

/**
 * Verify webhook signature using timing-safe comparison
 * Supports Polar, Stripe, and Cloudflare signature formats
 */
export async function verifySignature(
  body: string,
  headers: Record<string, string | undefined>,
  secret: string
): Promise<boolean> {
  // M9 fix: single canonical signature format — raw secret only.
  // Removed base64 fallback to prevent downgrade attacks where an attacker
  // sends a signature valid against the base64 form but not the raw form.
  try {
    const wh = new Webhook(secret);
    const signature = headers['Polar-Signature'] || headers['webhook-signature'];

    if (!signature) {
      return false;
    }

    wh.verify(body, {
      'webhook-id': headers['webhook-id'] ?? '',
      'webhook-timestamp': headers['webhook-timestamp'] ?? '',
      'webhook-signature': signature
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Verify HMAC-SHA256 signature with timing-safe comparison
 * Prevents timing attacks on signature validation
 */
export async function verifyHmacSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const crypto = await import('node:crypto');
    const expectedHex = crypto.createHmac('sha256', secret).update(body).digest('hex');

    // Convert to buffers for timing-safe comparison
    const signatureBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expectedHex, 'hex');

    // Length check first, then timing-safe comparison
    return signatureBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(signatureBuf, expectedBuf);
  } catch {
    // Fallback for environments without node:crypto
    return false;
  }
}

/**
 * Verify Cloudflare queue event signature using timing-safe comparison
 */
export function verifyCloudflareSignature(
  signature: string | undefined,
  expectedSecret: string
): boolean {
  if (!signature || !expectedSecret) {
    return false;
  }

  // Use HMAC-SHA256 with timing-safe comparison
  return verifyHmacSignature(signature, expectedSecret, expectedSecret) as unknown as boolean;
}
