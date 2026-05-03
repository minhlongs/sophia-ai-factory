/**
 * /api/v1/credits — MCU Credit Balance
 *
 * GET — Returns current MCU balance for authenticated user
 *
 * Auth: Authorization: Bearer <api_key>
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateMissionApiKey } from '@/lib/missions/api-key-auth';
import { getBalance, listTransactions } from '@/lib/mcu/credits-repo';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await validateMissionApiKey(
    request.headers.get('authorization'),
    request.headers.get('x-api-key'),
  );
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const balance = await getBalance(auth.userId!);
  const transactions = await listTransactions(auth.userId!, 20);

  return NextResponse.json({
    ...balance,
    recent_transactions: transactions,
  });
}
