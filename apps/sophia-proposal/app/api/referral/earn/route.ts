/**
 * POST /api/referral/earn
 *
 * Called by Polar webhook handler when a referred org subscribes.
 * - Calculates commission (20% of subscription amount × 3 months cap)
 * - Records referral_event type='conversion'
 * - Credits MCU to referrer's balance via credit_mcu_balance RPC
 * - Creates affiliate_payout record
 *
 * This route is internal — called server-to-server, not from browser.
 * Validated via shared internal secret header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// MCU-per-dollar rate: $1 = 20 MCU (matches existing mcu-pricing logic)
const MCU_PER_DOLLAR = 20;
// Commission applies to first 3 months only
const COMMISSION_MONTHS_CAP = 3;

const EarnSchema = z.object({
  referral_code: z.string().min(1),
  referred_org_id: z.string().uuid(),
  subscription_amount_cents: z.number().int().positive(),
  polar_subscription_id: z.string(),
});

function validateInternalSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-internal-secret');
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) {
    // Allow in dev without secret; block in production
    return process.env.NODE_ENV !== 'production';
  }
  return secret === expected;
}

export async function POST(request: NextRequest) {
  try {
    if (!validateInternalSecret(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = EarnSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { referral_code, referred_org_id, subscription_amount_cents, polar_subscription_id } =
      parsed.data;

    const db = createServerClient();

    // Resolve referral code → referrer org
    const { data: refCode, error: codeErr } = await db
      .from('referral_codes')
      .select('org_id, commission_rate, is_active')
      .eq('code', referral_code)
      .single();

    if (codeErr || !refCode || !refCode.is_active) {
      return NextResponse.json({ error: 'Invalid or inactive referral code' }, { status: 404 });
    }

    const referrerOrgId = refCode.org_id;
    const commissionRate = Number(refCode.commission_rate);

    // Prevent self-referral
    if (referrerOrgId === referred_org_id) {
      return NextResponse.json({ error: 'Self-referral not allowed' }, { status: 422 });
    }

    // Idempotency: skip if conversion already recorded for this subscription
    const { data: existing } = await db
      .from('referral_events')
      .select('id')
      .eq('referrer_org_id', referrerOrgId)
      .eq('referral_code', referral_code)
      .eq('event_type', 'conversion')
      .eq('metadata->>polar_subscription_id', polar_subscription_id)
      .single();

    if (existing) {
      return NextResponse.json({ skipped: true, reason: 'already_processed' });
    }

    // Commission = rate × monthly_amount × 3 months cap
    const monthlyDollars = subscription_amount_cents / 100;
    const commissionDollars = commissionRate * monthlyDollars * COMMISSION_MONTHS_CAP;
    const mcuToCredit = Math.floor(commissionDollars * MCU_PER_DOLLAR);

    // Record conversion event
    await db.from('referral_events').insert({
      referrer_org_id: referrerOrgId,
      referred_org_id,
      referral_code,
      event_type: 'conversion',
      metadata: {
        polar_subscription_id,
        subscription_amount_cents,
        commission_dollars: commissionDollars,
        mcu_credited: mcuToCredit,
      },
    });

    // Update aggregate counters on referral_codes
    await db.rpc('increment_referral_counter', {
      p_code: referral_code,
      p_field: 'conversions',
    });

    // Increment total_earned: fetch current value then write updated sum
    const { data: currentCode } = await db
      .from('referral_codes')
      .select('total_earned')
      .eq('code', referral_code)
      .single();

    await db
      .from('referral_codes')
      .update({ total_earned: Number(currentCode?.total_earned ?? 0) + commissionDollars })
      .eq('code', referral_code);

    // Credit MCU to referrer's balance
    if (mcuToCredit > 0) {
      const { error: creditErr } = await db.rpc('credit_mcu_balance', {
        p_org_id: referrerOrgId,
        p_amount: mcuToCredit,
        p_subscription_id: `referral:${referral_code}:${polar_subscription_id}`,
      });

      if (creditErr) {
        console.error('Failed to credit MCU for referral:', creditErr);
      }
    }

    // Create payout record (pending, to be processed later)
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    await db.from('affiliate_payouts').insert({
      org_id: referrerOrgId,
      amount: commissionDollars,
      status: 'pending',
      payout_method: 'credit',
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
    });

    return NextResponse.json({
      earned: true,
      commission_dollars: commissionDollars,
      mcu_credited: mcuToCredit,
    });
  } catch (e) {
    console.error('POST /api/referral/earn error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
