/**
 * Alert Rules API
 *
 * GET /api/alerts/rules - Fetch user's alert rules
 * POST /api/alerts/rules - Create/update alert rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger-utility';

/**
 * GET /api/alerts/rules
 * Fetch all alert rules for current user
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

    // Fetch alert rules
    const { data: rules, error } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('threshold_percent', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ rules: rules || [] });
  } catch (error) {
    logger.error('[Alert Rules API] GET error', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch alert rules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alerts/rules
 * Create or update an alert rule
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const {
      licenseNonce,
      thresholdPercent,
      enabled = true,
      channels = ['email'],
      webhookUrl,
      webhookSecret,
    } = body;

    // Validation
    if (!thresholdPercent || thresholdPercent < 0 || thresholdPercent > 100) {
      return NextResponse.json(
        { error: 'thresholdPercent must be between 0 and 100' },
        { status: 400 }
      );
    }

    // Upsert alert rule
    const { data: rule, error } = await supabase
      .from('alert_rules')
      .upsert({
        user_id: user.id,
        license_nonce: licenseNonce,
        threshold_percent: thresholdPercent,
        enabled,
        channels,
        webhook_url: webhookUrl,
        webhook_secret: webhookSecret,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('[Alert Rules API] Rule created/updated', {
      userId: user.id,
      ruleId: rule.id,
      threshold: thresholdPercent,
    });

    return NextResponse.json({ rule });
  } catch (error) {
    logger.error('[Alert Rules API] POST error', error as Error);
    return NextResponse.json(
      { error: 'Failed to create/update alert rule' },
      { status: 500 }
    );
  }
}
