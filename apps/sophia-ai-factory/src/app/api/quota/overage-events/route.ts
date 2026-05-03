/**
 * Overage Billing API
 *
 * GET /api/quota/overage-events - Fetch user's overage events
 *
 * Authentication: Requires valid RaaS license key or session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getUserOverageEvents, getOverageSummary } from '@/forest/quota/overage-logger';

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

