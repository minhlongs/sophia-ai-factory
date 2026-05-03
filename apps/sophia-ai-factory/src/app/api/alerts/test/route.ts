/**
 * Alert Test API
 *
 * POST /api/alerts/test - Send test alert to verify webhook configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { sendWebhookAlert, createQuotaThresholdPayload } from '@/lib/alerts/webhook-notification-service';

interface AlertTestPayload {
  webhookUrl?: string;
  webhookSecret?: string;
}

/**
 * POST /api/alerts/test
 * Send test webhook to verify configuration
 */
export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = (await request.json().catch(() => ({}))) as AlertTestPayload;
    const { webhookUrl, webhookSecret } = body;

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'webhookUrl is required' },
        { status: 400 }
      );
    }

    // Create test payload
    const payload = createQuotaThresholdPayload({
      userId: user.id,
      licenseNonce: 'test-nonce',
      threshold: 80,
      percentage: 82.5,
      limit: 1000,
      currentUsage: 825,
      tier: 'PREMIUM',
      exceededType: 'daily_credits',
      metadata: { test: true },
    });

    // Send test webhook
    const result = await sendWebhookAlert(webhookUrl, payload, webhookSecret);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          attempts: result.attempts,
        },
        { status: 500 }
      );
    }

    logger.info('[Alert Test API] Test webhook sent successfully', {
      userId: user.id,
      webhookUrl,
      deliveryTimeMs: result.deliveryTimeMs,
    });

    return NextResponse.json({
      success: true,
      message: 'Test alert sent successfully',
      deliveryTimeMs: result.deliveryTimeMs,
      attempts: result.attempts,
    });
  } catch (error) {
    logger.error('[Alert Test API] POST error', toError(error));
    return NextResponse.json(
      { error: 'Failed to send test alert' },
      { status: 500 }
    );
  }
}
