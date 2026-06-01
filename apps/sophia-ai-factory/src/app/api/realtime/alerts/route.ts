/**
 * Realtime Alerts WebSocket Endpoint
 *
 * Establishes Supabase Realtime subscriptions for:
 * - usage_events: Monitor usage threshold breaches
 * - violations: Track license violations
 *
 * This endpoint is called once on server startup to initialize
 * real-time alert monitoring for the RaaS Gateway.
 * Requires Bearer CRON_SECRET — cron/internal calls only.
 *
 * @module api/realtime/alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  subscribeToUsageEvents,
  subscribeToViolations,
} from '@/forest/alerts/supabase-realtime-alert-service';

// Global subscription state
let realtimeUnsubscribe: (() => Promise<void>) | null = null;
let violationsUnsubscribe: (() => Promise<void>) | null = null;
let isInitialized = false;

function verifyCronSecret(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

/**
 * GET /api/realtime/alerts
 * Initialize realtime alert subscriptions (cron-only)
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (isInitialized) {
      return NextResponse.json({
        status: 'active',
        subscriptions: ['usage_events', 'violations'],
      });
    }

    const usageUnsubscribe = await subscribeToUsageEvents();
    realtimeUnsubscribe = usageUnsubscribe;

    const violationsUnsub = await subscribeToViolations();
    violationsUnsubscribe = violationsUnsub;

    isInitialized = true;

    logger.info('[Realtime Alerts API] Subscriptions initialized', {
      usageEvents: !!realtimeUnsubscribe,
      violations: !!violationsUnsubscribe,
    });

    return NextResponse.json({
      status: 'initialized',
      subscriptions: ['usage_events', 'violations'],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Realtime Alerts API] Initialization error', toError(error));
    return NextResponse.json(
      {
        error: 'Failed to initialize realtime subscriptions',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/realtime/alerts
 * Manually trigger subscription initialization (cron-only)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}

/**
 * DELETE /api/realtime/alerts
 * Cleanup subscriptions (cron-only — for graceful shutdown)
 */
export async function DELETE(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (realtimeUnsubscribe) {
      await realtimeUnsubscribe();
      realtimeUnsubscribe = null;
    }
    if (violationsUnsubscribe) {
      await violationsUnsubscribe();
      violationsUnsubscribe = null;
    }
    isInitialized = false;

    logger.info('[Realtime Alerts API] Subscriptions cleaned up');

    return NextResponse.json({ status: 'cleaned_up' });
  } catch (error) {
    logger.error('[Realtime Alerts API] Cleanup error', toError(error));
    return NextResponse.json(
      { error: 'Failed to cleanup subscriptions' },
      { status: 500 },
    );
  }
}
