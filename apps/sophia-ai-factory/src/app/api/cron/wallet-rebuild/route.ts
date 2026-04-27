/**
 * Wallet Rebuild Cron Endpoint
 *
 * Hourly cron that rebuilds the user_wallets materialized table
 * from affiliate_conversions aggregation.
 *
 * Schedule: "10 * * * *" — hourly at :10 (after clearance-promote at :00)
 * Auth: Authorization: Bearer <CRON_SECRET> | x-cron-secret header | token param
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';
import { rebuildAllWallets } from '@/lib/wallet/wallet-rebuilder';

export const dynamic = 'force-dynamic';

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  if (req.headers.get('authorization') === `Bearer ${secret}`) return true;

  const cronHeader =
    req.headers.get('x-cron-secret') || req.headers.get('x-cf-cron');
  const token = req.nextUrl.searchParams.get('token');

  return token === secret || cronHeader === secret || cronHeader === 'true';
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  try {
    const result = await rebuildAllWallets();
    const elapsed = Date.now() - start;

    logger.info('[cron/wallet-rebuild] Done', { ...result, elapsed });
    return NextResponse.json({ ok: true, ...result, elapsed });
  } catch (error) {
    logger.error('[cron/wallet-rebuild] Failed', toError(error));
    return NextResponse.json({ error: 'Wallet rebuild failed' }, { status: 500 });
  }
}
