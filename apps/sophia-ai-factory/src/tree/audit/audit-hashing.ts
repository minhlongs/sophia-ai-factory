/**
 * Unified Hashing Utilities for ROIaaS Compliance Audit
 *
 * Provides centralized, consistent hashing for GDPR-compliant
 * data pseudonymization across all audit modules.
 *
 * @module audit/audit-hashing
 */

import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Salt for hashing (from environment variable)
 * Critical for rainbow table protection
 */
const AUDIT_HASH_SALT = process.env.AUDIT_HASH_SALT || ''

/**
 * Unified hash function for sensitive data
 * Uses SHA-256 with salt for GDPR-compliant pseudonymization
 *
 * @param data - Sensitive data to hash (IP, user ID, email, etc.)
 * @returns 64-character hexadecimal hash string, or empty string if input is empty
 *
 * @example
 * // Hash IP address
 * const ipHash = hashSensitiveData('192.168.1.1')
 *
 * // Hash user ID
 * const userPseudonym = hashSensitiveData('user-123')
 *
 * // Empty input returns empty string
 * hashSensitiveData('') // ''
 */
export function hashSensitiveData(data: string): string {
  // Return empty string for empty/null/undefined input
  if (!data || typeof data !== 'string') {
    return ''
  }

  // Format: salt|data for consistent hashing with delimiter
  // Delimiter prevents rainbow table attacks even if salt is compromised
  const saltedData = `${AUDIT_HASH_SALT}|${data}`

  return createHash('sha256')
    .update(saltedData)
    .digest('hex')
}

/**
 * Hash IP address for GDPR compliance
 * Wrapper around hashSensitiveData for semantic clarity
 *
 * @param ipAddress - IP address to hash (IPv4 or IPv6)
 * @returns 64-character hexadecimal hash string
 *
 * @example
 * const hashed = hashIpAddress('192.168.1.1')
 */
export function hashIpAddress(ipAddress: string): string {
  return hashSensitiveData(ipAddress)
}

/**
 * Generate user pseudonym for GDPR-compliant analytics
 * Wrapper around hashSensitiveData for semantic clarity
 *
 * @param userId - User ID to pseudonymize
 * @returns 64-character hexadecimal pseudonym
 *
 * @example
 * const pseudonym = generateUserPseudonym('user-123')
 */
export function generateUserPseudonym(userId: string): string {
  return hashSensitiveData(userId)
}

/**
 * Verify data matches a known hash
 * Useful for checking if raw data matches stored pseudonym
 *
 * @param data - Original data to verify
 * @param expectedHash - Expected hash value to compare against
 * @returns true if hash matches
 *
 * @example
 * const matches = verifyHash('user-123', storedPseudonym)
 */
export function verifyHash(data: string, expectedHash: string): boolean {
  if (!data || !expectedHash) {
    return false
  }

  const computedHash = hashSensitiveData(data)
  // Use constant-time comparison to prevent timing attacks
  const a = Buffer.from(computedHash, 'hex')
  const b = Buffer.from(expectedHash, 'hex')

  if (a.length !== b.length) {
    return false
  }

  return timingSafeEqual(a, b)
}
