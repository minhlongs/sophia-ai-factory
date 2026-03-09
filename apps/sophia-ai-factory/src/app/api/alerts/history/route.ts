/**
 * Alert History API
 *
 * GET /api/alerts/history - Fetch user's alert history with pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger-utility';

/**
 * GET /api/alerts/history
 * Fetch alert history for current user with optional filters
 * Query params: limit, offset, type, licenseNonce, includeDismissed
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type');
    const licenseNonce = searchParams.get('licenseNonce');
    const includeDismissed = searchParams.get('includeDismissed') === 'true';

    // Build query
    let query = supabase
      .from('user_alerts')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false, nulls: 'last' })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (type) {
      query = query.eq('type', type);
    }
    if (licenseNonce) {
      query = query.eq('license_nonce', licenseNonce);
    }
    if (!includeDismissed) {
      query = query.eq('dismissed', false);
    }

    const { data: alerts, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      alerts: alerts || [],
      count: count || 0,
      pagination: {
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    logger.error('[Alert History API] GET error', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch alert history' },
      { status: 500 }
    );
  }
}
