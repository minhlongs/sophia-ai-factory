/**
 * Admin Customer Linkage Audit Endpoint
 *
 * Audit and fix licenses missing Polar/Stripe customer IDs
 * Required for usage metering and billing reconciliation
 *
 * Authentication: Basic Auth (ADMIN_USER / ADMIN_PASS)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';

/**
 * Verify admin Basic Auth credentials
 */
function isAdminAuthorized(request: NextRequest): boolean {
  const basicAuth = request.headers.get('authorization');
  if (!basicAuth) return false;

  try {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');
    const validUser = process.env.ADMIN_USER;
    const validPass = process.env.ADMIN_PASS;
    if (!validUser || !validPass) return false;
    return user === validUser && pwd === validPass;
  } catch {
    return false;
  }
}

/**
 * GET /api/admin/usage/customer-linkage
 *
 * Audit licenses missing customer linkage
 * Returns count and list of licenses without Polar/Stripe customer IDs
 */
export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin Basic Auth required.' },
      { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } }
    );
  }

  try {
    const supabase = createAdminClient();

    // Find licenses missing customer IDs
    const { data: licensesData, error } = await supabase
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
      logger.error('[Customer Linkage Audit] Failed to query licenses', error);
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
      const metadata = l.metadata as Record<string, any> | null;
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
        hasMetadataCustomerId: !!(l.metadata as any)?.polar_customer_id || !!(l.metadata as any)?.stripe_customer_id,
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
 * POST /api/admin/usage/customer-linkage/fix
 *
 * Backfill missing customer IDs from metadata
 * Returns count of fixed records
 */
export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin Basic Auth required.' },
      { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } }
    );
  }

  try {
    const supabase = createAdminClient();

    // Get all licenses with customer IDs in metadata but not in columns
    const { data: licensesData, error: fetchError } = await supabase
      .from('raas_licenses')
      .select('nonce, metadata')
      .or('polar_customer_id.is.null,stripe_customer_id.is.null');

    const licenses = licensesData as Array<{
      nonce: string;
      metadata: Record<string, unknown> | null;
    }> | null;

    if (fetchError) {
      logger.error('[Customer Linkage Fix] Failed to fetch licenses', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch licenses', details: fetchError.message },
        { status: 500 }
      );
    }

    let fixedCount = 0;
    const errors: string[] = [];

    for (const license of licenses || []) {
      const metadata = license.metadata as Record<string, string> | null;
      if (!metadata) continue;

      const polarCustomerId = metadata.polar_customer_id;
      const stripeCustomerId = metadata.stripe_customer_id;

      if (!polarCustomerId && !stripeCustomerId) continue;

      // Build update object - Supabase types require any for partial updates
      const updateData: any = {};
      if (polarCustomerId) {
        updateData.polar_customer_id = polarCustomerId;
      }
      if (stripeCustomerId) {
        updateData.stripe_customer_id = stripeCustomerId;
      }

      // Update license - use any for Supabase type compatibility
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      const { error: updateError } = await supabase
        .from('raas_licenses')
        // @ts-expect-error - Supabase types don't allow partial updates correctly
        .update(updateData)
        .eq('nonce', license.nonce);

      if (updateError) {
        errors.push(`Failed to update ${license.nonce.slice(0, 8)}...: ${updateError.message}`);
      } else {
        fixedCount++;
      }
    }

    logger.info('[Customer Linkage Fix] Backfill complete', {
      fixedCount,
      totalErrors: errors.length,
    });

    return NextResponse.json({
      success: true,
      fixedCount,
      totalErrors: errors.length,
      errors: errors.slice(0, 10), // First 10 errors
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Customer Linkage Fix] Critical error', new Error(errorMessage));
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
