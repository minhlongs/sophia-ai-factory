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
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';

export async function GET(req: NextRequest) {
  const adminAuth = req.headers.get('x-admin-key');

  // Admin authentication
  if (!adminAuth || adminAuth !== process.env.ADMIN_API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized - Admin API key required' },
      { status: 401 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const period = searchParams.get('period') || 'day';
    const tier = searchParams.get('tier');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Calculate date range
    const now = Math.floor(Date.now() / 1000);
    let startDate: number;
    let endDate = now;

    if (period === 'custom') {
      startDate = parseInt(searchParams.get('start') || '0');
      endDate = parseInt(searchParams.get('end') || String(now));
    } else {
      switch (period) {
        case 'day':
          startDate = now - 86400;
          break;
        case 'week':
          startDate = now - (7 * 86400);
          break;
        case 'month':
          startDate = now - (30 * 86400);
          break;
        default:
          startDate = now - 86400;
      }
    }

    const db = createServerClient();

    // Build query
    let query = db
      .from('overage_events')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Add tier filter if provided
    if (tier) {
      query = query.eq('tier_at_exceeded', tier.toUpperCase());
    }

    const { data: events, error: eventsError } = await query;

    if (eventsError) {
      logger.error('[Admin Quota API] Failed to fetch overage events', eventsError);
      return NextResponse.json(
        { error: 'Failed to fetch overage events' },
        { status: 500 }
      );
    }

    // Calculate summary statistics
    const summary = {
      totalEvents: events?.length || 0,
      totalCreditsExceeded: events?.reduce((sum, e) => sum + (e.exceeded_by || 0), 0) || 0,
      billableEvents: events?.filter(e => e.billable).length || 0,
      billableCredits: events?.filter(e => e.billable).reduce((sum, e) => sum + (e.exceeded_by || 0), 0) || 0,
      byType: {} as Record<string, number>,
      byTier: {} as Record<string, number>,
      topUsers: [] as Array<{ userId: string; count: number; credits: number }>,
    };

    // Group by type
    events?.forEach(event => {
      const type = event.exceeded_type || 'unknown';
      summary.byType[type] = (summary.byType[type] || 0) + 1;
    });

    // Group by tier
    events?.forEach(event => {
      const tier = event.tier_at_exceeded || 'UNKNOWN';
      summary.byTier[tier] = (summary.byTier[tier] || 0) + 1;
    });

    // Top users by overage count
    const userOverages = new Map<string, { count: number; credits: number }>();
    events?.forEach(event => {
      const userId = event.user_id || 'unknown';
      const existing = userOverages.get(userId) || { count: 0, credits: 0 };
      userOverages.set(userId, {
        count: existing.count + 1,
        credits: existing.credits + (event.exceeded_by || 0),
      });
    });

    summary.topUsers = Array.from(userOverages.entries())
      .map(([userId, data]) => ({ userId, count: data.count, credits: data.credits }))
      .sort((a, b) => b.credits - a.credits)
      .slice(0, 10);

    return NextResponse.json({
      period: {
        type: period,
        startDate,
        endDate,
      },
      summary,
      events: events?.slice(0, 20).map(e => ({
        id: e.id,
        userId: e.user_id,
        licenseNonce: e.license_nonce?.slice(0, 8) + '...',
        exceededType: e.exceeded_type,
        exceededLimit: e.exceeded_limit,
        exceededCurrent: e.exceeded_current,
        exceededBy: e.exceeded_by,
        tier: e.tier_at_exceeded,
        billable: e.billable,
        createdAt: e.created_at,
      })),
    });

  } catch (error) {
    logger.error('[Admin Quota API] Unexpected error', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
