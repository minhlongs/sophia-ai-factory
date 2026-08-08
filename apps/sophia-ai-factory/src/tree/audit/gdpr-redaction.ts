/**
 * GDPR-Compliant Data Redaction Module
 *
 * Provides pseudonymization and redaction functions for audit logs
 * to comply with GDPR Article 25 (Data Protection by Design).
 *
 * @module audit/gdpr-redaction
 */

import { hashSensitiveData } from '@/tree/audit/audit-hashing'
import { logger } from '@/seed/utils/logger-utility'
import { redactDetailsPII } from '@/tree/audit/gdpr-redaction-pii-detection'

// Re-export PII detection utilities (barrel)
export { containsPII, redactEmail, PII_PATTERNS } from './gdpr-redaction-pii-detection'

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
 *
 * @param ip - IP address to hash (IPv4 or IPv6)
 * @returns 64-character hexadecimal string
 */
export function hashIpAddress(ip: string): string {
  return hashSensitiveData(ip)
}

/**
 * Generate pseudonym for user ID using SHA-256 with salt
 *
 * @param userId - User ID to pseudonymize
 * @returns 64-character hexadecimal pseudonym
 */
export function generateUserPseudonym(userId: string): string {
  return hashSensitiveData(userId)
}

/**
 * Redact PII from audit log entry for export
 * Returns redacted copy without modifying original
 *
 * @param log - Original audit log entry
 * @returns New redacted audit log object
 */
export function redactAuditLog(log: Record<string, unknown>): RedactedAuditLog {
  const userId = log.user_id as string | null | undefined
  const ipAddress = log.ip_address as string | null | undefined
  const details = log.details as Json | null | undefined

  return {
    id: (log.id as string) || '',
    action: (log.action as string) || '',
    license_nonce: (log.license_nonce as string) || null,
    user_id: userId ? generateUserPseudonym(userId) : null,
    ip_address: ipAddress ? hashIpAddress(ipAddress) : null,
    user_agent: (log.user_agent as string) || null,
    details: redactDetailsPII(details ?? null),
    created_at: (log.created_at as number) || 0,
    model_name: (log.model_name as string) || null,
    token_count: (log.token_count as number) || null,
    ip_address_hash: (log.ip_address_hash as string) || null,
    user_pseudonym: (log.user_pseudonym as string) || null,
    content_hash: (log.content_hash as string) || '',
    previous_log_hash: (log.previous_log_hash as string) || null,
    hash_chain_valid: (log.hash_chain_valid as boolean) || false,
  }
}

/**
 * Batch redaction for export operations
 * Handles large datasets efficiently (1000+ logs)
 *
 * @param logs - Array of audit log entries
 * @param options - Redaction configuration
 * @returns Array of redacted audit logs
 */
export function batchRedactAuditLogs(
  logs: Record<string, unknown>[],
  options: RedactionOptions
): Record<string, unknown>[] {
  logger.info('Starting batch redaction', {
    totalLogs: logs.length,
    options,
  })

  const startTime = Date.now()
  const redactedLogs: Record<string, unknown>[] = []

  for (const log of logs) {
    const redacted = redactAuditLog(log)

    if (!options.redactIp) {
      redacted.ip_address = log.ip_address as string | null
    }
    if (!options.redactUserId) {
      redacted.user_id = log.user_id as string | null
    }

    redactedLogs.push(redacted as unknown as Record<string, unknown>)
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
