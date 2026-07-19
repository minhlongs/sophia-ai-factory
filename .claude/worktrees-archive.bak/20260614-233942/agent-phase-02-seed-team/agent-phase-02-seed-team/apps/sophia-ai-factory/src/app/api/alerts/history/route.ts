/**
 * Alert History API
 *
 * GET /api/alerts/history - Fetch user's alert history with pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

/**
 * GET /api/alerts/history
 * Fetch alert history for current user with optional filters
 * Query params: limit, offset, type, licenseNonce, includeDismissed
 */
export async function GET(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const db = createServerClient();

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type');
    const licenseNonce = searchParams.get('licenseNonce');
    const includeDismissed = searchParams.get('includeDismissed') === 'true';

    // Build query
    let query = db
      .from('user_alerts')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
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
    logger.error('[Alert History API] GET error', toError(error));
    return NextResponse.json(
      { error: 'Failed to fetch alert history' },
      { status: 500 }
    );
  }
}
