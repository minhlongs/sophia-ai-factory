/**
 * SOP Webhook HMAC Low-Level Crypto Primitives
 *
 * Layer: seed/sop
 * @module seed/sop/webhook-hmac-crypto
 */

const ENC = new TextEncoder();

export function parseWebhookSignatureHeader(header: string): { ts: number; v1: string } | null {
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

export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function importHmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    ENC.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  );
}

export async function signWebhookHmac(
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

export async function verifyWebhookHmac(
  body: string,
  signature: string,
  secret: string,
  opts: { toleranceSec: number; acceptLegacy: boolean },
): Promise<boolean> {
  if (signature.includes('t=') && signature.includes('v1=')) {
    const parsed = parseWebhookSignatureHeader(signature);
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
