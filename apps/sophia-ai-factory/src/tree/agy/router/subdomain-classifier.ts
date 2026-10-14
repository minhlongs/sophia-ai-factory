import type { HostnameClassification } from './types';
import { CANONICAL_NETWORK_DOMAIN } from './constants';
import { normalizeHostname, partitionReservedSubdomains } from './slug-validator';

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
