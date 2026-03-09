/**
 * Realtime Alerts WebSocket Endpoint
 *
 * Establishes Supabase Realtime subscriptions for:
 * - usage_events: Monitor usage threshold breaches
 * - violations: Track license violations
 *
 * This endpoint is called once on server startup to initialize
 * real-time alert monitoring for the RaaS Gateway.
 *
 * @module api/realtime/alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger-utility';
import {
  subscribeToUsageEvents,
  subscribeToViolations,
} from '@/lib/alerts/supabase-realtime-alert-service';

// Global subscription state
let realtimeUnsubscribe: (() => Promise<void>) | null = null;
let violationsUnsubscribe: (() => Promise<void>) | null = null;
let isInitialized = false;

/**
 * GET /api/realtime/alerts
 * Initialize realtime alert subscriptions
 * Returns subscription status
 */
export async function GET(request: NextRequest) {
  try {
    // Check if already initialized
    if (isInitialized) {
      return NextResponse.json({
        status: 'active',
        subscriptions: ['usage_events', 'violations'],
      });
    }

    // Initialize usage events subscription
    const usageUnsubscribe = await subscribeToUsageEvents();
    realtimeUnsubscribe = usageUnsubscribe;

    // Initialize violations subscription
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
    logger.error('[Realtime Alerts API] Initialization error', error as Error);
    return NextResponse.json(
      {
        error: 'Failed to initialize realtime subscriptions',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/realtime/alerts
 * Manually trigger subscription initialization
 */
export async function POST() {
  return GET(new NextRequest('http://localhost/api/realtime/alerts'));
}

/**
 * DELETE /api/realtime/alerts
 * Cleanup subscriptions (for graceful shutdown)
 */
export async function DELETE() {
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
    logger.error('[Realtime Alerts API] Cleanup error', error as Error);
    return NextResponse.json(
      { error: 'Failed to cleanup subscriptions' },
      { status: 500 }
    );
  }
}
