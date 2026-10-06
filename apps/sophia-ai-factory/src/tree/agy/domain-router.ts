/**
 * Domain Router for AGY Multi-Tenancy
 *
 * Provides pure, deterministic hostname parsing, subdomain classification,
 * agency slug resolution, and platform reserved subdomain partitioning.
 *
 * Invariants:
 * - Pure logic: 0 side effects, 0 database queries, 0 network calls.
 * - Layer: tree (imports only @/seed/*).
 *
 * @module tree/agy/domain-router
 */

import type {
  TenantResolutionResult,
} from '@/seed/types/agy-multitenancy';

/** Platform reserved subdomains that cannot be registered or used as agency slugs */
export const RESERVED_PLATFORM_SUBDOMAINS: ReadonlySet<string> = new Set([
  'sophia',
  'api',
  'admin',
  'portal',
  'sub',
  'preview',
  'cname',
  'cdn',
  'workers',
  'pages',
  'app',
  'www',
  'status',
  'docs',
  'staging',
  'mail',
  'auth',
  'billing',
  'assets',
  'static',
  'dashboard',
  'root',
  'login',
  'signup',
  'register',
  'raas',
]);

/** Canonical base domain for AgencyOS */
export const CANONICAL_NETWORK_DOMAIN = 'agencyos.network';

/**
 * Normalizes hostname:
 * - Trims whitespace and converts to lowercase
 * - Strips protocol (http://, https://)
 * - Strips path segments
 * - Strips ports and IPv6 brackets
 * - Strips trailing DNS dots
 */
export function normalizeHostname(rawHost: string | null | undefined): string {
  if (!rawHost) return '';
  let host = rawHost.trim().toLowerCase();

  // Strip protocol
  if (host.startsWith('http://')) host = host.slice(7);
  if (host.startsWith('https://')) host = host.slice(8);

  // Strip path if present
  const slashIdx = host.indexOf('/');
  if (slashIdx !== -1) host = host.slice(0, slashIdx);

  // Strip IPv6 brackets or port
  if (host.startsWith('[')) {
    const endBracket = host.indexOf(']');
    if (endBracket !== -1) {
      host = host.slice(1, endBracket);
    }
  } else {
    const colonIdx = host.indexOf(':');
    if (colonIdx !== -1) {
      host = host.slice(0, colonIdx);
    }
  }

  // Strip trailing dots
  return host.replace(/\.+$/, '');
}

/**
 * Checks if a subdomain or candidate slug is reserved by the platform.
 * Returns true if reserved (forbidden for customer agency usage), false if available.
 */
export function partitionReservedSubdomains(subdomain: string): boolean {
  if (!subdomain) return true;
  const clean = subdomain.trim().toLowerCase();
  if (!clean) return true;
  return RESERVED_PLATFORM_SUBDOMAINS.has(clean);
}

/**
 * Validates whether a candidate string is a syntactically valid agency slug.
 * Rules:
 * - Lowercase alphanumeric and hyphens only
 * - 2 to 63 characters long
 * - Cannot start or end with a hyphen
 * - Cannot be in RESERVED_PLATFORM_SUBDOMAINS
 */
export function isValidAgencySlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') return false;
  const clean = slug.trim();
  if (clean !== clean.toLowerCase()) return false;
  if (clean.length < 2 || clean.length > 63) return false;
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(clean)) return false;
  if (partitionReservedSubdomains(clean)) return false;
  return true;
}

export type HostnameClassificationType =
  | 'canonical'
  | 'reserved_subdomain'
  | 'agency_subdomain'
  | 'custom_domain'
  | 'localhost';

export interface HostnameClassification {
  type: HostnameClassificationType;
  slug: string | null;
  normalized: string;
}

/**
 * Classifies a normalized hostname into platform canonical, reserved subdomain,
 * agency tenant subdomain, custom domain, or local development host.
 */
export function classifySubdomain(rawHostname: string | null | undefined): HostnameClassification {
  const normalized = normalizeHostname(rawHostname);
  if (!normalized) {
    return { type: 'canonical', slug: null, normalized: '' };
  }

  // Localhost & Loopback
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '0.0.0.0' ||
    normalized === '::1' ||
    /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/.test(normalized)
  ) {
    return { type: 'localhost', slug: null, normalized };
  }

  // Cloudflare preview workers & pages
  if (normalized.endsWith('.pages.dev') || normalized.endsWith('.workers.dev')) {
    return { type: 'canonical', slug: null, normalized };
  }

  // AgencyOS network checking
  if (normalized === CANONICAL_NETWORK_DOMAIN || normalized === `sophia.${CANONICAL_NETWORK_DOMAIN}`) {
    return { type: 'canonical', slug: null, normalized };
  }

  if (normalized.endsWith(`.${CANONICAL_NETWORK_DOMAIN}`)) {
    const subPart = normalized.slice(0, -(CANONICAL_NETWORK_DOMAIN.length + 1));
    const parts = subPart.split('.');

    // Multi-level nested subdomains (e.g. deep.nested.agencyos.network) are platform internal
    if (parts.length > 1) {
      return { type: 'canonical', slug: null, normalized };
    }

    const slug = parts[0]!;
    if (partitionReservedSubdomains(slug)) {
      return { type: 'reserved_subdomain', slug, normalized };
    }
    return { type: 'agency_subdomain', slug, normalized };
  }

  // Any other domain is treated as a potential customer custom domain
  return { type: 'custom_domain', slug: null, normalized };
}

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
export function parseHostnames(rawHostname: string | null | undefined): {
  normalized: string;
  isAgencySubdomain: boolean;
  agencySlug: string | null;
  isReserved: boolean;
  isCustomDomain: boolean;
  isCanonical: boolean;
} {
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
