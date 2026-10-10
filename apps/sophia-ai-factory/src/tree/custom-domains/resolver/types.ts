/**
 * Types for Hostname-to-Tenant Edge Router
 *
 * @module tree/custom-domains/resolver/types
 */

export interface TenantHostnameContext {
  /** True if the domain is a platform canonical or development domain */
  isInternal: boolean;
  /** True if the domain is recognized as a tenant custom domain */
  isCustomDomain: boolean;
  /** Tenant organization ID if mapped, otherwise null */
  tenantOrgId: string | null;
  /** Normalized custom domain string, or null */
  customDomain: string | null;
  /** Optional raw or resolved hostname string */
  hostname?: string;
  /** True only if active=1 AND ssl_status='active' */
  whitelabelActive: boolean;
  /** Current SSL certificate status */
  sslStatus: 'pending_validation' | 'pending_deployment' | 'active' | 'error' | null;
  /** AGY Multi-tenancy metadata */
  isAgencySubdomain?: boolean;
  agencySlug?: string | null;
  agencyId?: string | null;
}

export type TenantBrandingContext = TenantHostnameContext;

export interface CacheEntry {
  context: TenantHostnameContext;
  expiresAt: number;
}
