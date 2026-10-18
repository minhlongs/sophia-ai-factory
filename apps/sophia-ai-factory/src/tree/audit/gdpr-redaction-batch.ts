/**
 * GDPR Batch Redaction & Retention Policy Helpers
 *
 * @module tree/audit/gdpr-redaction-batch
 */

import { logger } from '@/seed/utils/logger-utility'
import { redactAuditLog } from './gdpr-redaction'

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
