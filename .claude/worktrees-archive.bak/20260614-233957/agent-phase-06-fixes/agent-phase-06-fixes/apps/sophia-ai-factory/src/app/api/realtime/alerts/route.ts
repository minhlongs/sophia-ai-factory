/**
 * Realtime Alerts WebSocket Endpoint (D1 migration: subscriptions not supported)
 *
 * Supabase Realtime subscriptions removed during D1 migration.
 * This endpoint returns a stub response indicating subscriptions are unavailable.
 *
 * @module api/realtime/alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

function verifyCronSecret(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    status: 'unavailable',
    reason: 'Realtime subscriptions require Supabase; D1 does not support WebSocket subscriptions',
    subscriptions: [],
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}

export async function DELETE(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return NextResponse.json({
      status: 'noop',
      reason: 'No active subscriptions on D1'
    });
  } catch (error) {
    logger.error('[Realtime Alerts API] Cleanup error', toError(error));
    return NextResponse.json(
      { error: 'Failed to cleanup subscriptions' },
      { status: 500 }
    );
  }
}
