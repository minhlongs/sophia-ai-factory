/**
 * /api/v1/credits — MCU Credit Balance
 *
 * GET — Returns current MCU balance for authenticated user
 *
 * Auth: Authorization: Bearer <api_key>
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateMissionApiKey, apiKeyAuthErrorResponse } from '@/forest/missions/api-key-auth';
import { getBalance, listTransactions } from '@/land/mcu/credits-repo';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';

export const dynamic = 'force-dynamic';

export const GET = withRateLimit(async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await validateMissionApiKey(
    request.headers.get('authorization'),
    request.headers.get('x-api-key'),
  );
  if (!auth.valid) {
    return apiKeyAuthErrorResponse(auth);
  }

  const balance = await getBalance(auth.userId!);
  const transactions = await listTransactions(auth.userId!, 20);

  return NextResponse.json({
    ...balance,
    recent_transactions: transactions,
  });
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } });
