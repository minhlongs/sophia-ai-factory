/**
 * Alert Preferences API
 *
 * GET /api/alerts/preferences - Fetch user's notification preferences
 * PUT /api/alerts/preferences - Update notification preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/better-auth-session';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';

interface AlertPreferencesPayload {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  webhookEnabled?: boolean;
  defaultWebhookUrl?: string;
  defaultWebhookSecret?: string;
  language?: string;
}

/**
 * GET /api/alerts/preferences
 * Fetch notification preferences for current user
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
    const supabase = createServerClient();

    // Fetch preferences
    const { data: prefs, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Return defaults if no preferences exist
    const preferences = prefs || {
      user_id: user.id,
      email_enabled: true,
      sms_enabled: false,
      webhook_enabled: false,
      default_webhook_url: null,
      default_webhook_secret: null,
      language: 'en',
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json({ preferences });
  } catch (error) {
    logger.error('[Alert Preferences API] GET error', toError(error));
    return NextResponse.json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/alerts/preferences
 * Update notification preferences for current user
 */
export async function PUT(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const supabase = createServerClient();

    // Parse request body
    const body = (await request.json().catch(() => ({}))) as AlertPreferencesPayload;
    const {
      emailEnabled,
      smsEnabled,
      webhookEnabled,
      defaultWebhookUrl,
      defaultWebhookSecret,
      language,
    } = body;

    // Upsert preferences
    const { data: prefs, error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        email_enabled: emailEnabled,
        sms_enabled: smsEnabled,
        webhook_enabled: webhookEnabled,
        default_webhook_url: defaultWebhookUrl,
        default_webhook_secret: defaultWebhookSecret,
        language: language || 'en',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('[Alert Preferences API] Preferences updated', {
      userId: user.id,
      emailEnabled,
      webhookEnabled,
    });

    return NextResponse.json({ preferences: prefs });
  } catch (error) {
    logger.error('[Alert Preferences API] PUT error', toError(error));
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}
