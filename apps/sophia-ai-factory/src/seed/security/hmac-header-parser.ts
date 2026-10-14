/**
 * Header parsing and timing-safe comparison utilities for HMAC webhooks.
 *
 * @module seed/security/hmac-header-parser
 */

/**
 * Parsed components of a webhook signature header.
 */
export interface ParsedSignatureHeader {
  timestamp: number;
  v1: string;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Iterates through all characters using bitwise XOR without early exit.
 *
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are identical in length and content
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

/**
 * Parses the `t=<timestamp>,v1=<signature>` header format.
 * Tolerates whitespace, arbitrary component ordering, and extra parameters.
 *
 * @param header - Raw header string
 * @returns Parsed object with timestamp and v1 signature, or null if malformed
 */
export function parseSignatureHeader(header: string): ParsedSignatureHeader | null {
  if (!header || typeof header !== 'string') {
    return null;
  }

  const parts = header.split(',');
  let timestamp: number | null = null;
  let signature: string | null = null;

  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;

    const key = part.slice(0, eqIdx).trim();
    const value = part.slice(eqIdx + 1).trim();

    if (key === 't') {
      const parsed = Number(value);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed) && parsed > 0) {
        timestamp = parsed;
      }
    } else if (key === 'v1') {
      if (value.length > 0) {
        signature = value;
      }
    }
  }

  if (timestamp === null || !signature) {
    return null;
  }

  return { timestamp, v1: signature };
}
