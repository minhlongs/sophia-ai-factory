import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { recordSloBurn } from './alert-recorder';
import { computeBurnRate } from './metrics-evaluator';
import { SLO_CONFIGS } from './slo-configs';
import type { SLOCronItemResult, SLOCronResponse } from './types';

export async function handleSloBurnRateCron(request: NextRequest): Promise<NextResponse<SLOCronResponse | { error: string }>> {
  const authError = verifyCronAuth(request);
  if (authError) {
    return authError as NextResponse<{ error: string }>;
  }

  const now = new Date();
  const yearMonth = now.toISOString().slice(0, 7);
  const windowStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const windowEnd = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const db = createServerClient();
  const results: SLOCronItemResult[] = [];

  for (const slo of SLO_CONFIGS) {
    try {
      const metrics = await computeBurnRate(db, slo, yearMonth, windowStart, windowEnd);
      recordSloBurn(db, slo, yearMonth, windowStart, windowEnd, metrics);

      results.push({
        slo: slo.name,
        burnRate: metrics.burnRate,
        alertLevel: metrics.alertLevel,
        totalRequests: metrics.totalRequests,
      });
    } catch (err) {
      logger.error(`[SLO Cron] Failed to compute burn rate for ${slo.name}:`, toError(err));
      results.push({
        slo: slo.name,
        error: String(err),
      });
    }
  }

  return NextResponse.json({
    success: true,
    yearMonth,
    windowStart,
    windowEnd,
    results,
  });
}
