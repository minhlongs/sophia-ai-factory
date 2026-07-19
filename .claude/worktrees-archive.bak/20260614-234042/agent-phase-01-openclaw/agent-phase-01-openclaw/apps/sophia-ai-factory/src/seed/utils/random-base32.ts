/**
 * RFC 4648 base32 random string generator using Web Crypto.
 * Alphabet: A-Z + 2-7 (32 chars). Uniform distribution.
 * Each char = 5 bits entropy → 8-char string = 40 bits ≈ 1.1T combos.
 * @module seed/utils/random-base32
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Returns a `len`-character base32 string from crypto-secure random bytes.
 * Each output char draws one random byte and maps via `byte % 32`.
 */
export function randomBase32(len: number): string {
  if (len <= 0) throw new Error("len must be > 0");
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % 32];
  }
  return out;
}
