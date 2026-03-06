/**
 * RaaS Audit Service Layer
 * Handles license creation, validation, revocation, and audit logging
 *
 * Replaces direct Redis calls with Supabase database operations
 */

import { createAdminClient } from './supabase/admin'
import { logger } from './utils/logger-utility'
import { Tier } from '@/types'
import type {
  RaasLicenseRow as RaasLicense,
  RaasLicenseInsert,
  RaasLicenseUpdate,
  RaasAuditLogRow as RaasAuditLog,
  RaasAuditLogInsert,
  Json
} from './supabase/types'
import type {
  RaasAuditLogFilters,
  LicenseSummary,
  LicenseListResponse,
  AuditLogResponse,
  AuditAction,
  LicenseTier
} from './raas-schema'

// ============================================================================
// Type Definitions
// ============================================================================

interface LicenseCreationParams {
  tier: Tier
  nonce: string
  keyHash: string
  expiresAt: number
  createdBy?: string
  metadata?: Record<string, unknown>
}

interface AuditLogParams {
  action: AuditAction
  nonce: string
  tier?: string
  timestamp: number
  createdBy?: string
  userId?: string
  ipAddress?: string
  userAgent?: string
  details?: Record<string, unknown>
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Create a new license record in the database
 */
export async function createLicense(params: LicenseCreationParams): Promise<RaasLicense> {
  const supabase = createAdminClient()
  const createdAt = Math.floor(Date.now() / 1000)

  const licenseData: RaasLicenseInsert = {
    key_hash: params.keyHash,
    tier: params.tier as string,
    nonce: params.nonce,
    expires_at: params.expiresAt,
    created_at: createdAt,
    created_by: params.createdBy ?? null,
    metadata: (params.metadata ?? {}) as Json,
    is_revoked: false
  }

  const schema = supabase.from('raas_licenses') as any

  const { data, error } = await schema.insert(licenseData).select().single()

  if (error) {
    logger.error('Failed to create license in database', error)
    throw new Error(`Database error: ${error.message}`)
  }

  return data as RaasLicense
}

/**
 * Get license by nonce
 */
export async function getLicenseByNonce(nonce: string): Promise<RaasLicense | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('raas_licenses')
    .select('*')
    .eq('nonce', nonce)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    logger.error(`Failed to fetch license ${nonce}`, error)
    throw new Error(`Database error: ${error.message}`)
  }

  return data
}

/**
 * Get all licenses with pagination and filters
 */
export async function getLicenses(params: {
  tier?: Tier
  search?: string
  status?: 'active' | 'revoked' | 'expired'
  page?: number
  limit?: number
}): Promise<LicenseListResponse> {
  const supabase = createAdminClient()
  const { tier, search, status, page = 1, limit = 20 } = params

  // Build query
  let query = supabase.from('raas_licenses').select('*', { count: 'exact' })

  // Filter by tier
  if (tier) {
    query = query.eq('tier', tier)
  }

  // Filter by status
  const now = Math.floor(Date.now() / 1000)
  if (status === 'revoked') {
    query = query.eq('is_revoked', true)
  } else if (status === 'active') {
    // Note: String interpolation safe - 'now' is server-generated, not user input
    query = query.eq('is_revoked', false).or(`expires_at.is.null,expires_at.gt.${now}`)
  } else if (status === 'expired') {
    query = query.eq('is_revoked', false).lt('expires_at', now)
  }

  // Search by nonce suffix
  if (search) {
    query = query.ilike('nonce', `%${search}%`)
  }

  // Order by created_at desc
  query = query.order('created_at', { ascending: false })

  // Pagination
  const from = (page - 1) * limit
  const to = from + limit - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    logger.error('Failed to fetch licenses', error)
    throw new Error(`Database error: ${error.message}`)
  }

  // Transform to LicenseSummary format
  const licenses: LicenseSummary[] = (data || []).map((license: RaasLicense) => ({
    id: license.nonce,
    tier: license.tier as LicenseTier,
    createdAt: license.created_at,
    expiresAt: license.expires_at,
    isRevoked: license.is_revoked,
    revokedAt: license.revoked_at ?? undefined,
    validateCount: (license.metadata as { validateCount?: number })?.validateCount || 0,
    metadata: license.metadata
  }))

  const total = count || 0

  return {
    licenses,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  }
}

