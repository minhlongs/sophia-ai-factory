/**
 * POST /api/promo/validate
 * Public endpoint — validate a promo code before checkout.
 * No auth required. Rate-limited to prevent brute-force.
 * @module app/api/promo/validate
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validatePromoCode } from '@/land/promo/promo-validator';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';

const validateSchema = z.object({
  code: z.string().min(1).max(30),
  tier: z.string().optional(),
  sku: z.string().optional(),
  userId: z.string().optional(),
});

export const POST = withRateLimit(
  async function POST(request: Request) {
    try {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
      }
      const parsed = validateSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const { code, tier, sku, userId } = parsed.data;
      const result = await validatePromoCode(code, { tier, sku, userId });

      return NextResponse.json(result);
    } catch {
      return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
    }
  },
  { addHeaders: true, config: { intervalMs: 60000, maxRequests: 30 } },
);
