import { ENC, hexToBytes, importHmacKey } from './crypto-utils';
import { parseHeader } from './header-parser';
import type { VerifyOptions } from './types';

/**
 * Sign a webhook body.
 * Returns header value: `t=<unix>,v1=<hmac-hex>`
 */
export async function signWebhook(
  body: string,
  secret: string,
  ts: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const toSign = `${ts}.${body}`;
  const key = await importHmacKey(secret, 'sign');
  const sigBuf = await crypto.subtle.sign('HMAC', key, ENC.encode(toSign));
  const hex = Array.from(new Uint8Array(sigBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `t=${ts},v1=${hex}`;
}

/**
 * Verify a webhook signature header.
 */
export async function verifyWebhook(
  body: string,
  signature: string,
  secret: string,
  opts: VerifyOptions = {},
): Promise<boolean> {
  const { toleranceSec = 300, acceptLegacy = false } = opts;

  // ── New format: `t=<ts>,v1=<hex>` ──────────────────────────────────────
  if (signature.includes('t=') && signature.includes('v1=')) {
    const parsed = parseHeader(signature);
    if (!parsed) return false;

    // Replay protection
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parsed.ts) > toleranceSec) return false;

    const toSign = `${parsed.ts}.${body}`;
    try {
      const key = await importHmacKey(secret, 'verify');
      const expectedBytes = hexToBytes(parsed.v1);
      return crypto.subtle.verify('HMAC', key, expectedBytes.buffer as ArrayBuffer, ENC.encode(toSign));
    } catch {
      return false;
    }
  }

  // ── Legacy format: bare hex (no timestamp prefix) ───────────────────────
  if (acceptLegacy && /^[0-9a-f]{64}$/i.test(signature)) {
    try {
      const key = await importHmacKey(secret, 'verify');
      const sigBytes = hexToBytes(signature.toLowerCase());
      // Legacy: signed over raw body (no timestamp prefix)
      return crypto.subtle.verify('HMAC', key, sigBytes.buffer as ArrayBuffer, ENC.encode(body));
    } catch {
      return false;
    }
  }

  return false;
}
