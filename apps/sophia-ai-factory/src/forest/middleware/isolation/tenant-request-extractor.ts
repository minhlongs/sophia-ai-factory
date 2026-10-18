/**
 * Tenant token and agency identifier request header extraction helpers
 * @module forest/middleware/isolation/tenant-request-extractor
 */

import type { NextRequest } from 'next/server';
import { resolveAgencySlugFromHostname } from '@/tree/agy/domain-router';

/**
 * Extracts raw tenant token from Authorization header or custom headers
 */
export function extractTenantToken(request: NextRequest | Request): string | null {
  const headers = request.headers;

  // 1. Check x-tenant-token
  const customHeader = headers.get('x-tenant-token');
  if (customHeader) return customHeader.trim();

  // 2. Check Authorization Bearer
  const authHeader = headers.get('authorization');
  if (authHeader) {
    const trimmed = authHeader.trim();
    if (/^bearer\s+agy_tok_/i.test(trimmed)) {
      return trimmed.replace(/^bearer\s+/i, '').trim();
    }
  }

  return null;
}

/**
 * Extracts effective agency identifier or slug from headers or hostname
 */
export function extractAgencyIdentifier(request: NextRequest | Request): {
  agencyId: string | null;
  agencySlug: string | null;
} {
  const headers = request.headers;

  const agencyId =
    headers.get('x-agency-id') ||
    headers.get('x-raas-agency-id') ||
    null;

  let agencySlug = headers.get('x-agency-slug');

  if (!agencySlug) {
    const hostHeader = headers.get('x-forwarded-host') || headers.get('host');
    if (hostHeader) {
      agencySlug = resolveAgencySlugFromHostname(hostHeader);
    }
  }

  return { agencyId, agencySlug };
}
