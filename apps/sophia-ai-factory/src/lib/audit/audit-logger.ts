/**
 * Audit Logger with Compliance Receipt Generation
 *
 * Provides functions to log RaaS license events (validation, creation, revocation)
 * with automatic compliance receipt generation. Each log entry includes:
 * - Hash chain linkage for tamper detection
 * - Signed receipt for external verification
 * - Full context (IP, user agent, tier)
 *
 * @module audit/audit-logger
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { generateReceipt, parseReceipt } from './compliance-receipt'
import { logger } from '@/lib/utils/logger-utility'
import type { RaasAuditLogInsert, RaasAuditLogRow, Json } from '@/lib/supabase/types'
import type { ComplianceReceipt } from './compliance-receipt'

/**
 * Type helper for Supabase query results
 */
type SupabaseResult<T> = { data: T | null; error: Error | null }

/**
 * Update audit log receipt signature - wrapper to bypass Supabase type issues
 * Since Supabase types are not generated from database, we use this helper
 * to encapsulate the type casting.
 */
async function updateReceiptSignature(
  supabase: ReturnType<typeof createAdminClient>,
  logId: string,
  signature: string
): Promise<Error | null> {
  // Use function-level type assertion to bypass Supabase type inference
  const result = await (supabase as any)
    .from('raas_audit_logs')
    .update({ receipt_signature: signature })
    .eq('id', logId)
  return (result as { error: Error | null }).error
}

/**
 * Insert audit log - wrapper to bypass Supabase type issues
 */
async function insertAuditLog(
  supabase: ReturnType<typeof createAdminClient>,
  logData: RaasAuditLogInsert
): Promise<SupabaseResult<RaasAuditLogRow>> {
  const result = await (supabase as any)
    .from('raas_audit_logs')
    .insert(logData)
    .select()
    .single()
  return result as SupabaseResult<RaasAuditLogRow>
}
export interface ValidationLogParams {
  /** License nonce being validated */
  nonce: string
  /** Whether validation succeeded */
  isValid: boolean
  /** User ID if authenticated */
  userId?: string
  /** Client IP address (will be hashed for privacy) */
  ipAddress?: string
  /** User agent string */
  userAgent?: string
  /** License tier (basic | premium | enterprise | master) */
  tier?: string
}

/**
 * Creation log parameters for new license issuance
 */
export interface CreationLogParams {
  /** License nonce */
  nonce: string
  /** License tier */
  tier: string
  /** User who created the license */
  createdBy?: string
  /** Client IP address */
  ipAddress?: string
  /** User agent string */
  userAgent?: string
}

/**
 * Revocation log parameters for license revocation events
 */
export interface RevocationLogParams {
  /** License nonce being revoked */
  nonce: string
  /** User who revoked the license */
  revokedBy?: string
  /** Reason for revocation */
  reason?: string
  /** Client IP address */
  ipAddress?: string
  /** User agent string */
  userAgent?: string
  /** Tier of the license */
  tier?: string
}

/**
 * Log license validation with compliance receipt generation
 *
 * Called by raas-gate.ts middleware on every validation attempt.
 * Creates audit log entry with hash chain, generates signed receipt,
 * and stores receipt signature in database.
 *
 * @param params - Validation log parameters
 * @returns Generated compliance receipt or null if logging failed
 *
 * @example
 * const receipt = await logValidationWithReceipt({
 *   nonce: 'abc123',
 *   isValid: true,
 *   ipAddress: '192.168.1.1',
 *   tier: 'premium'
 * })
 */
