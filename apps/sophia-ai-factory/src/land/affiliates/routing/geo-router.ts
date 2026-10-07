/**
 * Geo-Affiliate Router
 *
 * Routes visitors to appropriate affiliate offer based on geo-location (IP)
 * for localized conversion optimization.
 *
 * Layer: land/affiliates/routing (Business Workflow)
 * @module land/affiliates/routing/geo-router
 */

import type { NextRequest } from 'next/server';

// Standard mapping for geo-targeted affiliate offers
const GEO_MAPPINGS = {
  VN: {
    saas: 'https://affiliate.localvn.com/v1',
    crypto: 'https://vn-crypto-exchange.com',
  },
  DEFAULT: {
    saas: 'https://saas-global.com',
    crypto: 'https://crypto-global.com',
  },
};

export function getAffiliateRoute(
  request: NextRequest,
  niche: 'saas' | 'crypto',
): string {
  // Use Cloudflare IP header
  const country = (request.headers.get('cf-ipcountry') || 'DEFAULT').toUpperCase();
  const mapping = GEO_MAPPINGS[country as keyof typeof GEO_MAPPINGS] || GEO_MAPPINGS['DEFAULT'];
  return mapping[niche];
}
