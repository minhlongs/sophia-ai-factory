/**
 * Dual-Rail Payout API Route Helpers
 *
 * @module app/api/admin/payouts/dual-rail/dual-rail-route-helpers
 */

import { NextResponse } from 'next/server';
import {
  createDualRailPayoutBatch,
  executeDualRailBatch,
  generateVietQrCsv,
  DEFAULT_MIN_PAYOUT_CENTS,
} from '@/land/payouts/dual-rail-payout-engine';
import type { PayoutRail } from '@/seed/types/affiliate-expansion-types';

export interface DualRailPostBody {
  action?: 'preview' | 'execute' | 'export_csv';
  minPayoutCents?: number;
  rail?: PayoutRail | 'COMBINED';
  partnerIds?: string[];
  exchangeRateVnd?: number;
}

export function parseDualRailQuery(url: string): {
  minPayoutCents: number;
  rail: PayoutRail | 'COMBINED';
} {
  const { searchParams } = new URL(url);
  const minPayoutCentsRaw = searchParams.get('minPayoutCents');
  const railParam = searchParams.get('rail');

  const minPayoutCents = minPayoutCentsRaw
    ? Math.max(0, parseInt(minPayoutCentsRaw, 10))
    : DEFAULT_MIN_PAYOUT_CENTS;

  const rail: PayoutRail | 'COMBINED' =
    railParam === 'USDT' || railParam === 'VIETQR' ? railParam : 'COMBINED';

  return { minPayoutCents, rail };
}

export async function handleDualRailPostRequest(
  d1: D1Database,
  body: DualRailPostBody,
): Promise<NextResponse> {
  const action = body.action || 'preview';
  const minPayoutCents =
    typeof body.minPayoutCents === 'number'
      ? Math.max(0, body.minPayoutCents)
      : DEFAULT_MIN_PAYOUT_CENTS;
  const rail = body.rail || 'COMBINED';
  const partnerIds = Array.isArray(body.partnerIds) ? body.partnerIds : undefined;
  const exchangeRateVnd =
    typeof body.exchangeRateVnd === 'number' ? body.exchangeRateVnd : undefined;

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

  return NextResponse.json({
    success: true,
    batch,
  });
}
