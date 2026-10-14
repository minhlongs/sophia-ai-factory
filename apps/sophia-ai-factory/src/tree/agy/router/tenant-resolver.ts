import type { TenantResolutionResult } from '@/seed/types/agy-multitenancy';
import type { ParsedHostnameMetadata } from './types';
import { classifySubdomain } from './subdomain-classifier';

/**
 * Resolves agency slug from incoming hostname if it matches [agencySlug].agencyos.network
 * and is not a reserved platform subdomain.
 * Returns the slug string, or null if not an agency subdomain.
 */
export function resolveAgencySlugFromHostname(rawHostname: string | null | undefined): string | null {
  const classification = classifySubdomain(rawHostname);
  if (classification.type === 'agency_subdomain') {
    return classification.slug;
  }
  return null;
}

/**
 * Check if hostname is an agency subdomain on agencyos.network
 */
export function isAgencySubdomain(rawHostname: string | null | undefined): boolean {
  return classifySubdomain(rawHostname).type === 'agency_subdomain';
}

/**
 * Comprehensive parser for incoming hostnames, returning complete routing metadata.
 */
export function parseHostnames(rawHostname: string | null | undefined): ParsedHostnameMetadata {
  const classification = classifySubdomain(rawHostname);
  return {
    normalized: classification.normalized,
    isAgencySubdomain: classification.type === 'agency_subdomain',
    agencySlug: classification.slug,
    isReserved: classification.type === 'reserved_subdomain',
    isCustomDomain: classification.type === 'custom_domain',
    isCanonical: classification.type === 'canonical' || classification.type === 'localhost',
  };
}

/**
 * Evaluates initial TenantResolutionResult purely from hostname before database lookup.
 */
export function resolveTenantRoutingMetadata(rawHostname: string | null | undefined): TenantResolutionResult {
  const parsed = parseHostnames(rawHostname);

  return {
    isAgencySubdomain: parsed.isAgencySubdomain,
    isCustomDomain: parsed.isCustomDomain,
    agencySlug: parsed.agencySlug,
    tenantOrgId: null,
    agencyId: null,
    isInternal: parsed.isCanonical || parsed.isReserved,
    whitelabelActive: false,
    sslStatus: null,
  };
}
