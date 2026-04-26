/**
 * Usage Metering - Mock Endpoint
 *
 * Generate mock usage data for testing and development
 * DELETE: Clear mock data
 */

import { NextRequest, NextResponse } from 'next/server';
import { trackUsage, hashLicenseKey } from '@/lib/usage-metering';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';

const SERVICES = ['heygen', 'elevenlabs', 'openrouter'] as const;
const ACTIONS = {
  heygen: ['createVideo'],
  elevenlabs: ['textToSpeech'],
  openrouter: ['chatCompletion'],
};

/**
 * GET: Generate mock usage data
 *
 * Query params:
 * - count: Number of events to generate (default: 10)
 * - license_nonce: License nonce to associate with events (required)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const count = parseInt(searchParams.get('count') || '10');
    const licenseNonce = searchParams.get('license_nonce');

    if (!licenseNonce) {
      return NextResponse.json(
        { error: 'license_nonce query parameter is required' },
        { status: 400 }
      );
    }

    if (count < 1 || count > 1000) {
      return NextResponse.json(
        { error: 'count must be between 1 and 1000' },
        { status: 400 }
      );
    }

    logger.info('[Mock Usage] Generating mock data', {
      count,
      licenseNonce,
    });

    const mockEvents = [];
    const now = Math.floor(Date.now() / 1000);

    for (let i = 0; i < count; i++) {
      const service = SERVICES[Math.floor(Math.random() * SERVICES.length)];
      const action = ACTIONS[service][0];
      // Random timestamp within last 24 hours
      const timestamp = now - Math.floor(Math.random() * 86400);

      mockEvents.push({
        userId: `mock-user-${Math.floor(Math.random() * 100)}`,
        licenseNonce,
        service,
        action,
        creditsUsed: Math.floor(Math.random() * 10) + 1,
        tokensInput: service === 'openrouter' ? Math.floor(Math.random() * 500) : 0,
        tokensOutput: service === 'openrouter' ? Math.floor(Math.random() * 1000) : 0,
        statusCode: 200,
        responseTimeMs: Math.floor(Math.random() * 2000) + 500,
        createdAt: timestamp,
      });
    }

    // Insert mock events
    for (const event of mockEvents) {
      await trackUsage({
        userId: event.userId,
        licenseKeyHash: hashLicenseKey(event.licenseNonce),
        licenseNonce: event.licenseNonce,
        service: event.service,
        endpoint: `/api/${event.service}/${event.action}`,
        action: event.action,
        creditsUsed: event.creditsUsed,
        tokensInput: event.tokensInput,
        tokensOutput: event.tokensOutput,
        statusCode: event.statusCode,
        responseTimeMs: event.responseTimeMs,
        createdAt: event.createdAt,
        tierAtRequest: 'PREMIUM',
        idempotencyKey: `mock_${event.licenseNonce}_${event.createdAt}_${Math.random().toString(36).substr(2, 9)}`,
      });
    }

    logger.info('[Mock Usage] Mock data generated successfully', {
      count: mockEvents.length,
    });

    return NextResponse.json({
      success: true,
      generated: mockEvents.length,
      licenseNonce,
      message: `Generated ${mockEvents.length} mock usage events`,
    });

  } catch (error) {
    logger.error('[Mock Usage] Error generating mock data', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to generate mock data' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Clear mock data (for testing reset)
 */
export async function DELETE() {
  try {
    const db = createServerClient();

    // First get count of events to delete
    const { count, error: countError } = await db
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .like('idempotency_key', 'mock_%');

    if (countError) {
      logger.error('[Mock Usage] Failed to count mock data', toError(countError));
      return NextResponse.json(
        { error: 'Failed to clear mock data', details: countError.message },
        { status: 500 }
      );
    }

    // Delete all events with idempotency_key starting with 'mock_'
    const { error: deleteError } = await db
      .from('usage_events')
      .delete()
      .like('idempotency_key', 'mock_%');

    if (deleteError) {
      logger.error('[Mock Usage] Failed to clear mock data', toError(deleteError));
      return NextResponse.json(
        { error: 'Failed to clear mock data', details: deleteError.message },
        { status: 500 }
      );
    }

    logger.info('[Mock Usage] Mock data cleared', { count });

    return NextResponse.json({
      success: true,
      deleted: count || 0,
      message: `Deleted ${count} mock usage events`,
    });

  } catch (error) {
    logger.error('[Mock Usage] Error clearing mock data', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to clear mock data' },
      { status: 500 }
    );
  }
}
