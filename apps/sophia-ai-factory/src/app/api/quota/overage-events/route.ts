/**
 * Overage Billing API
 *
 * GET /api/quota/overage-events - Fetch user's overage events
 * GET /api/quota/status - Get current quota status
 *
 * Authentication: Requires valid RaaS license key or session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/better-auth-session';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';
import { getQuotaStatus } from '@/lib/quota/quota-checker';
import { getUserOverageEvents, getOverageSummary } from '@/lib/quota/overage-logger';

/**
 * GET /api/quota/overage-events
 * Fetch user's overage events for dashboard display
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const supabase = createServerClient();

    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');
    const startDate = searchParams.get('start') ? parseInt(searchParams.get('start')!) : undefined;
    const endDate = searchParams.get('end') ? parseInt(searchParams.get('end')!) : undefined;

    // Fetch overage events
    const events = await getUserOverageEvents(user.id, { limit, startDate, endDate });

    // Fetch quota summary for current period
    const now = Math.floor(Date.now() / 1000);
    const dayStart = Math.floor(now / 86400) * 86400;
    const summary = await getOverageSummary('all', dayStart, now);

    return NextResponse.json({
      events,
      summary: {
        totalOverageEvents: summary.totalOverageEvents,
        totalOverageCredits: summary.totalOverageCredits,
        byType: summary.byType,
        billableEvents: summary.billableEvents,
      },
    });
  } catch (error) {
    logger.error('[Overage API] Error fetching events', toError(error));
    return NextResponse.json(
      { error: 'Failed to fetch overage events' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/quota/status
 * Get current quota status for dashboard
 */
export async function GETStatus(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const supabase = createServerClient();

    // Get user's active license
    const { data: license } = await supabase
      .from('raas_licenses')
      .select('nonce, tier, created_by')
      .eq('created_by', user.id)
      .eq('is_revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single<{ nonce: string; tier: string; created_by: string | null }>();

    if (!license) {
      return NextResponse.json(
        { error: 'No active license found' },
        { status: 404 }
      );
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
