/**
 * Referral touchpoint resolution for the Closed-Loop Attribution Engine.
 * @module land/affiliates/closed-loop-touchpoint-resolver
 */

import { getD1 } from '@/seed/db/client';

export interface TouchpointResolutionInput {
  attributionToken?: string;
  partnerCode?: string;
  subId?: string;
  userId?: string;
  ipHash?: string;
  userAgent?: string;
}

export interface TouchpointResolutionResult {
  attributed: boolean;
  partnerCode?: string;
  partnerId?: string;
  referralId?: string;
}

const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30-day cookie / touchpoint window

export async function resolveAttributionTouchpoint(
  input: TouchpointResolutionInput
): Promise<TouchpointResolutionResult> {
  const db = await getD1();
  if (!db) return { attributed: false };

  // 1. Try resolving via specific attribution token
  if (input.attributionToken) {
    const referral = await db
      .prepare(`SELECT r.id, r.partner_id, r.partner_code, r.created_at
                FROM affiliate_referrals r
                WHERE r.attribution_token = ?1 LIMIT 1`)
      .bind(input.attributionToken)
      .first<{ id: string; partner_id: string; partner_code: string; created_at: number }>();

    if (referral && Date.now() - referral.created_at <= ATTRIBUTION_WINDOW_MS) {
      return {
        attributed: true,
        partnerCode: referral.partner_code,
        partnerId: referral.partner_id,
        referralId: referral.id,
      };
    }
  }

  // 2. Direct partner code fallback
  if (input.partnerCode) {
    const partner = await db
      .prepare('SELECT id, partner_code FROM affiliate_partners WHERE partner_code = ?1 AND status = "active" LIMIT 1')
      .bind(input.partnerCode)
      .first<{ id: string; partner_code: string }>();

    if (partner) {
      return {
        attributed: true,
        partnerCode: partner.partner_code,
        partnerId: partner.id,
      };
    }
  }

  return { attributed: false };
}
