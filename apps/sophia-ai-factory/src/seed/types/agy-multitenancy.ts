/**
 * Seed Types: AGY Multi-Tenancy & Tenant Isolation
 *
 * Defines pure contracts, entities, and validation models for AgencyOS multi-tenancy,
 * domain routing, tenant tokens, sliding-window rate-limiting, and quota enforcement.
 *
 * Layer: seed (pure types, zero side-effects, zero upper-layer dependencies)
 *
 * @module seed/types/agy-multitenancy
 */

export type AgencyTenantStatus = 'active' | 'suspended' | 'deprovisioned';

export interface AgencyTenantConfig {
  agencyId: string;
  orgId: string;
  agencySlug: string;
  customDomain?: string | null;
  status: AgencyTenantStatus;
  quotaLimitMcu: number;
  quotaUsedMcu: number;
  rateLimitRps: number;
  createdAt: number;
  updatedAt: number;
  // Raw D1 column compatibility aliases
  agency_id?: string;
  org_id?: string;
  agency_slug?: string;
  custom_domain?: string | null;
  quota_limit_mcu?: number;
  quota_used_mcu?: number;
  rate_limit_rps?: number;
  created_at?: number;
  updated_at?: number;
}

export interface AgyTenantToken {
  id: string;
  agencyId: string;
  tokenHash: string;
  name: string;
  permissions: string[];
  expiresAt: number | null;
  createdAt: number;
  revokedAt: number | null;
  token?: string; // Cleartext token returned only upon issuance
  // Raw D1 column compatibility aliases
  agency_id?: string;
  token_hash?: string;
  permissions_json?: string;
  expires_at?: number | null;
  created_at?: number;
  revoked_at?: number | null;
}

export type AgencyDomainType = 'subdomain' | 'custom';
export type AgencySslStatus = 'pending' | 'active' | 'error';

export interface AgencyDomainRecord {
  id: string;
  agencyId: string;
  domain: string;
  domainType: AgencyDomainType;
  sslStatus: AgencySslStatus;
  verificationToken: string | null;
  isPrimary: boolean;
  createdAt: number;
  // Raw D1 column compatibility aliases
  agency_id?: string;
  domain_type?: AgencyDomainType;
  ssl_status?: AgencySslStatus;
  verification_token?: string | null;
  is_primary?: number | boolean;
  created_at?: number;
}

export interface TenantResolutionResult {
  isAgencySubdomain: boolean;
  isCustomDomain: boolean;
  agencySlug: string | null;
  tenantOrgId: string | null;
  agencyId: string | null;
  isInternal: boolean;
  whitelabelActive: boolean;
  sslStatus?: AgencySslStatus | 'pending_validation' | 'pending_deployment' | null;
}

export interface QuotaEvaluationResult {
  allowed: boolean;
  agencyId: string;
  quotaLimitMcu: number;
  quotaUsedMcu: number;
  remainingMcu: number;
  deficitMcu: number;
  status: 'ok' | 'warning' | 'exhausted';
  reason?: string;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  agencyId: string;
  currentRps: number;
  limitRps: number;
  remaining: number;
  resetMs: number;
  retryAfterSeconds?: number;
}

export interface AgyAuditLogRecord {
  id: string;
  agencyId: string;
  eventType: string;
  actorId: string | null;
  resource: string;
  details: Record<string, unknown>;
  ipAddress: string | null;
  timestamp: number;
  // Raw D1 column compatibility aliases
  agency_id?: string;
  event_type?: string;
  actor_id?: string | null;
  details_json?: string;
  ip_address?: string | null;
}

export interface AgencyTenantContext {
  agencyId: string;
  orgId: string;
  agencySlug: string;
  customDomain?: string | null;
  quotaLimitMcu: number;
  quotaUsedMcu: number;
  rateLimitRps: number;
  status: AgencyTenantStatus;
}
