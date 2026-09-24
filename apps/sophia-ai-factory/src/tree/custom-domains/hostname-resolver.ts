/**
 * Hostname-to-Tenant Edge Router
 * 
 * Maps incoming HTTP Host / X-Forwarded-Host headers to tenant organization context.
 * Filters internal/canonical hostnames early to bypass database queries.
 * Queries Cloudflare D1 custom_domains table with in-memory edge caching.
 *
 * Layer: tree (pure domain logic)
 * Allowed imports: @/seed/*
 *
 * @module tree/custom-domains/hostname-resolver
 */

import { logger } from '@/seed/utils/logger-utility';

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
}

export type TenantBrandingContext = TenantHostnameContext;

interface CacheEntry {
  context: TenantHostnameContext;
  expiresAt: number;
}

/** In-memory isolate cache for custom domain resolution (60s TTL) */
const DOMAIN_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;
const NEGATIVE_CACHE_TTL_MS = 10_000;
const MAX_CACHE_SIZE = 500;

/** Platform canonical domains and patterns that must never query D1 */
const CANONICAL_DOMAINS = new Set([
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

  // AgencyOS canonical network
  if (hostname.endsWith('.agencyos.network') || hostname === 'agencyos.network') return true;

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

/**
 * Resolves custom hostname against active custom_domains table in D1.
 * Applies in-memory edge caching to prevent D1 contention.
 */
export async function resolveTenantFromHostname(
  db: D1Database | null,
  rawHost: string | null | undefined,
): Promise<TenantHostnameContext> {
  const hostname = normalizeHostname(rawHost);

  // 1. Check canonical / internal domains
  if (!hostname || isInternalOrCanonicalHostname(hostname)) {
    return {
      isInternal: true,
      isCustomDomain: false,
      tenantOrgId: null,
      customDomain: null,
      whitelabelActive: false,
      sslStatus: null,
    };
  }

  // 2. Check isolate in-memory cache
  const cached = DOMAIN_CACHE.get(hostname);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.context;
  }

  // 3. Fallback when D1 database is unavailable (e.g. build step or early init)
  if (!db) {
    const unverifiedContext: TenantHostnameContext = {
      isInternal: false,
      isCustomDomain: true,
      tenantOrgId: null,
      customDomain: hostname,
      whitelabelActive: false,
      sslStatus: null,
    };
    return unverifiedContext;
  }

  // 4. Query D1 database
  try {
    const row = await db
      .prepare(
        `SELECT org_id, hostname, active, ssl_status
         FROM custom_domains
         WHERE hostname = ?1 AND active = 1
         LIMIT 1`
      )
      .bind(hostname)
      .first<{
        org_id: string;
        hostname: string;
        active: number;
        ssl_status: string;
      }>();

    if (row && row.org_id) {
      const isSslActive = row.ssl_status === 'active';
      const context: TenantHostnameContext = {
        isInternal: false,
        isCustomDomain: true,
        tenantOrgId: row.org_id,
        customDomain: row.hostname,
        whitelabelActive: row.active === 1 && isSslActive,
        sslStatus: (row.ssl_status as TenantHostnameContext['sslStatus']) ?? 'pending_validation',
      };

      setInCache(hostname, context, CACHE_TTL_MS);
      return context;
    }

    // 5. Hostname not found in custom_domains table (negative cache)
    const notFoundContext: TenantHostnameContext = {
      isInternal: false,
      isCustomDomain: true,
      tenantOrgId: null,
      customDomain: hostname,
      whitelabelActive: false,
      sslStatus: null,
    };

    setInCache(hostname, notFoundContext, NEGATIVE_CACHE_TTL_MS);
    return notFoundContext;
  } catch (err) {
    logger.warn('[hostname-resolver] Error resolving hostname in D1', {
      hostname,
      error: String(err),
    });

    return {
      isInternal: false,
      isCustomDomain: true,
      tenantOrgId: null,
      customDomain: hostname,
      whitelabelActive: false,
      sslStatus: null,
    };
  }
}

function setInCache(key: string, context: TenantHostnameContext, ttlMs: number): void {
  if (DOMAIN_CACHE.size >= MAX_CACHE_SIZE) {
    const oldestKey = DOMAIN_CACHE.keys().next().value;
    if (oldestKey) DOMAIN_CACHE.delete(oldestKey);
  }
  DOMAIN_CACHE.set(key, {
    context,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Clears the edge hostname resolution cache (useful for testing or domain updates).
 */
export function clearHostnameCache(): void {
  DOMAIN_CACHE.clear();
}

/**
 * Injects resolved tenant headers into requestHeaders for downstream Next.js handlers.
 * Deletes untrusted incoming client headers to prevent spoofing, and URI-encodes
 * domain strings to guarantee WHATWG ByteString compliance.
 */
export function injectTenantRoutingHeaders(
  requestHeaders: Headers,
  context: TenantHostnameContext,
): void {
  // Delete untrusted client incoming headers
  requestHeaders.delete('x-tenant-org-id');
  requestHeaders.delete('x-custom-domain');
  requestHeaders.delete('x-whitelabel-active');

  const domainValue = context.customDomain || context.hostname || '';

  if (context.whitelabelActive && context.tenantOrgId) {
    requestHeaders.set('x-tenant-org-id', context.tenantOrgId);
    requestHeaders.set('x-custom-domain', encodeURI(domainValue));
    requestHeaders.set('x-whitelabel-active', 'true');
  } else if (context.isCustomDomain && domainValue) {
    if (context.tenantOrgId) {
      requestHeaders.set('x-tenant-org-id', context.tenantOrgId);
    }
    requestHeaders.set('x-custom-domain', encodeURI(domainValue));
    requestHeaders.set('x-whitelabel-active', 'false');
  } else {
    requestHeaders.set('x-whitelabel-active', 'false');
  }
}

/**
 * Downstream accessor helpers for Server Components, Route Handlers, and Actions.
 */
export function getTenantOrgId(headers: Headers): string | null {
  return headers.get('x-tenant-org-id');
}

export function getCustomDomain(headers: Headers): string | null {
  return headers.get('x-custom-domain');
}

export function isWhitelabelActive(headers: Headers): boolean {
  return headers.get('x-whitelabel-active') === 'true';
}
