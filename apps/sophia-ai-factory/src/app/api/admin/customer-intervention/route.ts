/**
 * Admin Customer Health Monitoring & 1-Click Founder Intervention API
 *
 * Route: /api/admin/customer-intervention
 *
 * GET: Lists customer health scores and high-level anti-churn statistics.
 * POST: Triggers 1-click founder intervention (bonus MCU credits + direct email/telegram outreach).
 *
 * Security: Admin authentication required via requireAdmin().
 *
 * @module app/api/admin/customer-intervention/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/seed/auth/require-admin';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { ChurnRiskLevel } from '@/seed/types/retention-types';
import {
  listAllCustomerHealthMetrics,
  getRetentionSummaryStats,
  executeFounderIntervention,
  getCustomerHealthMetrics,
} from '@/land/growth/customer-retention-service';

export const dynamic = 'force-dynamic';

const interventionSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  bonusCredits: z.number().int().min(0).max(50000).optional().default(500),
  customMessage: z.string().max(2000).optional(),
  notifyEmail: z.boolean().optional().default(true),
  notifyTelegram: z.boolean().optional().default(true),
});

/**
 * GET /api/admin/customer-intervention
 * Fetches monitored customers and summary statistics.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  try {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    // Single customer lookup
    if (userId) {
      const customer = await getCustomerHealthMetrics(userId);
      if (!customer) {
        return NextResponse.json({ ok: false, error: 'Customer not found' }, { status: 404 });
      }
      return NextResponse.json({ ok: true, customer });
    }

    const riskLevel = searchParams.get('riskLevel') as ChurnRiskLevel | null;
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)));
    const minScore = searchParams.get('minScore') ? Number(searchParams.get('minScore')) : undefined;
    const maxScore = searchParams.get('maxScore') ? Number(searchParams.get('maxScore')) : undefined;

    const [summary, customers] = await Promise.all([
      getRetentionSummaryStats(),
      listAllCustomerHealthMetrics({
        riskLevel: riskLevel || undefined,
        limit,
        minScore,
        maxScore,
      }),
    ]);

    return NextResponse.json({
      ok: true,
      summary,
      customers,
      count: customers.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[admin/customer-intervention] GET failed', { err: String(err) });
    return NextResponse.json(
      { ok: false, error: 'Failed to retrieve customer health metrics' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/customer-intervention
 * Executes 1-click founder intervention (bonus credits and/or personal message).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  try {
    const rawBody = await req.json();
    const parsed = interventionSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { userId, bonusCredits, customMessage, notifyEmail, notifyTelegram } = parsed.data;

    const result = await executeFounderIntervention({
      userId,
      bonusCredits,
      customMessage,
      notifyEmail,
      notifyTelegram,
      actorUserId: auth.user.id,
    });

    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.message },
        { status: 404 },
      );
    }

    logger.info('[admin/customer-intervention] Intervention executed', {
      adminId: auth.user.id,
      userId,
      bonusCredits,
      emailSent: result.emailSent,
      telegramNotified: result.telegramNotified,
    });

    return NextResponse.json({
      ok: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[admin/customer-intervention] POST failed', { err: String(err) });
    return NextResponse.json(
      { ok: false, error: 'Intervention execution failed', details: getErrorMessage(err) },
      { status: 500 },
    );
  }
}
