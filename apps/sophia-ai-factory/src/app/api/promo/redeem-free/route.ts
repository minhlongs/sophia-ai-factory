/**
 * POST /api/promo/redeem-free
 * Redeem a free_trial or free_full promo code.
 * Creates user if not found, fires auto-handover, returns magic link.
 * Auth optional — creates user from email if not logged in.
 * @module app/api/promo/redeem-free
 */

import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { processRedeemFreeRequest } from './service/index';

export const POST = withRateLimit(
  async function POST(request: Request) {
    return processRedeemFreeRequest(request);
  },
  { addHeaders: true, config: { intervalMs: 60000, maxRequests: 10 } },
);
