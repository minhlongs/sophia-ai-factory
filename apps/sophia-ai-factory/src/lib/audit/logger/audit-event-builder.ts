/**
 * Audit Event Builder - Param types and low-level DB helpers
 *
 * Provides insert/update wrappers that bypass Supabase type inference issues,
 * and defines all audit event parameter interfaces.
 */

import { createServerClient } from '@/seed/db/client'
import { insertTyped } from '@/seed/db/insert-typed'
import type { RaasAuditLogInsert, RaasAuditLogRow } from '@/lib/supabase/types'

/** Type helper for Supabase query results */
export type SupabaseResult<T> = { data: T | null; error: Error | null }

/**
 * Insert audit log — wrapper to bypass Supabase type issues
 */
export async function insertAuditLog(
  db: ReturnType<typeof createServerClient>,
  logData: RaasAuditLogInsert
): Promise<SupabaseResult<RaasAuditLogRow>> {
  const result = await insertTyped(db.from<RaasAuditLogRow>('raas_audit_logs'), logData)
    .select()
    .single()
  return result as SupabaseResult<RaasAuditLogRow>
}

/**
 * Update audit log receipt signature — wrapper to bypass Supabase type issues
 */
export async function updateReceiptSignature(
  db: ReturnType<typeof createServerClient>,
  logId: string,
  signature: string
): Promise<Error | null> {
  const result = await db.from<RaasAuditLogRow>('raas_audit_logs')
    .update({ receipt_signature: signature } as Partial<RaasAuditLogRow>)
    .eq('id', logId)
  return (result as { error: Error | null }).error
}

// ---------------------------------------------------------------------------
// Parameter interfaces
// ---------------------------------------------------------------------------

/** Validation log parameters for license validation events */
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

/** Creation log parameters for new license issuance */
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

/** Revocation log parameters for license revocation events */
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

/** Usage log parameters for model invocation tracking */
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
