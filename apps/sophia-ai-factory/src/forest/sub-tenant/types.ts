/**
 * Agency / Sub-tenant domain types.
 *
 * Source of truth: seed/types/agency.ts defines database row types.
 * This file defines the richer runtime context types used by forest modules.
 */

export type AgencyTier = 'starter' | 'growth' | 'enterprise'
export type AgencyStatus = 'active' | 'suspended' | 'cancelled'
export type SubTenantStatus = 'active' | 'suspended'

/** Agency row as returned from D1 (mirrors seed/types/agency.ts + DB columns). */
export interface Agency {
  id: number
  slug: string
  name: string
  tier: AgencyTier
  apiKeyPrefix: string | null
  apiKeyHash: string | null
  ownerUserId: number
  billingEmail: string | null
  status: AgencyStatus
  brandingJson: string | null
  createdAt: number
  updatedAt: number
}

export interface SubTenant {
  id: number
  agencyId: number | null
  ownerUserId: number
  displayName: string | null
  status: SubTenantStatus
  createdAt: number
}

export interface AgencyContext {
  agency: Agency
  subTenant: SubTenant | null
  /** Header values to forward to downstream services */
  forwardedHeaders: Record<string, string>
}
