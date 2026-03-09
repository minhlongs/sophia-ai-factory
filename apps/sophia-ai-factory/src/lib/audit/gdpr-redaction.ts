/**
 * GDPR-Compliant Data Redaction Module
 *
 * Provides pseudonymization and redaction functions for audit logs
 * to comply with GDPR Article 25 (Data Protection by Design).
 *
 * @module audit/gdpr-redaction
 */

import { hashSensitiveData } from './audit-hashing'
import type { RaasAuditLogRow } from '@/lib/supabase/types'
import { logger } from '@/lib/utils/logger-utility'

/**
 * Salt for pseudonymization (from environment variable)
 * Critical for rainbow table protection
 */
const AUDIT_HASH_SALT = process.env.AUDIT_HASH_SALT || 'default-salt'

/**
 * Redacted audit log type - all PII fields are pseudonymized
 */
export interface RedactedAuditLog {
  id: string
  action: string
  license_nonce: string | null
  user_id: string | null  // Pseudonymized
  ip_address: string | null  // Hashed
  user_agent: string | null
  details: Json
  created_at: number
  model_name: string | null
  token_count: number | null
  ip_address_hash: string | null  // Already hashed in source
  user_pseudonym: string | null  // Already pseudonymized in source
  content_hash: string
  previous_log_hash: string | null
  hash_chain_valid: boolean
}

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * Redaction options for batch operations
 */
export interface RedactionOptions {
  redactIp: boolean
  redactEmail: boolean
  redactUserId: boolean
  retainForDays?: number  // GDPR retention limit
}

/**
 * Hash IP address with SHA-256 for GDPR compliance
 * Uses unified hashing utility for consistency
 *
 * @param ip - IP address to hash (IPv4 or IPv6)
 * @returns 64-character hexadecimal string
 */
export function hashIpAddress(ip: string): string {
  return hashSensitiveData(ip)
}

/**
 * Generate pseudonym for user ID using SHA-256 with salt
 * Uses unified hashing utility for consistency
 *
 * @param userId - User ID to pseudonymize
 * @returns 64-character hexadecimal pseudonym
 */
export function generateUserPseudonym(userId: string): string {
  return hashSensitiveData(userId)
}

/**
 * Redact email address preserving domain for analytics
 * Format: "a***z@example.com" (first char + *** + last char before @)
 *
 * @param email - Email address to redact
 * @returns Redacted email string
 *
 * @example
 * redactEmail('john.doe@example.com')  // "j***e@example.com"
 * redactEmail('ab@test.org')           // "a***b@test.org"
 */
export function redactEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    logger.warn('Invalid email for redaction:', { email })
    return '[REDACTED]'
  }

  const atIndex = email.indexOf('@')
  if (atIndex === -1) {
    logger.warn('Invalid email format - no @ symbol:', { email })
    return '[REDACTED]'
  }

  const localPart = email.slice(0, atIndex)
  const domainPart = email.slice(atIndex)

  if (localPart.length === 0) {
    return '[REDACTED]'
  }

  if (localPart.length === 1) {
    return `${localPart}***${domainPart}`
  }

  const firstChar = localPart.charAt(0)
  const lastChar = localPart.charAt(localPart.length - 1)
  return `${firstChar}***${lastChar}${domainPart}`
}

/**
 * PII pattern matchers for detection
 */
const PII_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}$/,
  ssn: /^\d{3}-\d{2}-\d{4}$/,
  creditCard: /^\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}$/,
}

/**
 * Check if data contains PII (email, phone, SSN, credit card patterns)
 *
 * @param data - String to check for PII
 * @returns true if PII patterns detected
 *
 * @example
 * containsPII('john@example.com')  // true
 * containsPII('regular text')      // false
 */
