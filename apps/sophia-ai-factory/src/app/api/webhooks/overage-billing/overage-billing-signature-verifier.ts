/**
 * Signature verification helpers for overage billing webhook
 *
 * Supports Standard Webhooks and Cloudflare queue HMAC-SHA256 signatures.
 * Uses Web Crypto / timing-safe comparison and rejects banned Polar-Signature.
 */

import { Webhook } from 'standardwebhooks';
import { verifyInboundWebhook } from '@/seed/security/signature';

/**
 * Verify Standard Webhooks signature using timing-safe comparison.
 */
export async function verifySignature(
  body: string,
  headers: Record<string, string | undefined>,
  secret: string,
): Promise<boolean> {
  if (headers['Polar-Signature']) {
    return false;
  }

  try {
    const wh = new Webhook(secret);
    const signature = headers['webhook-signature'];
    if (!signature) {
      return false;
    }

    wh.verify(body, {
      'webhook-id': headers['webhook-id'] ?? '',
      'webhook-timestamp': headers['webhook-timestamp'] ?? '',
      'webhook-signature': signature,
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Verify HMAC-SHA256 signature over rawBody with Web Crypto constant-time comparison.
 */
export async function verifyHmacSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const normalized = signature.trim().replace(/^sha256=/i, '');
  if (!normalized || !secret) return false;
  return verifyInboundWebhook(body, normalized, secret, { algo: 'SHA-256' });
}

/**
 * Verify Cloudflare queue event signature asynchronously over rawBody.
 */
export async function verifyCloudflareSignature(
  body: string,
  signature: string | undefined,
  expectedSecret: string,
): Promise<boolean> {
  if (!signature || !expectedSecret) {
    return false;
  }

  return verifyHmacSignature(body, signature, expectedSecret);
}
