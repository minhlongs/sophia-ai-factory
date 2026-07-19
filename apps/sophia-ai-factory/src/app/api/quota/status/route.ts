/**
 * Quota Status API
 *
 * GET /api/quota/status - Get current quota status for dashboard
 *
 * Authentication: Better Auth session (user must be logged in).
 * Restored after Phase 24 deletion of orphan GETStatus export in overage-events route.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Tier } from '@/seed/types';
import { createServerClient } from '@/seed/db/client';
import { getCurrentUserOrOpenclawBearer } from '@/seed/auth/openclaw-token';
import { getCampaignLimit } from '@/seed/config/tiers/campaign-limit';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getQuotaStatus } from '@/forest/quota/quota-checker';
import { QUOTA_LIMITS } from '@/forest/usage-metering/aggregator';

interface QuotaStatusLicenseRow {
  nonce: string;
  tier: string;
  created_by: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrOpenclawBearer(req.headers);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    const { data: rawLicense } = await supabase
      .from('raas_licenses')
      .select('nonce, tier, created_by')
      .eq('created_by', user.id)
      .eq('is_revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    const license = rawLicense as QuotaStatusLicenseRow | null;

    if (!license) {
      const limits = QUOTA_LIMITS.BASIC;

      return NextResponse.json({
        license: {
          nonce: null,
          tier: 'BASIC',
        },
        quota: {
          usage: { hourly: 0, daily: 0, monthly: 0, requests: 0 },
          limits,
          percentages: { hourly: 0, daily: 0, monthly: 0 },
          status: 'ok',
        },
        video: {
          used: 0,
          limit: getCampaignLimit('BASIC'),
        },
      });
    }

    const quotaStatus = await getQuotaStatus(
      user.id,
      license.nonce,
      (license.tier || 'BASIC').toUpperCase()
    );

    // Count campaigns created this month for the sidebar widget
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthStartIso = monthStart.toISOString();
    const tier = (license.tier || 'BASIC').toUpperCase() as Tier;

    const campaignResult = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthStartIso);

    const videoCount = (campaignResult as unknown as { count?: number }).count ?? 0;

    return NextResponse.json({
      license: {
        nonce: license.nonce.slice(0, 8) + '...',
        tier: license.tier,
      },
      quota: quotaStatus,
      video: {
        used: videoCount,
        limit: getCampaignLimit(tier),
      },
    });
  } catch (error) {
    logger.error('[Quota API] Error fetching quota status', toError(error));
    return NextResponse.json(
      { error: 'Failed to fetch quota status' },
      { status: 500 }
    );
  }
}
