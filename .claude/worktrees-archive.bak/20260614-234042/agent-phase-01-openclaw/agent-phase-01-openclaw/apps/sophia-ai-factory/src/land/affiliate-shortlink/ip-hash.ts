/**
 * IP Hash Utility
 *
 * GDPR-friendly IP fingerprinting via SHA256(ip + dailySalt).
 * Never stores raw IP addresses.
 * Uses Web Crypto API (Cloudflare Workers compatible).
 *
 * @module affiliate-shortlink/ip-hash
 */

/**
 * Returns the daily salt for IP hashing.
 * Reads IP_HASH_DAILY_SALT env var; falls back to current UTC date string.
 */
export function getDailySalt(): string {
  if (process.env.IP_HASH_DAILY_SALT) {
    return process.env.IP_HASH_DAILY_SALT;
  }
  // Fallback: rotate daily by UTC date — dev/test only
  return new Date().toISOString().slice(0, 10);
}

/**
 * Hash an IP address with the given salt using SHA256.
 * Returns hex-encoded 64-char digest.
 */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
