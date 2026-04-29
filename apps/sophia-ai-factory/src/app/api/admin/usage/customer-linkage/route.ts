/**
 * Admin Customer Linkage Audit Endpoint
 *
 * Audit and fix licenses missing Polar/Stripe customer IDs
 * Required for usage metering and billing reconciliation
 *
 * Authentication: Better Auth session + role === 'admin'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';
import { requireAdmin } from '@/lib/auth/require-admin';
import { customerLinkageRequestSchema } from '@/lib/validation/services';
import type { RaasLicenseUpdate } from '@/lib/supabase/types';

/**
 * GET /api/admin/usage/customer-linkage
 *
 * Audit licenses missing customer linkage
 * Returns count and list of licenses without Polar/Stripe customer IDs
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const db = createServerClient();

    // Find licenses missing customer IDs
    const { data: licensesData, error } = await db
      // TODO P2: polar_customer_id / stripe_customer_id columns may not exist in raas_licenses schema.
      // Polar.sh is BANNED per Sophia rules (CLAUDE.md). This admin endpoint may be obsolete — verify or delete.
      .from('raas_licenses')
      .select(`
        nonce,
        tier,
        created_by,
        created_at,
        metadata,
        polar_customer_id,
        stripe_customer_id
      `)
      .eq('is_revoked', false)
      .or('polar_customer_id.is.null,stripe_customer_id.is.null')
      .limit(100);

    const licenses = licensesData as Array<{
      nonce: string;
      tier: string;
      created_by: string;
      created_at: string;
      metadata: Record<string, unknown> | null;
      polar_customer_id: string | null;
      stripe_customer_id: string | null;
    }> | null;

    if (error) {
      logger.error('[Customer Linkage Audit] Failed to query licenses', toError(error));
      return NextResponse.json(
        { error: 'Database query failed', details: error.message },
        { status: 500 }
      );
    }

    // Analyze linkage status
    const missingPolar = licenses?.filter(l => !l.polar_customer_id).length ?? 0;
    const missingStripe = licenses?.filter(l => !l.stripe_customer_id).length ?? 0;
    const missingBoth = licenses?.filter(l => !l.polar_customer_id && !l.stripe_customer_id).length ?? 0;

    // Check if metadata has customer IDs (for backfill)
    const canBackfillFromMetadata = licenses?.filter(l => {
      const metadata = l.metadata as Record<string, unknown> | null;
      return metadata && (metadata.polar_customer_id || metadata.stripe_customer_id);
    }).length || 0;

    return NextResponse.json({
      total: licenses?.length || 0,
      missingPolar,
      missingStripe,
      missingBoth,
      canBackfillFromMetadata,
      licenses: licenses?.map(l => ({
        nonce: l.nonce.slice(0, 8) + '...',
        tier: l.tier,
        createdBy: l.created_by,
        createdAt: l.created_at,
        hasPolarCustomerId: !!l.polar_customer_id,
        hasStripeCustomerId: !!l.stripe_customer_id,
        hasMetadataCustomerId: !!(l.metadata as Record<string, unknown> | null)?.polar_customer_id || !!(l.metadata as Record<string, unknown> | null)?.stripe_customer_id,
      })),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Customer Linkage Audit] Critical error', new Error(errorMessage));
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/usage/customer-linkage
 *
 * Link customer IDs to licenses
 * Body: { license_nonce, polar_customer_id?, stripe_customer_id? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    // Parse and validate request body with Zod
    const body = await request.json().catch(() => ({}));
    const validation = customerLinkageRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.flatten()
        },
        { status: 400 }
      );
    }

    const { license_nonce, polar_customer_id, stripe_customer_id } = validation.data;
    const db = createServerClient();

    // Update license with customer IDs
    const { error: updateError } = await (db.from('raas_licenses') as ReturnType<typeof db.from>)
      .update({
        ...(polar_customer_id ? { polar_customer_id } : {}),
        ...(stripe_customer_id ? { stripe_customer_id } : {}),
      })
      .eq('nonce', license_nonce);

    if (updateError) {
      logger.error('[Customer Linkage] Failed to update license', toError(updateError));
      return NextResponse.json(
        { error: 'Failed to update license', details: updateError.message },
        { status: 500 }
      );
    }

    logger.info('[Customer Linkage] License updated successfully', {
      licenseNonce: license_nonce,
      polarCustomerId: polar_customer_id,
      stripeCustomerId: stripe_customer_id,
    });

    return NextResponse.json({
      success: true,
      licenseNonce: license_nonce.slice(0, 8) + '...',
      polarCustomerId: polar_customer_id,
      stripeCustomerId: stripe_customer_id,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Customer Linkage] Critical error', new Error(errorMessage));
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
