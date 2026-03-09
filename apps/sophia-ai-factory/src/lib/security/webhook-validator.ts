/**
 * Webhook Signature Validator
 *
 * Utility for verifying webhook signatures from external services.
 * Supports HMAC-SHA256 signature verification.
 */

import crypto from 'crypto';

/**
 * Verify HMAC-SHA256 webhook signature
 *
 * @param signature - Webhook signature from header
 * @param timestamp - Timestamp from header
 * @param secret - Webhook secret key
 * @param tolerance - Tolerance in seconds (default: 5 minutes)
 * @returns true if signature is valid
 */
export function verifyWebhookSignature(
  signature: string,
  timestamp: string,
  secret: string,
  tolerance: number = 300
): boolean {
  try {
    // Check timestamp freshness
    const now = Math.floor(Date.now() / 1000);
    const timestampNum = parseInt(timestamp, 10);

    if (isNaN(timestampNum) || Math.abs(now - timestampNum) > tolerance) {
      return false;
    }

    // Verify signature (format: v1=signature)
    const [version, sig] = signature.split('=');
    if (version !== 'v1' || !sig) {
      return false;
    }

    // Create expected signature
    const signedPayload = `${timestamp}.${sig}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    // Constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(sig, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Generate HMAC signature for webhook
 *
 * @param payload - Webhook payload string
 * @param secret - Webhook secret key
 * @returns Signature string (v1=...)
 */
export function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000)
): string {
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return `v1=${signature}`;
}
