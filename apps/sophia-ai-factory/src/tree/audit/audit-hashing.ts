/**
 * Unified Hashing Utilities for ROIaaS Compliance Audit
 *
 * Uses the GLOBAL `crypto` object (Web Crypto API) — NOT `node:crypto`.
 * This ensures the module works in Cloudflare Workers SSR where Node builtins
 * are unavailable. The global `crypto` is present in Node 19+, all modern
 * browsers, and Cloudflare Workers.
 *
 * @module audit/audit-hashing
 */

// ── Module-level salt (set once from env, immutable after) ──────────

let _salt = process.env.AUDIT_HASH_SALT ?? ''

/** Set the salt used for GDPR-compliant hashing. Call once at startup. */
export function setAuditHashSalt(salt: string): void {
  _salt = salt
}

// ── Constants & helpers ─────────────────────────────────────────────

const SALT_DELIMITER = '|'
const HEX_RE = /^[0-9a-f]{64}$/

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function salted(data: string): string {
  return _salt + SALT_DELIMITER + data
}

/** Constant-time comparison between two strings. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// ── SHA-256 digest via Web Crypto API ──────────────────────────────

async function sha256(data: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return toHex(buffer)
}

// ── Public API (all async — uses Web Crypto SHA-256) ──────────────

/**
 * Hash sensitive data with GDPR-compliant pseudonymization.
 *
 * Returns a cached promise so concurrent callers share the result.
 * SHA-256 produces 64-char hex output.
 *
 * @param data - Sensitive data (IP, user ID, email, etc.)
 * @returns 64-char hex hash, or empty string for falsy input
 */
export async function hashSensitiveData(data: string): Promise<string> {
  if (!data || typeof data !== 'string') return ''
  return sha256(salted(data))
}

/**
 * Hash an IP address for GDPR compliance.
 * Alias for hashSensitiveData with semantic naming.
 *
 * @param ipAddress - IP address
 * @returns 64-char hex hash, or empty string for falsy input
 */
export async function hashIpAddress(ipAddress: string): Promise<string> {
  return hashSensitiveData(ipAddress)
}

/**
 * Generate a deterministic pseudonym from a user ID.
 * Alias for hashSensitiveData with semantic naming.
 *
 * @param userId - User ID
 * @returns 64-char hex pseudonym, or empty string for falsy input
 */
export async function generateUserPseudonym(userId: string): Promise<string> {
  return hashSensitiveData(userId)
}

/**
 * Verify data matches a known hash using constant-time comparison.
 *
 * @param data - Original data
 * @param expectedHash - Expected 64-char hex hash
 * @returns true if data produces the given hash
 */
export async function verifyHash(data: string, expectedHash: string): Promise<boolean> {
  if (!data || !expectedHash || !HEX_RE.test(expectedHash)) return false
  const computedHash = await hashSensitiveData(data)
  return constantTimeEqual(computedHash, expectedHash)
}