export async function logValidationWithReceipt(
  params: ValidationLogParams
): Promise<ComplianceReceipt | null> {
  const supabase = createAdminClient()
  const createdAt = Math.floor(Date.now() / 1000)

  // Prepare audit log data
  const logData: RaasAuditLogInsert = {
    action: 'VALIDATE',
    license_nonce: params.nonce,
    user_id: params.userId ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    created_at: createdAt,
    details: {
      isValid: params.isValid,
      tier: params.tier,
      timestamp: createdAt
    } as Json
  }

  try {
    // Insert audit log using wrapper (database trigger auto-computes hash chain)
    const insertResult = await insertAuditLog(supabase, logData)

    const insertedLog = insertResult.data
    const insertError = insertResult.error

    if (insertError || !insertedLog) {
      logger.error('[Audit Logger] Failed to insert audit log', insertError as Error)
      return null
    }

    // Generate compliance receipt
    const receipt = generateReceipt(insertedLog)

    // Store receipt signature using wrapper
    const updateError = await updateReceiptSignature(supabase, insertedLog.id, receipt.signature)

    if (updateError) {
      logger.error('[Audit Logger] Failed to store receipt signature', updateError as Error)
      // Non-fatal: receipt already generated, continue
    }

    logger.info('[Audit Logger] Validation logged with receipt', {
      logId: insertedLog.id,
      nonce: params.nonce.slice(0, 8),
      isValid: params.isValid,
      receiptId: receipt.receiptId
    })

    return receipt
  } catch (error) {
    logger.error('[Audit Logger] Audit logging failed', error as Error)
    // Non-fatal: don't block validation on audit failure
    return null
  }
}

/**
 * Log license creation with compliance receipt generation
 *
 * Called when new licenses are issued. Creates audit log entry
 * with hash chain and generates signed receipt for the creation event.
 *
 * @param params - Creation log parameters
 * @returns Generated compliance receipt or null if logging failed
 *
 * @example
 * const receipt = await logCreationWithReceipt({
 *   nonce: 'abc123',
 *   tier: 'premium',
 *   createdBy: 'admin-user-id',
 *   ipAddress: '192.168.1.1'
 * })
 */
export async function logCreationWithReceipt(
  params: CreationLogParams
): Promise<ComplianceReceipt | null> {
  const supabase = createAdminClient()
  const createdAt = Math.floor(Date.now() / 1000)

  // Prepare audit log data
  const logData: RaasAuditLogInsert = {
    action: 'CREATE',
    license_nonce: params.nonce,
    user_id: params.createdBy ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    created_at: createdAt,
    details: {
      tier: params.tier,
      timestamp: createdAt
    } satisfies Json
  }

  try {
    // Insert audit log using wrapper
    const insertResult = await insertAuditLog(supabase, logData)

    const insertedLog = insertResult.data
    const insertError = insertResult.error

    if (insertError || !insertedLog) {
      logger.error('[Audit Logger] Failed to insert creation audit log', insertError as Error)
      return null
    }

    // Generate compliance receipt
    const receipt = generateReceipt(insertedLog)

    // Store receipt signature using wrapper
    const updateError = await updateReceiptSignature(supabase, insertedLog.id, receipt.signature)

    if (updateError) {
      logger.error('[Audit Logger] Failed to store creation receipt signature', updateError as Error)
    }

    logger.info('[Audit Logger] Creation logged with receipt', {
      logId: insertedLog.id,
      nonce: params.nonce.slice(0, 8),
      tier: params.tier,
      receiptId: receipt.receiptId
    })

    return receipt
  } catch (error) {
    logger.error('[Audit Logger] Creation audit logging failed', error as Error)
    return null
  }
}

/**
 * Log license revocation with compliance receipt generation
 *
 * Called when licenses are revoked. Creates audit log entry
 * with hash chain and generates signed receipt for the revocation event.
 *
 * @param params - Revocation log parameters
 * @returns Generated compliance receipt or null if logging failed
 *
 * @example
 * const receipt = await logRevocationWithReceipt({
 *   nonce: 'abc123',
 *   revokedBy: 'admin-user-id',
 *   reason: 'payment_failed',
 *   tier: 'premium'
 * })
 */
