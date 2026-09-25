/**
 * API Route: /api/creator/withdrawals
 *
 * GET: List withdrawal history and current unencumbered balance
 * POST: Submit a dual-rail withdrawal request (USDT or VietQR)
 *
 * @module app/api/creator/withdrawals/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import {
  listCreatorWithdrawals,
  createCreatorWithdrawalRequest,
  getCreatorUnencumberedBalance,
  getVietQrPaymentInfo,
} from '@/land/creator/creator-withdrawal-service';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const db = await getD1();
  if (!db) {
    return NextResponse.json({ error: 'DATABASE_UNAVAILABLE' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = parseInt(searchParams.get('limit') ?? '20', 10);
  const offsetParam = parseInt(searchParams.get('offset') ?? '0', 10);

  try {
    const [withdrawals, balances] = await Promise.all([
      listCreatorWithdrawals(db, user.id, {
        limit: limitParam,
        offset: offsetParam,
      }),
      getCreatorUnencumberedBalance(db, user.id),
    ]);

    const itemsWithQr = withdrawals.items.map((item) => ({
      ...item,
      vietQr: getVietQrPaymentInfo(item),
    }));

    return NextResponse.json({
      withdrawals: itemsWithQr,
      total: withdrawals.total,
      balances,
    });
  } catch (err) {
    logger.error('Failed to list creator withdrawals via API', { userId: user.id, error: String(err) });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const db = await getD1();
  if (!db) {
    return NextResponse.json({ error: 'DATABASE_UNAVAILABLE' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const res = await createCreatorWithdrawalRequest(db, user.id, body as never);

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    const vietQr = res.request ? getVietQrPaymentInfo(res.request) : null;

    return NextResponse.json(
      {
        withdrawal: res.request,
        vietQr,
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error('Failed to create creator withdrawal request via API', { userId: user.id, error: String(err) });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}
