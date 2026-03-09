/**
 * POST /api/admin/quota/adjust
 *
 * Adjust quota limits for a specific license
 *
 * Request body:
 * - licenseNonce: string
 * - customLimits?: {
 *     dailyCredits?: number
 *     hourlyCredits?: number
 *     monthlyCredits?: number
 *     dailyRequests?: number
 *   }
 * - reason: string (audit trail)
 *
 * Admin authentication required
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import { z } from 'zod';

const adjustQuotaSchema = z.object({
  licenseNonce: z.string().min(1),
  customLimits: z.object({
    dailyCredits: z.number().positive().optional(),
    hourlyCredits: z.number().positive().optional(),
    monthlyCredits: z.number().positive().optional(),
    dailyRequests: z.number().positive().optional(),
  }).optional(),
  reason: z.string().min(10),
  effectiveDate: z.string().optional(), // ISO date string
});

export async function POST(req: NextRequest) {
  const adminAuth = req.headers.get('x-admin-key');

  // Admin authentication
  if (!adminAuth || adminAuth !== process.env.ADMIN_API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized - Admin API key required' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const validation = adjustQuotaSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues
        },
        { status: 400 }
      );
    }

    const { licenseNonce, customLimits, reason, effectiveDate } = validation.data;
    const supabase = createAdminClient();

    // Check if license exists
    const { data: license, error: licenseError } = await supabase
      .from('raas_licenses')
      .select('nonce, tier, created_by')
      .eq('nonce', licenseNonce)
      .single();

    if (licenseError || !license) {
      return NextResponse.json(
        { error: 'License not found' },
        { status: 404 }
      );
    }

    // Upsert quota limits
    const { error: upsertError } = await supabase
      .from('quota_limits')
      .upsert({
        license_nonce: licenseNonce,
        custom_daily_credits: customLimits?.dailyCredits,
        custom_hourly_credits: customLimits?.hourlyCredits,
        custom_monthly_credits: customLimits?.monthlyCredits,
        custom_daily_requests: customLimits?.dailyRequests,
        updated_by: 'admin-api',
        updated_at: new Date().toISOString(),
        notes: `Adjusted via Admin API: ${reason}`,
        effective_from: effectiveDate ? new Date(effectiveDate).getTime() : null,
      }, {
        onConflict: 'license_nonce',
      });

    if (upsertError) {
      logger.error('[Admin Quota API] Failed to adjust quota limits', upsertError);
      return NextResponse.json(
        { error: 'Failed to adjust quota limits', details: upsertError.message },
        { status: 500 }
      );
    }

    // Log audit event
    const { data: auditData } = await supabase
      .from('audit_logs')
      .insert({
        event_type: 'quota_adjusted',
        user_id: license.created_by,
        license_nonce: licenseNonce,
        metadata: {
          adjusted_by: 'admin-api',
          reason,
          customLimits,
          effectiveDate,
        },
        ip_address: req.headers.get('x-forwarded-for'),
      })
      .select('id')
      .single();

    logger.info('[Admin Quota API] Quota limits adjusted', {
      licenseNonce: licenseNonce.slice(0, 8) + '...',
      tier: license.tier,
      customLimits,
      reason,
      auditId: auditData?.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Quota limits adjusted successfully',
      license: {
        nonce: licenseNonce.slice(0, 8) + '...',
        tier: license.tier,
      },
      customLimits,
    });

  } catch (error) {
    logger.error('[Admin Quota API] Unexpected error', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
