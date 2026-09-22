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
import {
  createDualRailPayoutBatch,
  executeDualRailBatch,
  generateVietQrCsv,
  DEFAULT_MIN_PAYOUT_CENTS,
} from '@/land/payouts/dual-rail-payout-engine';
import { PayoutRail } from '@/seed/types/affiliate-expansion-types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const minPayoutCentsRaw = searchParams.get('minPayoutCents');
    const railParam = searchParams.get('rail');

    const minPayoutCents = minPayoutCentsRaw
      ? Math.max(0, parseInt(minPayoutCentsRaw, 10))
      : DEFAULT_MIN_PAYOUT_CENTS;

    const rail: PayoutRail | 'COMBINED' =
      railParam === 'USDT' || railParam === 'VIETQR' ? railParam : 'COMBINED';

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
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: 'preview' | 'execute' | 'export_csv';
      minPayoutCents?: number;
      rail?: PayoutRail | 'COMBINED';
      partnerIds?: string[];
      exchangeRateVnd?: number;
    };

    const action = body.action || 'preview';
    const minPayoutCents = typeof body.minPayoutCents === 'number'
      ? Math.max(0, body.minPayoutCents)
      : DEFAULT_MIN_PAYOUT_CENTS;
    const rail = body.rail || 'COMBINED';
    const partnerIds = Array.isArray(body.partnerIds) ? body.partnerIds : undefined;
    const exchangeRateVnd = typeof body.exchangeRateVnd === 'number' ? body.exchangeRateVnd : undefined;

    const d1 = await getD1();
    if (!d1) {
      return NextResponse.json({ error: 'D1 database binding not available' }, { status: 503 });
    }
    const batch = await createDualRailPayoutBatch(d1, {
      minPayoutCents,
      rail: action === 'export_csv' ? 'VIETQR' : rail,
      partnerIds,
    });

    if (action === 'export_csv') {
      const csv = generateVietQrCsv(batch.items, {
        exchangeRateVnd,
        batchId: batch.batchId,
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="vietqr_payout_${batch.batchId}.csv"`,
        },
      });
    }

    if (action === 'execute') {
      const executionResult = await executeDualRailBatch(d1, batch, {
        exchangeRateVnd,
      });

      return NextResponse.json({
        success: true,
        batchId: executionResult.batchId,
        usdtResult: executionResult.usdtResult,
        vietQrItemCount: executionResult.vietQrItemCount,
        usdtItemCount: executionResult.usdtItemCount,
        exportedCount: executionResult.exportedCount,
        hasVietQrCsv: Boolean(executionResult.vietQrCsv),
      });
    }

    // Default: Return preview
    return NextResponse.json({
      success: true,
      batch,
    });
  } catch (error) {
    logger.error('[api/admin/payouts/dual-rail] Execution failed', toError(error));
    return NextResponse.json(
      { error: 'Dual-rail payout execution failed', detail: toError(error).message },
      { status: 500 }
    );
  }
}
