/**
 * Hostname Normalization and Platform Internal Classification Utilities
 *
 * @module tree/custom-domains/resolver/hostname-utils
 */

import { classifySubdomain } from '@/tree/agy/domain-router';

/** Platform canonical domains and patterns that must never query D1 */
export const CANONICAL_DOMAINS = new Set([
  'sophia.agencyos.network',
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
]);

/**
 * Normalizes raw incoming host header by lowercasing, trimming,
 * and stripping port numbers and trailing dots.
 */
export function normalizeHostname(rawHost: string | null | undefined): string {
  if (!rawHost) return '';
  let host = rawHost.trim().toLowerCase();

  // Strip protocol if erroneously passed
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
    // Strip standard port
    const colonIdx = host.indexOf(':');
    if (colonIdx !== -1) {
      host = host.slice(0, colonIdx);
    }
  }

  // Strip trailing dots (DNS FQDN)
  host = host.replace(/\.+$/, '');

  return host;
}

/**
 * Checks if a hostname belongs to platform infrastructure or local development.
 * Ignores:
 * - localhost, 127.0.0.1 (IPv4 loopback block 127.0.0.0/8), ::1
 * - sophia.agencyos.network and *.agencyos.network
 * - *.pages.dev (Cloudflare Pages preview deployments)
 * - *.workers.dev (Cloudflare Workers preview deployments)
 * - Hostnames matching NEXT_PUBLIC_APP_URL or APP_URL env vars
 */
export function isInternalOrCanonicalHostname(hostname: string): boolean {
  if (!hostname) return true;

  if (CANONICAL_DOMAINS.has(hostname)) return true;

  // Localhost or IPv4 loopback
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  if (/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/.test(hostname) || hostname === '0.0.0.0') return true;

  // Cloudflare edge platform domains
  if (hostname.endsWith('.pages.dev') || hostname === 'pages.dev') return true;
  if (hostname.endsWith('.workers.dev') || hostname === 'workers.dev') return true;

  // AgencyOS canonical network & reserved subdomains
  if (hostname.endsWith('.agencyos.network') || hostname === 'agencyos.network') {
    const classification = classifySubdomain(hostname);
    if (classification.type === 'canonical' || classification.type === 'reserved_subdomain') {
      return true;
    }
    // Non-reserved agency subdomains (e.g. acme.agencyos.network) are tenant subdomains, not internal
    return false;
  }

  // Check against runtime environment app URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (appUrl) {
    try {
      const parsed = new URL(appUrl).hostname.toLowerCase();
      if (hostname === parsed) return true;
    } catch {
      // ignore URL parse errors
    }
  }

  return false;
}

/**
 * Extracts normalized hostname from incoming Request or Headers.
 * Prioritizes x-forwarded-host (reverse proxy / Cloudflare) over host header.
 */
export function extractHostname(source: Request | Headers | string | null | undefined): string {
  if (!source) return '';
  if (typeof source === 'string') return normalizeHostname(source);

  const headers = source instanceof Request ? source.headers : source;
  const forwardedHost = headers.get('x-forwarded-host');
  if (forwardedHost) {
    // x-forwarded-host may be comma-separated: take client-first entry
    const first = forwardedHost.split(',')[0];
    return normalizeHostname(first);
  }

  const host = headers.get('host');
  if (host) return normalizeHostname(host);

  if (source instanceof Request) {
    try {
      return normalizeHostname(new URL(source.url).hostname);
    } catch {
      return '';
    }
  }

  return '';
}
