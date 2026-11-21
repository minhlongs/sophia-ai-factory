import { getD1 } from '@/seed/db/client';
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
    const body = (await request.json()) as { amount?: number; reason?: string; missionId?: string; orgId?: string };
    const amount = Number(body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount', detail: 'Amount must be a positive number' },
        { status: 400 },
      );
    }

    const orgId=body.orgId ?? auth.orgId;
    if(orgId !== undefined) {
      if(typeof orgId !== 'string' || !orgId || (auth.orgId && auth.orgId!==orgId))
        return NextResponse.json({error:'Organization scope mismatch'},{status:403});
      // Legacy user-only keys may not opt into another organization implicitly.
      if(auth.authKind==='api_key' && !auth.orgId)
        return NextResponse.json({error:'API key has no organization binding'},{status:403});
      const db=await getD1();
      const member=db && await db.prepare('SELECT 1 FROM org_members WHERE user_id=? AND org_id=?')
        .bind(auth.userId!,orgId).first();
      if(!member) return NextResponse.json({error:'Organization membership required'},{status:403});
    }
    const reason = body.reason || 'sdk_consume';
    const missionId = body.missionId || `consume_${Date.now()}`;

    const success = await deductCredits(auth.userId!, amount, missionId, reason, orgId);
    if (!success) {
      return NextResponse.json(
        { error: 'Insufficient credits', detail: 'Not enough MCU balance' },
        { status: 402 },
      );
    }

    const currentBalance = await getBalance(auth.userId!,orgId);
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
