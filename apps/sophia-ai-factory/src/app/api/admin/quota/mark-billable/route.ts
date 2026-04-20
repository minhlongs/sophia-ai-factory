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
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { z } from 'zod';

const markBillableSchema = z.object({
  eventIds: z.array(z.string().uuid()),
  pricePerCredit: z.number().positive().optional(),
  reason: z.string().min(10),
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
    const validation = markBillableSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { eventIds, pricePerCredit, reason } = validation.data;
    const db = createServerClient();

    // Get events to calculate total credits
    const { data: events, error: fetchError } = await db
      .from('overage_events')
      .select('id, exceeded_by, user_id, license_nonce')
      .in('id', eventIds);

    if (fetchError || !events || events.length === 0) {
      return NextResponse.json(
        { error: 'No valid events found' },
        { status: 404 }
      );
    }

    // Mark events as billable
    const { error: updateError } = await (db
      .from('overage_events') as ReturnType<typeof db.from>)
      .update({
        billable: true,
        updated_at: new Date().toISOString(),
      })
      .in('id', eventIds);

    if (updateError) {
      logger.error('[Admin Quota API] Failed to mark events as billable', updateError);
      return NextResponse.json(
        { error: 'Failed to mark events as billable', details: updateError.message },
        { status: 500 }
      );
    }

    // Calculate total billable credits
    const totalCredits = events.reduce((sum, e) => sum + (e.exceeded_by || 0), 0);
    const estimatedCost = pricePerCredit ? totalCredits * pricePerCredit : null;

    // Log audit event
    await db
      .from('audit_logs')
      .insert({
        event_type: 'overage_marked_billable',
        user_id: events[0]?.user_id || 'system',
        license_nonce: events[0]?.license_nonce,
        metadata: {
          eventCount: eventIds.length,
          totalCredits,
          pricePerCredit,
          estimatedCost,
          reason,
          marked_by: 'admin-api',
        },
        ip_address: req.headers.get('x-forwarded-for'),
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
    logger.error('[Admin Quota API] Unexpected error', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