/**
 * Revoke a license by nonce
 */
export async function revokeLicense(
  nonce: string,
  revokedBy?: string
): Promise<RaasLicense> {
  const supabase = createAdminClient()
  const revokedAt = Math.floor(Date.now() / 1000)

  // First get the license to ensure it exists
  const existingLicense = await getLicenseByNonce(nonce)
  if (!existingLicense) {
    throw new Error(`License not found: ${nonce}`)
  }

  // Update revocation status
  const updateData: RaasLicenseUpdate = {
    is_revoked: true,
    revoked_at: revokedAt,
    revoked_by: revokedBy ?? null
  }

  const { data, error } = await (supabase
    .from('raas_licenses') as any)
    .update(updateData)
    .eq('nonce', nonce)
    .select()
    .single()

  if (error) {
    logger.error(`Failed to revoke license ${nonce}`, error)
    throw new Error(`Database error: ${error.message}`)
  }

  return data as RaasLicense
}

/**
 * Extend a license expiration date
 */
export async function extendLicense(
  nonce: string,
  days: number,
  extendedBy?: string
): Promise<RaasLicense> {
  const supabase = createAdminClient()

  // First get the license to ensure it exists
  const existingLicense = await getLicenseByNonce(nonce)
  if (!existingLicense) {
    throw new Error(`License not found: ${nonce}`)
  }

  // Check if license is revoked
  if (existingLicense.is_revoked) {
    throw new Error(`Cannot extend revoked license: ${nonce}`)
  }

  // Calculate new expiration date
  const now = Math.floor(Date.now() / 1000)
  const currentExpiresAt = existingLicense.expires_at ?? now
  const newExpiresAt = currentExpiresAt + (days * 24 * 60 * 60)

  // Update expiration
  const updateData: RaasLicenseUpdate = {
    expires_at: newExpiresAt
  }

  const { data, error } = await (supabase
    .from('raas_licenses') as any)
    .update(updateData)
    .eq('nonce', nonce)
    .select()
    .single()

  if (error) {
    logger.error(`Failed to extend license ${nonce}`, error)
    throw new Error(`Database error: ${error.message}`)
  }

  logger.info(`License extended: ${nonce} by ${days} days`)

  return data as RaasLicense
}

/**
 * Log license extension
 */
export async function logLicenseExtension(params: {
  nonce: string
  tier?: string
  days: number
  extendedBy?: string
  previousExpiresAt?: number
  newExpiresAt?: number
}): Promise<void> {
  await logAuditAction({
    action: 'UPDATE',
    nonce: params.nonce,
    tier: params.tier,
    timestamp: Math.floor(Date.now() / 1000),
    userId: params.extendedBy,
    details: {
      action: 'EXTEND',
      extendedBy: params.extendedBy,
      days: params.days,
      previousExpiresAt: params.previousExpiresAt,
      newExpiresAt: params.newExpiresAt
    }
  })
}

/**
 * Log an audit action
 */
export async function logAuditAction(params: AuditLogParams): Promise<void> {
  const supabase = createAdminClient()
  const createdAt = Math.floor(Date.now() / 1000)

  // Get license_id from nonce if possible
  let licenseId: string | null = null
  try {
    const license = await getLicenseByNonce(params.nonce)
    if (license) {
      licenseId = license.id
    }
  } catch {
    // License might not exist for validation attempts, that's OK
  }

  const logData: RaasAuditLogInsert = {
    action: params.action,
    license_id: licenseId,
    license_nonce: params.nonce,
    user_id: params.userId ?? params.createdBy ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    created_at: createdAt,
    details: (params.details ?? {
      tier: params.tier,
      timestamp: params.timestamp,
      createdBy: params.createdBy
    }) as Json
  }

  const { error } = await supabase
    .from('raas_audit_logs')
    .insert(logData as any)

  if (error) {
    logger.error('Failed to log audit action', error)
    // Don't throw - audit logging failure shouldn't block main operation
  }
}

