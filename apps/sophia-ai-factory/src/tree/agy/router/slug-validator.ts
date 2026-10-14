import { RESERVED_PLATFORM_SUBDOMAINS } from './constants';

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
