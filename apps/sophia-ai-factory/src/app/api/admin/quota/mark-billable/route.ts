/**
 * POST /api/admin/quota/mark-billable
 *
 * Mark overage events as billable for reconciliation
 *
 * Request body:
 * - eventIds: string[] (array of overage event IDs)
 * - pricePerCredit: number (optional, override default)
 * - reason: string (audit trail)
 *
 * Admin authentication required
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  markBillableSchema,
  fetchOverageEvents,
  markEventsBillable,
  logAuditEvent,
} from './mark-billable-helpers';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const validation = markBillableSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const { eventIds, pricePerCredit, reason } = validation.data;

    const events = await fetchOverageEvents(eventIds);
    await markEventsBillable(eventIds);

    // Calculate total billable credits
    const totalCredits = events.reduce((sum, e) => sum + (e.exceeded_by || 0), 0);
    const estimatedCost = pricePerCredit ? totalCredits * pricePerCredit : null;

    // Log audit event
    await logAuditEvent({
      eventIds,
      totalCredits,
      pricePerCredit,
      estimatedCost,
      reason,
      userId: events[0]?.user_id || 'system',
      licenseNonce: events[0]?.license_nonce,
      ipAddress: req.headers.get('x-forwarded-for'),
    });

    logger.info('[Admin Quota API] Marked events as billable', {
      eventCount: eventIds.length,
      totalCredits,
      pricePerCredit,
      estimatedCost,
      reason,
    });

    return NextResponse.json({
      success: true,
      message: `Marked ${eventIds.length} events as billable`,
      summary: {
        eventCount: eventIds.length,
        totalCredits,
        pricePerCredit,
        estimatedCost,
      },
    });
  } catch (error) {
    logger.error('[Admin Quota API] Unexpected error', toError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}