export async function logRevocationWithReceipt(
  params: RevocationLogParams
): Promise<ComplianceReceipt | null> {
  const supabase = createAdminClient()
  const createdAt = Math.floor(Date.now() / 1000)

  // Prepare audit log data
  const logData: RaasAuditLogInsert = {
    action: 'REVOKE',
    license_nonce: params.nonce,
    user_id: params.revokedBy ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    created_at: createdAt,
    details: {
      revokedBy: params.revokedBy,
      reason: params.reason,
      tier: params.tier,
      timestamp: createdAt
    } satisfies Json
  }

  try {
    // Insert audit log using wrapper
    const insertResult = await insertAuditLog(supabase, logData)

    const insertedLog = insertResult.data
    const insertError = insertResult.error

    if (insertError || !insertedLog) {
      logger.error('[Audit Logger] Failed to insert revocation audit log', insertError as Error)
      return null
    }

    // Generate compliance receipt
    const receipt = generateReceipt(insertedLog)

    // Store receipt signature using wrapper
    const updateError = await updateReceiptSignature(supabase, insertedLog.id, receipt.signature)

    if (updateError) {
      logger.error('[Audit Logger] Failed to store revocation receipt signature', updateError as Error)
    }

    logger.info('[Audit Logger] Revocation logged with receipt', {
      logId: insertedLog.id,
      nonce: params.nonce.slice(0, 8),
      reason: params.reason,
      receiptId: receipt.receiptId
    })

    return receipt
  } catch (error) {
    logger.error('[Audit Logger] Revocation audit logging failed', error as Error)
    return null
  }
}

/**
 * Log license update (extension) with compliance receipt generation
 *
 * Called when licenses are extended or modified. Creates audit log entry
 * with hash chain and generates signed receipt for the update event.
 *
 * @param params - Update log parameters
 * @returns Generated compliance receipt or null if logging failed
 *
 * @example
 * const receipt = await logUpdateWithReceipt({
 *   nonce: 'abc123',
 *   updatedBy: 'admin-user-id',
 *   changes: { extendsDays: 30, previousExpiresAt: 1234567890, newExpiresAt: 1237159890 },
 *   tier: 'premium'
 * })
 */
export async function logUpdateWithReceipt(
  params: {
    nonce: string
    updatedBy?: string
    changes: Record<string, unknown>
    tier?: string
    ipAddress?: string
    userAgent?: string
  }
): Promise<ComplianceReceipt | null> {
  const supabase = createAdminClient()
  const createdAt = Math.floor(Date.now() / 1000)

  // Prepare audit log data (cast changes to Json for type compatibility)
  const logData: RaasAuditLogInsert = {
    action: 'UPDATE',
    license_nonce: params.nonce,
    user_id: params.updatedBy ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    created_at: createdAt,
    details: {
      updatedBy: params.updatedBy,
      changes: params.changes as Json,
      tier: params.tier,
      timestamp: createdAt
    } satisfies Json
  }

  try {
    // Insert audit log using wrapper
    const insertResult = await insertAuditLog(supabase, logData)

    const insertedLog = insertResult.data
    const insertError = insertResult.error

    if (insertError || !insertedLog) {
      logger.error('[Audit Logger] Failed to insert update audit log', insertError as Error)
      return null
    }

    // Generate compliance receipt
    const receipt = generateReceipt(insertedLog)

    // Store receipt signature using wrapper
    const updateError = await updateReceiptSignature(supabase, insertedLog.id, receipt.signature)

    if (updateError) {
      logger.error('[Audit Logger] Failed to store update receipt signature', updateError as Error)
    }

    logger.info('[Audit Logger] Update logged with receipt', {
      logId: insertedLog.id,
      nonce: params.nonce.slice(0, 8),
      changes: params.changes,
      receiptId: receipt.receiptId
    })

    return receipt
  } catch (error) {
    logger.error('[Audit Logger] Update audit logging failed', error as Error)
    return null
  }
}

/**
 * Serialize receipt for HTTP header transmission
 *
 * @param receipt - Compliance receipt to serialize
 * @returns Base64-encoded JSON string safe for HTTP headers
 */
