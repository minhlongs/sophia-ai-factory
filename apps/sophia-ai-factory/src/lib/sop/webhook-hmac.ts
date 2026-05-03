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
 */

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
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const toSign = `${ts}.${body}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

  return `t=${ts},v1=${hex}`;
}

/**
 * Verify a webhook signature header.
 * Returns true if valid, false otherwise.
 * Rejects signatures older than toleranceSec (default 300s = 5 min).
 */
export async function verifySignature(
  body: string,
  signatureHeader: string,
  secret: string,
  toleranceSec = 300,
): Promise<boolean> {
  try {
    const parts = parseSignatureHeader(signatureHeader);
    if (!parts) return false;

    const { ts, v1 } = parts;
    const now = Math.floor(Date.now() / 1000);

    // Replay protection
    if (Math.abs(now - ts) > toleranceSec) return false;

    const toSign = `${ts}.${body}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const expectedBytes = hexToBytes(v1).buffer as ArrayBuffer;
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      expectedBytes,
      new TextEncoder().encode(toSign),
    );

    return isValid;
  } catch {
    return false;
  }
}

function parseSignatureHeader(header: string): { ts: number; v1: string } | null {
  const parts = header.split(',');
  let ts: number | undefined;
  let v1: string | undefined;

  for (const part of parts) {
    const [k, v] = part.split('=', 2);
    if (k === 't') ts = parseInt(v, 10);
    if (k === 'v1') v1 = v;
  }

  if (ts === undefined || !v1 || isNaN(ts)) return null;
  return { ts, v1 };
}

function hexToBytes(hex: string): Uint8Array {
  const len = hex.length / 2;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
