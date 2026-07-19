/**
 * Token hashing utilities for confirmation flows.
 *
 * Wave 22 Phase 01: replaces plaintext token storage with sha256 hash.
 * Raw token only travels in email URL; DB stores 64-char hex digest.
 *
 * @module seed/security/token-hash
 */

const HEX_CHARS = '0123456789abcdef';

export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    hex += HEX_CHARS[(b >> 4) & 0xf] + HEX_CHARS[b & 0xf];
  }
  return hex;
}

/**
 * Constant-time string equality. Both inputs MUST be the same length to
 * prevent timing-leak via length-discriminator. Length mismatch returns false
 * after a token-equal pass to keep the timing footprint stable.
 */
export function safeCompareHex(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

/**
 * Detects if a stored token is the new sha256 hash format (64-char lowercase
 * hex). Anything else (legacy plaintext UUID, short test fixtures) is treated
 * as a legacy raw-compare value during the backward-compat window.
 */
export function isHashedToken(stored: string): boolean {
  return stored.length === 64 && /^[0-9a-f]{64}$/.test(stored);
}
