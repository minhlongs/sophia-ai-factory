/**
 * @file crypto-primitives.ts
 * @description Edge-compatible Web Crypto primitives and canonical JSON serialization for C2PA.
 * @layer tree
 */

function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API (crypto.subtle) is not available in current runtime environment.');
}

/**
 * Converts ArrayBuffer or Uint8Array to lowercase hex string.
 */
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex.toLowerCase();
}

/**
 * Deterministically serializes any JavaScript value to canonical JSON.
 * - Object keys are sorted alphabetically at every nesting level
 * - Primitives, arrays, and null are serialized identically
 * - Undefined values in objects are skipped
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return `{${pairs.join(',')}}`;
}

/**
 * Computes SHA-256 digest returning a 64-character lowercase hex string.
 */
export async function sha256Hex(data: string | Uint8Array | ArrayBuffer): Promise<string> {
  const subtle = getSubtleCrypto();
  let bufferSource: BufferSource;
  if (typeof data === 'string') {
    bufferSource = new TextEncoder().encode(data);
  } else {
    bufferSource = data as unknown as BufferSource;
  }
  const digest = await subtle.digest('SHA-256', bufferSource);
  return bufferToHex(digest);
}

/**
 * Computes HMAC-SHA256 digital signature returning lowercase hex string.
 */
export async function hmacSha256Hex(data: string, secret: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const keyBuffer = new TextEncoder().encode(secret);
  const cryptoKey = await subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  const dataBuffer = new TextEncoder().encode(data);
  const signature = await subtle.sign('HMAC', cryptoKey, dataBuffer);
  return bufferToHex(signature);
}

/**
 * Constant-time comparison of two hex strings to prevent timing attacks.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Resolves C2PA signing secret with default fallback.
 */
export function getSigningSecret(customSecret?: string): string {
  if (customSecret && customSecret.length > 0) return customSecret;
  if (typeof process !== 'undefined' && process.env?.C2PA_SIGNING_SECRET) {
    return process.env.C2PA_SIGNING_SECRET;
  }
  return 'sophia_c2pa_root_authority_2027_production_signing_key_hmac_sha256';
}
