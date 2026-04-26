/**
 * Usage Metering - Debug Endpoint
 *
 * Query recent usage events for debugging
 * GET: Fetch recent events with optional filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';

/**
 * GET: Query recent usage events
 *
 * Query params:
 * - license_nonce: Filter by specific license (optional)
 * - limit: Max events to return (default: 50, max: 500)
 * - offset: Pagination offset (default: 0)
 * - service: Filter by service (heygen, elevenlabs, openrouter)
 * - start: Start timestamp (Unix seconds)
 * - end: End timestamp (Unix seconds)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const licenseNonce = searchParams.get('license_nonce');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const service = searchParams.get('service');
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    // Validate limit
    if (limit < 1 || limit > 500) {
      return NextResponse.json(
        { error: 'limit must be between 1 and 500' },
        { status: 400 }
      );
    }

    logger.info('[Debug Usage] Querying usage events', {
      licenseNonce,
      limit,
      offset,
      service,
    });

    const db = createServerClient();

    let query = db
      .from('usage_events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (licenseNonce) {
      query = query.eq('license_nonce', licenseNonce);
    }

    if (service) {
      query = query.eq('service_name', service);
    }

    if (start) {
      const startTs = parseInt(start);
      if (!isNaN(startTs)) {
        query = query.gte('created_at', startTs);
      }
    }

    if (end) {
      const endTs = parseInt(end);
      if (!isNaN(endTs)) {
        query = query.lte('created_at', endTs);
      }
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('[Debug Usage] Failed to query events', toError(error));
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      events: data || [],
      count: data?.length || 0,
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
      filters: {
        licenseNonce,
        service,
        start: start ? parseInt(start) : undefined,
        end: end ? parseInt(end) : undefined,
      },
    });

  } catch (error) {
    logger.error('[Debug Usage] Critical error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to query usage events' },
      { status: 500 }
    );
  }
}
