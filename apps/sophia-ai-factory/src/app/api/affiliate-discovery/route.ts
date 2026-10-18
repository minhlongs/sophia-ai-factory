/**
 * GET /api/affiliate-discovery
 *
 * Returns paginated PUBLIC affiliate offers from affiliate_offers_catalog.
 * Public endpoint — rate limited 60 req/min. Only active offers returned.
 *
 * POST /api/affiliate-discovery
 *
 * Triggers an agentic discovery wave across ClickBank, Awin, and ShareASale
 * with composite quality scoring and scam risk gating.
 * Rate limited 30 req/min.
 */

import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import {
  handleAffiliateDiscoveryGet,
  handleAffiliateDiscoveryPost,
  type AffiliateOffer,
} from './affiliate-discovery-helpers';

export type { AffiliateOffer };

export const GET = withRateLimit(handleAffiliateDiscoveryGet, {
  config: { intervalMs: 60_000, maxRequests: 60 },
});

export const POST = withRateLimit(handleAffiliateDiscoveryPost, {
  config: { intervalMs: 60_000, maxRequests: 30 },
});
