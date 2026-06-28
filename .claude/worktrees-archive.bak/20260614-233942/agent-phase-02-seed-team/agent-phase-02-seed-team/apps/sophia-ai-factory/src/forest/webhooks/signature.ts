/**
 * Unified webhook signature — sign + verify.
 * Edge-runtime safe: Web Crypto API only, no Node built-ins.
 *
 * Format: `t=<unix>,v1=<hmac-sha256-hex>`
 *   - t   = Unix timestamp (seconds) for replay-attack protection
 *   - v1  = HMAC-SHA256 over `${t}.${body}` (hex-encoded, lowercase)
 *
 * Backwards-compat: verifyWebhook accepts a legacy bare-hex signature
 * (the old format produced by signer.ts `sign()`) for one release cycle.
 * Remove legacy branch after all endpoints have re-verified with new format.
 *
 * Inbound provider support: verifyInboundWebhook handles 3rd-party providers
 * (NOWPayments, PayOS) that use their own signature formats (not our t= format).
 *
 * @module lib/webhooks/signature
 */

const ENC = new TextEncoder();

/** Parse `t=<ts>,v1=<hex>` header. Returns null on malformed input. */
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

  if (ts === undefined || isNaN(ts) || !v1) return null;
  return { ts, v1 };
}

export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Timing-safe hex string comparison. Returns true iff a === b. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ab = ENC.encode(a);
  const bb = ENC.encode(b);
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

async function importHmacKey(
  secret: string,
  usage: 'sign' | 'verify',
  hash: 'SHA-256' | 'SHA-512' = 'SHA-256',
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    ENC.encode(secret),
    { name: 'HMAC', hash },
    false,
    [usage],
  );
}

/**
 * Compute HMAC hex for a given algorithm + message string.
 * Used by inbound provider wrappers.
 */
export async function computeHmacHex(
  message: string,
  secret: string,
  hash: 'SHA-256' | 'SHA-512',
): Promise<string> {
  const key = await importHmacKey(secret, 'sign', hash);
  const buf = await crypto.subtle.sign('HMAC', key, ENC.encode(message));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Options for verifyInboundWebhook — inbound 3rd-party provider signatures.
 * These providers use their own hash algorithms and body canonicalization.
 */
export interface InboundVerifyOptions {
  /**
   * HMAC algorithm.
   * - 'SHA-256' — default (e.g. PayOS)
   * - 'SHA-512' — e.g. NOWPayments IPN
   */
  algo: 'SHA-256' | 'SHA-512';
  /**
   * Transform rawBody into the string to sign.
   * Providers may require sorted-key JSON, canonical query strings, etc.
   * Defaults to identity (sign rawBody as-is).
   */
  canonicalize?: (rawBody: string) => string;
}

/**
 * Verify an inbound 3rd-party provider webhook signature.
 *
 * Unlike verifyWebhook (which handles our own t=ts,v1=hex format),
 * this function handles raw HMAC signatures from external providers.
 *
 * @param rawBody   - Raw request body string (must be captured before JSON.parse)
 * @param signature - Hex-encoded HMAC from provider's signature header
 * @param secret    - Provider HMAC secret
 * @param opts      - Algorithm + canonicalization options
 * @returns true if valid, false on any error or mismatch
 */
export async function verifyInboundWebhook(
  rawBody: string,
  signature: string,
  secret: string,
  opts: InboundVerifyOptions,
): Promise<boolean> {
  try {
    const message = opts.canonicalize ? opts.canonicalize(rawBody) : rawBody;
    const computed = await computeHmacHex(message, secret, opts.algo);
    return timingSafeEqual(computed, signature.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Sign a webhook body.
 * Returns header value: `t=<unix>,v1=<hmac-hex>`
 *
 * @param body    - Raw JSON string (before any encoding)
 * @param secret  - Endpoint secret
 * @param ts      - Unix timestamp (seconds). Defaults to now.
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

export interface VerifyOptions {
  /** Max age of signature in seconds. Default 300 (5 min). */
  toleranceSec?: number;
  /**
   * Accept legacy bare-hex signatures (no t= prefix). Default false.
   *
   * Legacy v0 signature support deprecated 2026-05-09.
   * Pass acceptLegacy:true to opt back in (will be removed in 2026-06).
   */
  acceptLegacy?: boolean;
}

/**
 * Verify a webhook signature header.
 *
 * Accepts:
 *   - New format: `t=<unix>,v1=<hex>` — includes timestamp replay-protection
 *   - Legacy format: bare 64-char hex (old `signer.sign()` output) — no skew check
 *
 * @returns true if valid, false on any error / bad signature / replay
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
