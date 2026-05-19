/**
 * Quota Status API
 *
 * GET /api/quota/status - Get current quota status for dashboard
 *
 * Authentication: Better Auth session (user must be logged in).
 * Restored after Phase 24 deletion of orphan GETStatus export in overage-events route.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
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
    const user = await getCurrentUser();

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
      });
    }

    const quotaStatus = await getQuotaStatus(
      user.id,
      license.nonce,
      (license.tier || 'BASIC').toUpperCase()
    );

    return NextResponse.json({
      license: {
        nonce: license.nonce.slice(0, 8) + '...',
        tier: license.tier,
      },
      quota: quotaStatus,
    });
  } catch (error) {
    logger.error('[Quota API] Error fetching quota status', toError(error));
    return NextResponse.json(
      { error: 'Failed to fetch quota status' },
      { status: 500 }
    );
  }
}
