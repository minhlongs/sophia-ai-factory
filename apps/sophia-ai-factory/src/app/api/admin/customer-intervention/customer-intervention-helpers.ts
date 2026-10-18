import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { ChurnRiskLevel } from '@/seed/types/retention-types';
import {
  listAllCustomerHealthMetrics,
  getRetentionSummaryStats,
  executeFounderIntervention,
  getCustomerHealthMetrics,
} from '@/land/growth/customer-retention-service';

export const interventionSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  bonusCredits: z.number().int().min(0).max(50000).optional().default(500),
  customMessage: z.string().max(2000).optional(),
  notifyEmail: z.boolean().optional().default(true),
  notifyTelegram: z.boolean().optional().default(true),
});

export async function handleCustomerInterventionGet(req: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');

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

export async function handleCustomerInterventionPost(
  req: NextRequest,
  actorUserId: string,
): Promise<NextResponse> {
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
      actorUserId,
    });

    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.message },
        { status: 404 },
      );
    }

    logger.info('[admin/customer-intervention] Intervention executed', {
      adminId: actorUserId,
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
