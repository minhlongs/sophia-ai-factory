/**
 * /api/credits — Unified Credit Balance (MCU + One-Time Packs)
 *
 * Returns the user's combined credit balance across two systems:
 *  1. MCU credits (video generation budget) from user_mcu_balance
 *  2. One-time credit pack credits (expirable) from user_purchases
 *
 * Auth: Session (getCurrentUser). Tier gate: enable_credit_topup feature.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getBalance } from '@/tree/mcu/credits-repo';
import { tierHasFeature } from '@/seed/config/tiers';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  try {
    tier = (await resolveUserTier(user.id)) as 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  } catch {
    tier = 'BASIC';
  }
  if (!tierHasFeature(tier, 'enable_credit_topup')) {
    return NextResponse.json(
      {
        error: 'Feature not available',
        message: 'Credit packs are available for PREMIUM and above',
        requiredTier: 'PREMIUM',
      },
      { status: 403 },
    );
  }

  const db = createServerClient();
  const nowSec = Math.floor(Date.now() / 1000);

  try {
    // ── MCU balance ─────────────────────────────────────────────────────────
    const mcuBalance = await getBalance(user.id);

    // ── One-time credit pack balance ────────────────────────────────────────
    // Sum all paid, non-expired credit pack purchases
    const packResult = await db
      .prepare(
        `SELECT COALESCE(SUM(credits_remaining), 0) as pack_credits_remaining,
                COALESCE(SUM(credits_total), 0) as pack_credits_total,
                COUNT(*) as active_packs
         FROM user_purchases
         WHERE user_id = ?
           AND kind = 'one_time'
           AND status = 'paid'
           AND (expires_at IS NULL OR expires_at > ?)`,
      )
      .bind(user.id, nowSec)
      .first<{
        pack_credits_remaining: number;
        pack_credits_total: number;
        active_packs: number;
      }>();

    const packBalance = packResult ?? {
      pack_credits_remaining: 0,
      pack_credits_total: 0,
      active_packs: 0,
    };

    // ── Response ────────────────────────────────────────────────────────────
    const response = {
      tier,
      mcu: mcuBalance,
      packs: {
        credits_remaining: packBalance.pack_credits_remaining,
        credits_total: packBalance.pack_credits_total,
        active_packs: packBalance.active_packs,
      },
      total_credits_remaining: mcuBalance.credits_remaining + packBalance.pack_credits_remaining,
      can_use_credit_topup: true,
    };

    return NextResponse.json(response);
  } catch (err) {
    logger.error('[credits] Failed to fetch balance', {
      user_id: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to fetch credit balance' },
      { status: 500 },
    );
  }
}