/**
 * Log license creation
 */
export async function logLicenseCreation(params: {
  nonce: string
  tier: Tier
  timestamp: number
  createdBy?: string
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  await logAuditAction({
    action: 'CREATE',
    nonce: params.nonce,
    tier: params.tier,
    timestamp: params.timestamp,
    createdBy: params.createdBy,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent
  })
}

/**
 * Log license validation attempt
 */
export async function logLicenseValidation(params: {
  nonce: string
  isValid: boolean
  userId?: string
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  await logAuditAction({
    action: 'VALIDATE',
    nonce: params.nonce,
    timestamp: Math.floor(Date.now() / 1000),
    userId: params.userId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    details: { isValid: params.isValid }
  })
}

/**
 * Log license revocation
 */
export async function logLicenseRevocation(params: {
  nonce: string
  tier?: string
  revokedBy?: string
  reason?: string
  ipAddress?: string
}): Promise<void> {
  await logAuditAction({
    action: 'REVOKE',
    nonce: params.nonce,
    tier: params.tier,
    timestamp: Math.floor(Date.now() / 1000),
    userId: params.revokedBy,
    ipAddress: params.ipAddress,
    details: {
      revokedBy: params.revokedBy,
      reason: params.reason
    }
  })
}

/**
 * Get audit logs with filters and pagination
 */
export async function getAuditLogs(filters: RaasAuditLogFilters): Promise<AuditLogResponse> {
  const supabase = createAdminClient()
  const {
    action,
    license_id,
    license_nonce,
    user_id,
    page = 1,
    limit = 50,
    orderBy = 'created_at',
    orderDir = 'desc',
    startDate,
    endDate
  } = filters

  // Build query
  let query = supabase.from('raas_audit_logs').select('*', { count: 'exact' })

  // Apply filters
  if (action) {
    query = query.eq('action', action)
  }
  if (license_id) {
    query = query.eq('license_id', license_id)
  }
  if (license_nonce) {
    query = query.eq('license_nonce', license_nonce)
  }
  if (user_id) {
    query = query.eq('user_id', user_id)
  }
  // Date range filters for retention policy
  if (startDate) {
    query = query.gte('created_at', startDate)
  }
  if (endDate) {
    query = query.lte('created_at', endDate)
  }

  // Order
  query = query.order(orderBy, { ascending: orderDir === 'asc' })

  // Pagination
  const from = (page - 1) * limit
  const to = from + limit - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    logger.error('Failed to fetch audit logs', error)
    throw new Error(`Database error: ${error.message}`)
  }

  return {
    logs: data || [],
    total: count || 0,
    page,
    limit
  }
}

/**
 * Get audit logs by license nonce
 */
export async function getAuditLogsByLicense(nonce: string): Promise<RaasAuditLog[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('raas_audit_logs')
    .select('*')
    .eq('license_nonce', nonce)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error(`Failed to fetch audit logs for license ${nonce}`, error)
    throw new Error(`Database error: ${error.message}`)
  }

  return data || []
}

/**
 * Update license validation count
 */
export async function incrementValidationCount(nonce: string): Promise<void> {
  const supabase = createAdminClient()

  // Get current license
  const license = await getLicenseByNonce(nonce)
  if (!license) {
    logger.warn(`Cannot increment validation count - license ${nonce} not found`)
    return
  }

  const currentMetadata = (license.metadata as { validateCount?: number }) ?? {}
  const newCount = (currentMetadata.validateCount ?? 0) + 1

  const { error } = await (supabase
    .from('raas_licenses') as any)
    .update({
      metadata: { ...currentMetadata, validateCount: newCount }
    })
    .eq('nonce', nonce)

  if (error) {
    logger.error(`Failed to increment validation count for ${nonce}`, error)
  }
}

/**
 * Export audit logs to JSON format
 */
