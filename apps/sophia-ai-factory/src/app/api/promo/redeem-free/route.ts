/**
 * POST /api/promo/redeem-free
 * Redeem a free_trial or free_full promo code.
 * Creates user if not found, fires auto-handover, returns magic link.
 * Auth optional — creates user from email if not logged in.
 * @module app/api/promo/redeem-free
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { applyPromoCode } from '@/lib/promo/promo-applier';
import { validatePromoCode } from '@/lib/promo/promo-validator';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { withRateLimit } from '@/middleware/rate-limit-wrapper';
import { getD1Raw } from '@/seed/db/client';
import { createCustomerUser } from '@/lib/handover/handover-account-setup';
import { logger } from '@/seed/utils/logger-utility';

const redeemFreeSchema = z.object({
  code: z.string().min(1).max(30),
  email: z.string().email(),
  fullName: z.string().min(1).max(100).optional(),
  agencyType: z.string().optional(),
  tier: z.string().optional(),
  locale: z.string().optional(),
});

async function findOrResolveUser(
  request: Request,
  email: string,
): Promise<string | null> {
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (user?.id) return user.id;
  } catch { /* not logged in */ }

  // Look up by email in D1
  try {
    const db = await getD1Raw();
    const row = await db
      .prepare(`SELECT id FROM user WHERE email = ?1 LIMIT 1`)
      .bind(email)
      .first<{ id: string }>();
    return row?.id ?? null;
  } catch {
    return null;
  }
}

export const POST = withRateLimit(
  async function POST(request: Request) {
    try {
      const body = await request.json();
      const parsed = redeemFreeSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const { code, email, fullName, agencyType, tier, locale } = parsed.data;

      // Validate code upfront (public check — userId unknown yet)
      const preCheck = await validatePromoCode(code, { tier });
      if (!preCheck.valid) {
        return NextResponse.json({ error: 'invalid_code', reason: preCheck.reason }, { status: 400 });
      }

      // Only allow free_trial and free_full via this endpoint
      if (preCheck.discountType !== 'free_trial' && preCheck.discountType !== 'free_full') {
        return NextResponse.json(
          { error: 'Code requires payment. Use checkout flow.' },
          { status: 400 },
        );
      }

      let userId = await findOrResolveUser(request, email);

      // Auto-create user if not found — promo redeem flow accepts new customers
      // (matches endpoint contract: "Creates user if not found, fires auto-handover")
      if (!userId) {
        try {
          const db = await getD1Raw();
          const resolvedName = fullName?.trim() || email.split('@')[0];
          userId = await createCustomerUser(db, email, resolvedName);
          logger.info('[RedeemFree] Auto-created customer user', { userId, email });
        } catch (err) {
          logger.error('[RedeemFree] Auto-create user failed', err instanceof Error ? err : undefined);
          return NextResponse.json(
            { error: 'user_create_failed', hint: 'Email may already exist. Try logging in first.' },
            { status: 500 },
          );
        }
      }

      // Full apply with userId (includes per-user limit check)
      const result = await applyPromoCode({
        code,
        userId,
        email,
        fullName,
        agencyType,
        tier: tier ?? preCheck.appliesToTier ?? 'BASIC',
        locale: locale ?? 'vi',
      });

      logger.info('[RedeemFree] Promo redeemed', { code, userId, redemptionId: result.redemptionId });

      return NextResponse.json({
        success: true,
        redemptionId: result.redemptionId,
        magicLink: result.magicLink,
        handoverId: result.handoverId,
        trialDaysGranted: result.trialDaysGranted,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Redemption failed';
      logger.error('[RedeemFree] Error', err instanceof Error ? err : undefined);
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  },
  { addHeaders: true, config: { intervalMs: 60000, maxRequests: 10 } },
);