export function serializeReceiptForHeader(receipt: ComplianceReceipt): string {
  const json = JSON.stringify(receipt)
  return Buffer.from(json).toString('base64url')
}

/**
 * Parse receipt from HTTP header
 *
 * @param headerValue - Base64-encoded receipt from header
 * @returns Parsed receipt or null if invalid
 */
export function parseReceiptFromHeader(headerValue: string): ComplianceReceipt | null {
  try {
    const json = Buffer.from(headerValue, 'base64url').toString('utf-8')
    return parseReceipt(json)
  } catch {
    return null
  }
}

/**
 * Usage log parameters for model invocation tracking
 */
export interface UsageLogParams {
  /** License nonce */
  nonce: string
  /** AI model name (optional) */
  model_name?: string
  /** Total token count (optional) */
  token_count?: number
  /** Input tokens (optional) */
  tokens_input?: number
  /** Output tokens (optional) */
  tokens_output?: number
  /** API endpoint (optional) */
  endpoint?: string
  /** User ID if authenticated */
  userId?: string
  /** Client IP address (will be hashed for GDPR) */
  ipAddress?: string
  /** User agent string */
  userAgent?: string
  /** License tier */
  tier: string
}

/**
 * Log API/model usage with compliance receipt generation
 *
 * Extends audit logging with granular usage tracking:
 * - Model invocation details (name, tokens)
 * - GDPR-compliant IP hashing and user pseudonymization
 * - Full hash chain linkage for tamper detection
 *
 * @param params - Usage log parameters
 * @returns Generated compliance receipt or null if logging failed
 *
 * @example
 * const receipt = await logUsageWithReceipt({
 *   nonce: 'abc123',
 *   model_name: 'gpt-4',
 *   token_count: 1500,
 *   tokens_input: 1000,
 *   tokens_output: 500,
 *   endpoint: '/api/v1/chat/completions',
 *   ipAddress: '192.168.1.1',
 *   tier: 'premium'
 * })
 */
export async function logUsageWithReceipt(
  params: UsageLogParams
): Promise<ComplianceReceipt | null> {
  const supabase = createAdminClient()
  const createdAt = Math.floor(Date.now() / 1000)

  // Prepare audit log data with usage tracking fields
  const logData: RaasAuditLogInsert = {
    action: 'USAGE',
    license_nonce: params.nonce,
    user_id: params.userId ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    created_at: createdAt,
    details: {
      model_name: params.model_name ?? null,
      token_count: params.token_count ?? null,
      tokens_input: params.tokens_input ?? null,
      tokens_output: params.tokens_output ?? null,
      endpoint: params.endpoint ?? null,
      tier: params.tier,
      timestamp: createdAt
    }
  }

  try {
    // Insert audit log using wrapper (database trigger auto-computes hash chain)
    const insertResult = await insertAuditLog(supabase, logData)

    const insertedLog = insertResult.data
    const insertError = insertResult.error

    if (insertError || !insertedLog) {
      logger.error('[Audit Logger] Failed to insert usage audit log', insertError as Error)
      return null
    }

    // Generate compliance receipt
    const receipt = generateReceipt(insertedLog)

    // Store receipt signature using wrapper
    const updateError = await updateReceiptSignature(supabase, insertedLog.id, receipt.signature)

    if (updateError) {
      logger.error('[Audit Logger] Failed to store usage receipt signature', updateError as Error)
    }

    logger.info('[Audit Logger] Usage logged with receipt', {
      logId: insertedLog.id,
      nonce: params.nonce.slice(0, 8),
      model: params.model_name,
      tokens: params.token_count,
      tier: params.tier,
      receiptId: receipt.receiptId
    })

    return receipt
  } catch (error) {
    logger.error('[Audit Logger] Usage audit logging failed', error as Error)
    // Graceful degradation: don't block API response
    return null
  }
}
