/**
 * GDPR-Compliant Data Redaction Module (Article 25 – Data Protection by Design)
 *
 * All hash functions delegate to audit-hashing.ts (Web Crypto / global `crypto`).
 * @module audit/gdpr-redaction
 */

import { hashSensitiveData, setAuditHashSalt } from '@/tree/audit/audit-hashing'

// Initialise salt once at module load
setAuditHashSalt(process.env.AUDIT_HASH_SALT ?? '')

import type { RaasAuditLogRow } from '@/tree/database/supabase-types'
import { logger } from '@/seed/utils/logger-utility'
import { redactDetailsPII } from '@/tree/audit/gdpr-redaction-pii-detection'

// Re-export PII detection utilities (barrel)
export { containsPII, redactEmail, PII_PATTERNS } from './gdpr-redaction-pii-detection'

// ── Types ───────────────────────────────────────────────────────────

export interface RedactedAuditLog {
  id: string
  action: string
  license_nonce: string | null
  user_id: string | null        // pseudonymised
  ip_address: string | null     // hashed
  user_agent: string | null
  details: Json
  created_at: number
  model_name: string | null
  token_count: number | null
  ip_address_hash: string | null
  user_pseudonym: string | null
  content_hash: string
  previous_log_hash: string | null
  hash_chain_valid: boolean
}

export interface RedactionOptions {
  redactIp: boolean
  redactEmail: boolean
  redactUserId: boolean
  retainForDays?: number
}

type Json =
  | string | number | boolean | null
  | { [key: string]: Json | undefined }
  | Json[]

// ── Thin async wrappers (preserve semantic naming) ──────────────────

/** Re-exported from audit-hashing */
export async function hashIpAddress(ip: string): Promise<string> {
  return hashSensitiveData(ip)
}

/** Re-exported from audit-hashing */
export async function generateUserPseudonym(userId: string): Promise<string> {
  return hashSensitiveData(userId)
}

// ── Redaction functions (now async — callers await below) ──────────

export async function redactAuditLog(log: RaasAuditLogRow): Promise<RedactedAuditLog> {
  return {
    ...log,
    user_id: log.user_id ? await generateUserPseudonym(log.user_id) : null,
    ip_address: log.ip_address ? await hashIpAddress(log.ip_address) : null,
    details: redactDetailsPII(log.details),
  }
}

export async function batchRedactAuditLogs(
  logs: RaasAuditLogRow[],
  options: RedactionOptions,
): Promise<RedactedAuditLog[]> {
  logger.info('Starting batch redaction', { totalLogs: logs.length, options })

  const startTime = Date.now()
  const redactedLogs: RedactedAuditLog[] = []

  for (const log of logs) {
    const redacted = await redactAuditLog(log)

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

// ── Retention (sync — no crypto) ───────────────────────────────────

export function shouldDeleteForRetentionPolicy(
  createdAt: number,
  retainForDays: number = 90,
): boolean {
  const retentionMs = retainForDays * 24 * 60 * 60 * 1000
  return Date.now() - createdAt > retentionMs
}
