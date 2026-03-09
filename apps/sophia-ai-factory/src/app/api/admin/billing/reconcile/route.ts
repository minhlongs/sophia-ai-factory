/**
 * POST /api/admin/billing/reconcile
 *
 * Trigger manual overage billing reconciliation
 * Admin-only endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reconcileOverageEventsWithRetry } from '@/lib/billing/overage-billing-reconciler';
import { logger } from '@/lib/utils/logger-utility';

export async function POST(req: NextRequest) {
  try {
    // Check admin auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const { data: userData } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single() as any;

    const isAdmin = userData?.role === 'admin' || (user as any).user_metadata?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 });
    }

    // Trigger reconciliation
    logger.info('[Admin Billing API] Starting manual reconciliation');

    const result = await reconcileOverageEventsWithRetry();

    logger.info('[Admin Billing API] Reconciliation complete', {
      success: result.success,
      scannedEvents: result.scannedEvents,
      billableEvents: result.billableEvents,
      totalCharge: result.totalCharge,
      errors: result.errors.length,
    });

    return NextResponse.json({
      success: result.success,
      scannedEvents: result.scannedEvents,
      billableEvents: result.billableEvents,
      totalCharge: result.totalCharge,
      currency: result.currency,
      invoiceItemsCreated: result.invoiceItemsCreated,
      eventsMarkedAsBilled: result.eventsMarkedAsBilled,
      errors: result.errors.map(e => ({
        type: e.type,
        message: e.message,
        retryable: e.retryable,
      })),
    });
  } catch (error) {
    logger.error('[Admin Billing API] Error during reconciliation', error as Error);
    return NextResponse.json(
      { error: 'Reconciliation failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
