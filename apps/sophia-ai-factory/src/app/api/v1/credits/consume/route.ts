/**
 * /api/v1/credits/consume — Consume MCU Credits
 *
 * POST — Atomically deducts MCU credits from authenticated user
 *
 * Auth: Authorization: Bearer <api_key>
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateMissionApiKey, apiKeyAuthErrorResponse } from '@/tree/missions/api-key-auth';
import { deductCredits, getBalance } from '@/tree/mcu/credits-repo';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';

export const dynamic = 'force-dynamic';

export const POST = withRateLimit(async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await validateMissionApiKey(
    request.headers.get('authorization'),
    request.headers.get('x-api-key'),
  );
  if (!auth.valid) {
    return apiKeyAuthErrorResponse(auth);
  }

  try {
    const body = (await request.json()) as { amount?: number; reason?: string; missionId?: string };
    const amount = Number(body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount', detail: 'Amount must be a positive number' },
        { status: 400 },
      );
    }

    const reason = body.reason || 'sdk_consume';
    const missionId = body.missionId || `consume_${Date.now()}`;

    const success = await deductCredits(auth.userId!, amount, missionId, reason);
    if (!success) {
      return NextResponse.json(
        { error: 'Insufficient credits', detail: 'Not enough MCU balance' },
        { status: 402 },
      );
    }

    const currentBalance = await getBalance(auth.userId!);
    return NextResponse.json({
      success: true,
      credits_consumed: amount,
      credits_remaining: currentBalance.credits_remaining,
      transaction_id: missionId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Bad request', detail: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } });
