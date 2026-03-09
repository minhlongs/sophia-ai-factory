/**
 * POST /api/cron/overage-billing
 *
 * Automated cron job for overage billing reconciliation
 * Uses reconcileOverageEventsWithRetry for robust error handling
 *
 * Auth: Cron secret via Authorization: Bearer or x-cron-secret header
 * Method: POST only
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger-utility';
import { verifyCronAuth } from '@/lib/security/cron-auth';
import { reconcileOverageEventsWithRetry } from '@/lib/billing/overage-billing-reconciler';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ReconciliationResult } from '@/lib/billing/billing-types';

/**
 * Generate unique request ID for idempotency and audit
 */
function generateRequestId(): string {
  return `overage-cron-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Log reconciliation result to audit log
 */
async function logToAuditLog(
  result: ReconciliationResult,
  triggeredBy: 'cron' | 'manual',
  requestId: string
): Promise<void> {
  try {
    const supabase = createAdminClient();

    const auditEntry = {
      action: 'overage_billing_reconciliation',
      metadata: {
        triggeredBy,
        requestId,
        success: result.success,
        scannedEvents: result.scannedEvents,
        billableEvents: result.billableEvents,
        totalCharge: result.totalCharge,
        currency: result.currency,
        invoiceItemsCreated: result.invoiceItemsCreated,
        eventsMarkedAsBilled: result.eventsMarkedAsBilled,
        errorCount: result.errors.length,
        errors: result.errors.map(e => ({ type: e.type, message: e.message })),
      },
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('audit_logs')
      .insert(auditEntry);

    if (error) {
      logger.warn('[Cron Overage] Failed to log to audit table', { error: error.message });
    } else {
      logger.info('[Cron Overage] Audit log created', { requestId, success: result.success });
    }
  } catch (error) {
    logger.warn('[Cron Overage] Audit logging failed', error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * POST /api/cron/overage-billing
 * Cron-triggered overage billing reconciliation
 */
export async function POST(req: NextRequest) {
  const requestId = generateRequestId();

  // Verify cron authentication
  const authError = verifyCronAuth(req);
  if (authError) {
    logger.warn('[Cron Overage] Authentication failed', { requestId });
    return authError;
  }

  logger.info('[Cron Overage] Starting cron reconciliation', { requestId });

  try {
    // Execute reconciliation with retry logic
    const result: ReconciliationResult = await reconcileOverageEventsWithRetry();

    // Log to audit table
    await logToAuditLog(result, 'cron', requestId);

    // Build response
    const response = {
      success: result.success,
      requestId,
      scannedEvents: result.scannedEvents,
      billableEvents: result.billableEvents,
      totalCharge: result.totalCharge,
      currency: result.currency,
      invoiceItemsCreated: result.invoiceItemsCreated,
      eventsMarkedAsBilled: result.eventsMarkedAsBilled,
      errorCount: result.errors.length,
      errors: result.errors.map(e => ({
        type: e.type,
        message: e.message,
        retryable: e.retryable,
      })),
      timestamp: new Date().toISOString(),
    };

    logger.info('[Cron Overage] Cron reconciliation complete', {
      requestId,
      scannedEvents: response.scannedEvents,
      totalCharge: response.totalCharge,
      errors: response.errorCount,
    });

    return NextResponse.json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Cron Overage] Cron reconciliation failed', { requestId, error: errorMessage });

    // Log failure to audit
    await logToAuditLog(
      {
        success: false,
        scannedEvents: 0,
        unbilledEvents: 0,
        billableEvents: 0,
        totalOverageCredits: 0,
        totalCharge: 0,
        currency: 'USD',
        charges: [],
        invoiceItemsCreated: 0,
        eventsMarkedAsBilled: 0,
        errors: [{
          type: 'scanning',
          message: `Cron job failed: ${errorMessage}`,
          retryable: true,
          details: error,
        }],
      },
      'cron',
      requestId
    );

    return NextResponse.json(
      {
        error: 'Cron reconciliation failed',
        requestId,
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - return method not allowed
 */
export function GET() {
  return NextResponse.json(
    { error: 'Method not allowed - Use POST to trigger reconciliation' },
    { status: 405 }
  );
}
