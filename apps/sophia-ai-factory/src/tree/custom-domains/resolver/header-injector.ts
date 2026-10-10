/**
 * Request Header Injection and Downstream Accessor Helpers
 *
 * @module tree/custom-domains/resolver/header-injector
 */

import type { TenantHostnameContext } from './types';

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
  requestHeaders.delete('x-agency-id');
  requestHeaders.delete('x-agency-slug');
  requestHeaders.delete('x-is-agency-subdomain');

  const domainValue = context.customDomain || context.hostname || '';

  if (context.agencyId) {
    requestHeaders.set('x-agency-id', context.agencyId);
  }
  if (context.agencySlug) {
    requestHeaders.set('x-agency-slug', context.agencySlug);
  }
  if (context.isAgencySubdomain) {
    requestHeaders.set('x-is-agency-subdomain', 'true');
  }

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

export function getAgencyId(headers: Headers): string | null {
  return headers.get('x-agency-id');
}

export function getAgencySlug(headers: Headers): string | null {
  return headers.get('x-agency-slug');
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
