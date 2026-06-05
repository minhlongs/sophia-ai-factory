/**
 * SOP Webhook HMAC — sign + verify
 *
 * Stripe-style signature format: `t=<unix>,v1=<hex>`
 * Header name: X-Sophia-Signature
 *
 * Each SOP installation gets a 32-byte random secret stored encrypted
 * in customizations.webhookSecret. Phase 3 generates it at install time.
 *
 * For Phase 2: sign/verify helpers only — secret management in Phase 3.
 *
 * Migrated (Wave 13 G-I3): inline HMAC replaced with unified verifyWebhook
 * from lib/webhooks/signature. acceptLegacy=true for 1 release cycle (~14 days).
 */

import { logger } from '@/seed/utils/logger-utility';

const ENC = new TextEncoder();

function parseHeader(header: string): { ts: number; v1: string } | null {
  let ts: number | undefined;
  let v1: string | undefined;
  for (const part of header.split(',')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const k = part.slice(0, eqIdx).trim();
    const v = part.slice(eqIdx + 1).trim();
    if (k === 't') ts = parseInt(v, 10);
    if (k === 'v1') v1 = v;
  }
  if (ts === undefined || Number.isNaN(ts) || !v1) return null;
  return { ts, v1 };
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function importHmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    ENC.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  );
}

async function signWebhook(
  body: string,
  secret: string,
  ts: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const key = await importHmacKey(secret, 'sign');
  const sigBuf = await crypto.subtle.sign('HMAC', key, ENC.encode(`${ts}.${body}`));
  const hex = Array.from(new Uint8Array(sigBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `t=${ts},v1=${hex}`;
}

async function verifyWebhook(
  body: string,
  signature: string,
  secret: string,
  opts: { toleranceSec: number; acceptLegacy: boolean },
): Promise<boolean> {
  if (signature.includes('t=') && signature.includes('v1=')) {
    const parsed = parseHeader(signature);
    if (!parsed) return false;

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parsed.ts) > opts.toleranceSec) return false;

    try {
      const key = await importHmacKey(secret, 'verify');
      const expectedBytes = hexToBytes(parsed.v1);
      return crypto.subtle.verify('HMAC', key, expectedBytes.buffer as ArrayBuffer, ENC.encode(`${parsed.ts}.${body}`));
    } catch {
      return false;
    }
  }

  if (opts.acceptLegacy && /^[0-9a-f]{64}$/i.test(signature)) {
    try {
      const key = await importHmacKey(secret, 'verify');
      const sigBytes = hexToBytes(signature.toLowerCase());
      return crypto.subtle.verify('HMAC', key, sigBytes.buffer as ArrayBuffer, ENC.encode(body));
    } catch {
      return false;
    }
  }

  return false;
}

/** Generate a random 32-byte webhook secret (hex-encoded) */
export function generateWebhookSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sign a request body with HMAC-SHA256.
 * Returns header value: `t=<unix>,v1=<hex>`
 */
export async function signPayload(
  body: string,
  secret: string,
  timestamp?: number,
): Promise<string> {
  return signWebhook(body, secret, timestamp);
}

/**
 * Verify a webhook signature header.
 * Returns true if valid, false otherwise.
 * Rejects signatures older than toleranceSec (default 300s = 5 min).
 *
 * acceptLegacy=true: bare-hex format still accepted for backwards compat
 * (deprecation timeline: 1 release cycle ~14 days from Wave 13).
 */
export async function verifySignature(
  body: string,
  signatureHeader: string,
  secret: string,
  toleranceSec = 300,
): Promise<boolean> {
  // Legacy bare-hex format detected — emit monitoring event
  if (/^[0-9a-f]{64}$/i.test(signatureHeader)) {
    logger.warn('webhook_legacy_signature_used', {
      event: 'webhook_legacy_signature_used',
      sender: 'sop/webhook-hmac',
    });
  }
  return verifyWebhook(body, signatureHeader, secret, {
    toleranceSec,
    acceptLegacy: true,
  });
}
