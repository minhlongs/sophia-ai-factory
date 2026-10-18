/**
 * GET /api/admin/quota/overage-summary
 *
 * Get global overage summary for admin dashboard
 *
 * Query params:
 * - period: 'day' | 'week' | 'month' | 'custom'
 * - startDate: number (timestamp, required if period='custom')
 * - endDate: number (timestamp, required if period='custom')
 * - tier: string (filter by tier)
 * - limit: number (default 100)
 *
 * Admin authentication required
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { requireAdmin } from '@/seed/auth/require-admin';
import type { OverageEventRow } from '@/tree/database/supabase-types';
import {
  buildOverageSummaryResponse,
  parseOverageQueryParams,
} from './overage-summary-helpers';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  try {
    const range = parseOverageQueryParams(req.nextUrl.searchParams);
    const db = createServerClient();

    let query = db
      .from('overage_events')
      .select('*')
      .gte('created_at', range.startDate)
      .lte('created_at', range.endDate)
      .order('created_at', { ascending: false })
      .limit(range.limit);

    if (range.tier) {
      query = query.eq('tier_at_exceeded', range.tier.toUpperCase());
    }

    const { data: rawEvents, error: eventsError } = await query;
    const events = rawEvents as unknown as OverageEventRow[] | null;

    if (eventsError) {
      logger.error('[Admin Quota API] Failed to fetch overage events', toError(eventsError));
      return NextResponse.json(
        { error: 'Failed to fetch overage events' },
        { status: 500 },
      );
    }

    return NextResponse.json(buildOverageSummaryResponse(range, events));
  } catch (error) {
    logger.error('[Admin Quota API] Unexpected error', toError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
