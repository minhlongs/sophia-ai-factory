/**
 * RaaS License Database Schema
 * TypeScript interfaces matching Supabase tables
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * License Tier Enum
 * Matches the Tier type from @/types
 */
export type LicenseTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'

/**
 * Audit Action Types
 */
export type AuditAction = 'CREATE' | 'VALIDATE' | 'REVOKE' | 'UPDATE'

// ============================================================================
// raas_licenses table
// ============================================================================

/**
 * RaasLicense - Full license record (SELECT response)
 */
export interface RaasLicense {
  id: string                        // UUID
  key_hash: string                  // SHA256 hash of full key
  tier: LicenseTier
  expires_at: number | null         // Unix timestamp (0 = perpetual)
  nonce: string                     // 32-char hex nonce
  is_revoked: boolean
  revoked_at: number | null         // Unix timestamp
  revoked_by: string | null         // User UUID
  created_by: string | null         // User UUID
  created_at: number                // Unix timestamp
  metadata: Json
  updated_at: number | null         // Unix timestamp
}

/**
 * RaasLicenseInsert - For INSERT operations (id, timestamps optional)
 */
export interface RaasLicenseInsert {
  key_hash: string
  tier: LicenseTier
  expires_at?: number | null
  nonce: string
  is_revoked?: boolean
  revoked_at?: number | null
  revoked_by?: string | null
  created_by?: string | null
  created_at?: number
  metadata?: Json
}

/**
 * RaasLicenseUpdate - For UPDATE operations (all fields optional)
 */
export interface RaasLicenseUpdate {
  key_hash?: string
  tier?: LicenseTier
  expires_at?: number | null
  nonce?: string
  is_revoked?: boolean
  revoked_at?: number | null
  revoked_by?: string | null
  created_by?: string | null
  metadata?: Json
}

// ============================================================================
// raas_audit_logs table
// ============================================================================

/**
 * RaasAuditLog - Full audit log record
 */
export interface RaasAuditLog {
  id: string                        // UUID
  action: AuditAction
  license_id: string | null         // FK to raas_licenses
  license_nonce: string | null      // Denormalized nonce
  user_id: string | null            // User UUID
  ip_address: string | null
  user_agent: string | null
  details: Json
  created_at: number                // Unix timestamp
}

/**
 * RaasAuditLogInsert - For INSERT operations
 */
export interface RaasAuditLogInsert {
  action: AuditAction
  license_id?: string | null
  license_nonce?: string | null
  user_id?: string | null
  ip_address?: string | null
  user_agent?: string | null
  details?: Json
  created_at?: number
}

/**
 * RaasAuditLogFilters - Query filters for audit logs
 */
export interface RaasAuditLogFilters {
  action?: AuditAction
  license_id?: string
  license_nonce?: string
  user_id?: string
  page?: number
  limit?: number
  orderBy?: 'created_at' | 'action'
  orderDir?: 'asc' | 'desc'
  startDate?: number // Unix timestamp for date range filter
  endDate?: number // Unix timestamp for date range filter
}

// ============================================================================
// License Summary (API response shape)
// ============================================================================

/**
 * LicenseSummary - Public-facing license info (no sensitive data)
 */
export interface LicenseSummary {
  id: string                        // nonce
  tier: LicenseTier
  createdAt: number
  expiresAt: number | null
  isRevoked: boolean
  revokedAt?: number
  validateCount: number
  metadata?: Json
}

/**
 * LicenseListResponse - Paginated license list response
 */
export interface LicenseListResponse {
  licenses: LicenseSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * AuditLogResponse - Paginated audit log response
 */
export interface AuditLogResponse {
  logs: RaasAuditLog[]
  total: number
  page: number
  limit: number
}
