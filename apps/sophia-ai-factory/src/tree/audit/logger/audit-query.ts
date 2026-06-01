/**
 * Audit Query - Receipt serialization and generic system event logger
 *
 * Utility functions for HTTP header serialization of compliance receipts
 * and a generic audit event logger for non-license system events.
 */

import { parseReceipt } from '@/tree/audit/compliance-receipt'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { createServerClient } from '@/seed/db/client'
import type { ComplianceReceipt } from '@/tree/audit/compliance-receipt'
import type { Json } from '@/land/supabase/types'
import { insertAuditLog } from '@/tree/audit/logger/audit-event-builder'

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
 * Generic audit event logger for system events (circuit breakers, syncs, etc.)
 *
 * @param params - Action, userId, and optional metadata
 */
export async function logAuditEvent(params: {
  action: string
  userId: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const db = createServerClient()
    const createdAt = Math.floor(Date.now() / 1000)
    await insertAuditLog(db, {
      action: params.action.toUpperCase(),
      license_nonce: 'system',
      user_id: params.userId,
      ip_address: null,
      user_agent: null,
      created_at: createdAt,
      details: (params.metadata ?? {}) as Json,
    })
  } catch (error) {
    logger.error('[Audit Logger] logAuditEvent failed', toError(error))
  }
}