export function containsPII(data: string): boolean {
  if (!data || typeof data !== 'string') {
    return false
  }

  // Check against all PII patterns
  return (
    PII_PATTERNS.email.test(data) ||
    PII_PATTERNS.phone.test(data) ||
    PII_PATTERNS.ssn.test(data) ||
    PII_PATTERNS.creditCard.test(data)
  )
}

/**
 * Redact PII from audit log entry for export
 * Returns redacted copy without modifying original
 *
 * @param log - Original audit log entry
 * @returns New redacted audit log object
 *
 * @example
 * const redacted = redactAuditLog(auditLog)
 */
export function redactAuditLog(log: RaasAuditLogRow): RedactedAuditLog {
  return {
    ...log,
    user_id: log.user_id ? generateUserPseudonym(log.user_id) : null,
    ip_address: log.ip_address ? hashIpAddress(log.ip_address) : null,
    // details may contain PII - redact known fields
    details: redactDetailsPII(log.details),
  }
}

/**
 * Recursively redact PII from details object
 */
function redactDetailsPII(details: Json): Json {
  if (details === null || details === undefined) {
    return details
  }

  if (typeof details === 'string') {
    // Redact if string contains PII
    if (PII_PATTERNS.email.test(details)) {
      return redactEmail(details)
    }
    return details
  }

  if (typeof details === 'number' || typeof details === 'boolean') {
    return details
  }

  if (Array.isArray(details)) {
    return details.map(item => redactDetailsPII(item ?? null))
  }

  // Object - check for known PII fields
  const redactedObj: Record<string, Json> = {}
  for (const [key, value] of Object.entries(details)) {
    if (value === undefined) {
      redactedObj[key] = null
      continue
    }
    if (typeof value === 'string') {
      const lowerKey = key.toLowerCase()
      if (
        lowerKey.includes('email') ||
        lowerKey.includes('phone') ||
        lowerKey.includes('ssn')
      ) {
        redactedObj[key] = '[REDACTED]'
      } else if (PII_PATTERNS.email.test(value)) {
        redactedObj[key] = redactEmail(value)
      } else {
        redactedObj[key] = value
      }
    } else {
      redactedObj[key] = redactDetailsPII(value ?? null)
    }
  }

  return redactedObj
}

/**
 * Batch redaction for export operations
 * Handles large datasets efficiently (1000+ logs)
 *
 * @param logs - Array of audit log entries
 * @param options - Redaction configuration
 * @returns Array of redacted audit logs
 *
 * @example
 * const redacted = batchRedactAuditLogs(logs, {
 *   redactIp: true,
 *   redactEmail: true,
 *   redactUserId: true,
 *   retainForDays: 90
 * })
 */
export function batchRedactAuditLogs(
  logs: RaasAuditLogRow[],
  options: RedactionOptions
): RedactedAuditLog[] {
  logger.info('Starting batch redaction', {
    totalLogs: logs.length,
    options,
  })

  const startTime = Date.now()
  const redactedLogs: RedactedAuditLog[] = []

  for (const log of logs) {
    const redacted = redactAuditLog(log)

    // Apply selective redaction based on options
    if (!options.redactIp) {
      redacted.ip_address = log.ip_address
    }
    if (!options.redactUserId) {
      redacted.user_id = log.user_id
    }

    redactedLogs.push(redacted)
  }

  const duration = Date.now() - startTime
  logger.info('Batch redaction complete', {
    processedCount: redactedLogs.length,
    durationMs: duration,
  })

  return redactedLogs
}

/**
 * Check GDPR retention compliance
 * Returns true if data should be deleted based on retention period
 *
 * @param createdAt - Log creation timestamp (Unix epoch)
 * @param retainForDays - GDPR retention period in days (default: 90)
 * @returns true if data exceeds retention period
 */
export function shouldDeleteForRetentionPolicy(
  createdAt: number,
  retainForDays: number = 90
): boolean {
  const retentionMs = retainForDays * 24 * 60 * 60 * 1000
  const now = Date.now()
  return now - createdAt > retentionMs
}
