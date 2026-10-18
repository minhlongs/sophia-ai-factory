/**
 * Admin Dual-Rail Payout API
 *
 * GET  /api/admin/payouts/dual-rail - Preview eligible affiliate payout batch (USDT + VietQR)
 * POST /api/admin/payouts/dual-rail - Execute dual-rail payout batch or export VietQR NAPAS 247 CSV
 *
 * Layer: app/api/admin (Protected route)
 *
 * @module app/api/admin/payouts/dual-rail/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { createDualRailPayoutBatch } from '@/land/payouts/dual-rail-payout-engine';
import {
  parseDualRailQuery,
  handleDualRailPostRequest,
  type DualRailPostBody,
} from './dual-rail-route-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const { minPayoutCents, rail } = parseDualRailQuery(request.url);

    const d1 = await getD1();
    if (!d1) {
      return NextResponse.json({ error: 'D1 database binding not available' }, { status: 503 });
    }
    const batch = await createDualRailPayoutBatch(d1, { minPayoutCents, rail });

    return NextResponse.json({
      success: true,
      batch,
    });
  } catch (error) {
    logger.error('[api/admin/payouts/dual-rail] Failed to preview payout batch', toError(error));
    return NextResponse.json(
      { error: 'Failed to preview payout batch' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const body = (await request.json().catch(() => ({}))) as DualRailPostBody;
    const d1 = await getD1();
    if (!d1) {
      return NextResponse.json({ error: 'D1 database binding not available' }, { status: 503 });
    }

    return await handleDualRailPostRequest(d1, body);
  } catch (error) {
    logger.error('[api/admin/payouts/dual-rail] Execution failed', toError(error));
    return NextResponse.json(
      { error: 'Dual-rail payout execution failed', detail: toError(error).message },
      { status: 500 },
    );
  }
}