export async function exportAuditLogs(options?: {
  action?: string
  startDate?: number
  endDate?: number
}): Promise<string> {
  const supabase = createAdminClient()

  let query = supabase.from('raas_audit_logs').select('*')

  if (options?.action) {
    query = query.eq('action', options.action)
  }

  if (options?.startDate) {
    query = query.gte('created_at', options.startDate)
  }

  if (options?.endDate) {
    query = query.lte('created_at', options.endDate)
  }

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) {
    logger.error('Failed to export audit logs', error)
    throw new Error(`Database error: ${error.message}`)
  }

  return JSON.stringify(data, null, 2)
}

/**
 * Reactivate license by Polar subscription ID
 * Called when subscription becomes active after past_due
 */
export async function reactivateLicenseBySubscription(
  polarSubscriptionId: string
): Promise<RaasLicense | null> {
  const supabase = createAdminClient()

  // Find license by metadata
  const { data: license, error } = await (supabase
    .from('raas_licenses') as any)
    .select('*')
    .eq('metadata->>polarSubscriptionId', polarSubscriptionId)
    .single()

  if (error || !license) {
    logger.warn(`License not found for Polar subscription ${polarSubscriptionId}`)
    return null
  }

  // Reactivate
  const { data: updated, error: updateError } = await (supabase
    .from('raas_licenses') as any)
    .update({
      is_revoked: false,
      revoked_at: null,
      revoked_by: null,
      metadata: { ...(license.metadata as Record<string, unknown>), reactivated_at: Date.now() },
    })
    .eq('nonce', license.nonce)
    .select()
    .single()

  if (updateError) {
    logger.error(`Failed to reactivate license ${license.nonce}`, updateError)
    throw updateError
  }

  // Log audit
  await logAuditAction({
    action: 'UPDATE',
    nonce: license.nonce,
    tier: license.tier,
    timestamp: Math.floor(Date.now() / 1000),
    details: { action: 'REACTIVATE', polarSubscriptionId },
  })

  logger.info(`License reactivated for Polar subscription ${polarSubscriptionId}`, {
    nonce: license.nonce.slice(0, 8),
  })

  return updated as RaasLicense
}

/**
 * Revoke license by subscription ID (Polar or Stripe)
 * Supports soft revoke (access until period_end) and hard revoke (immediate)
 */
export async function revokeLicenseBySubscription(
  subscriptionId: string,
  options: {
    soft?: boolean
    revokeAt?: number
    provider?: 'polar' | 'stripe'
  } = {}
): Promise<RaasLicense | null> {
  const supabase = createAdminClient()
  const revokedAt = options.revokeAt || Math.floor(Date.now() / 1000)
  const metadataKey = options.provider === 'stripe' ? 'stripeSubscriptionId' : 'polarSubscriptionId'

  // Find license by metadata
  const { data: license, error } = await (supabase
    .from('raas_licenses') as any)
    .select('*')
    .eq('metadata->>' + metadataKey, subscriptionId)
    .single()

  if (error || !license) {
    logger.warn(`License not found for subscription ${subscriptionId}`)
    return null
  }

  // Revoke
  const { data: updated, error: updateError } = await (supabase
    .from('raas_licenses') as any)
    .update({
      is_revoked: true,
      revoked_at: revokedAt,
      metadata: {
        ...(license.metadata as Record<string, unknown>),
        revoked_by_subscription: true,
        soft_revoke: options.soft ?? false,
      },
    })
    .eq('nonce', license.nonce)
    .select()
    .single()

  if (updateError) {
    logger.error(`Failed to revoke license ${license.nonce}`, updateError)
    throw updateError
  }

  // Log audit
  await logLicenseRevocation({
    nonce: license.nonce,
    tier: license.tier,
    reason: options.soft ? 'subscription_cancelled' : 'subscription_expired',
  })

  logger.info(`License revoked for subscription ${subscriptionId}`, {
    nonce: license.nonce.slice(0, 8),
    softRevoke: options.soft,
  })

  return updated as RaasLicense
}
