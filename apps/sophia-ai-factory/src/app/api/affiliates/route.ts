/**
 * GET /api/affiliates
 *
 * Returns partner summary for the authenticated user or partner details by code.
 *
 * @module app/api/affiliates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  getPartnerLedgerStats,
  getPartnerSummary,
} from '@/tree/affiliates/affiliate-ledger-service';
import { logger } from '@/seed/utils/logger-utility';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    // 1. Explicit lookup by partner code (e.g. for referral verification)
    if (code) {
      const partner = await getPartnerSummary(code);
      if (!partner || partner.status !== 'active') {
        return NextResponse.json(
          { success: false, error: 'PARTNER_NOT_FOUND' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        partner: {
          id: partner.id,
          partnerCode: partner.partnerCode,
          tier: partner.tier,
          commissionRatePct: partner.commissionRatePct,
          status: partner.status,
        },
      });
    }

    // 2. Authenticated user profile lookup
    const user = await getCurrentUser().catch(() => null);

    if (!user) {
      return NextResponse.json({
        success: true,
        authenticated: false,
        isPartner: false,
        programInfo: {
          tiers: ['SILVER', 'GOLD', 'PLATINUM'],
          baseCommissionRatePct: 20.0,
          payoutRails: ['USDT', 'VIETQR'],
          holdPeriodDays: 14,
        },
      });
    }

    const partner = await getPartnerSummary(user.id);
    if (!partner) {
      return NextResponse.json({
        success: true,
        authenticated: true,
        isPartner: false,
        message: 'User is not enrolled as an affiliate partner',
        programInfo: {
          tiers: ['SILVER', 'GOLD', 'PLATINUM'],
          baseCommissionRatePct: 20.0,
          payoutRails: ['USDT', 'VIETQR'],
          holdPeriodDays: 14,
        },
      });
    }

    const activity = await getPartnerLedgerStats(partner.id);

    return NextResponse.json({
      success: true,
      authenticated: true,
      isPartner: true,
      partner,
      activity,
    });
  } catch (err) {
    logger.error('[AffiliatesRoute] Error fetching partner info', { error: String(err) });
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
