/**
 * Short Code Generator
 *
 * Generates URL-safe base32 short codes for affiliate links.
 * Uses Web Crypto API (Cloudflare Workers compatible).
 *
 * @module affiliate-shortlink/short-code-generator
 */

/** Crockford-ish lowercase base32 alphabet — 32 chars, URL-safe */
const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

/**
 * Generate a 13-character base32 short code from 8 random bytes.
 * 8 bytes = 64 bits → base32 encodes 5 bits per char → ceil(64/5) = 13 chars.
 */
export function generateShortCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);

  let bits = 0n;
  for (const byte of bytes) {
    bits = (bits << 8n) | BigInt(byte);
  }

  let code = '';
  // 13 chars × 5 bits = 65 bits; we have 64 so pad top bit with 0
  bits = bits << 1n; // shift left 1 to make 65 bits with leading 0
  for (let i = 0; i < 13; i++) {
    const idx = Number((bits >> 60n) & 0x1fn);
    code += BASE32_ALPHABET[idx];
    bits = bits << 5n;
  }

  return code;
}

/** Validation regex for short codes */
const SHORT_CODE_REGEX = /^[a-z2-7]{8,13}$/;

/**
 * Validate that a string is a valid short code.
 */
export function isValidShortCode(s: string): boolean {
  return SHORT_CODE_REGEX.test(s);
}
