import type { createServerClient } from '@/seed/db/client';
import type { SLOAlertLevel, SLOBurnMetrics, SLOConfig } from './types';

export function evaluateAlertLevel(burnRate: number): SLOAlertLevel {
  if (burnRate > 5) return 'emergency';
  if (burnRate > 2) return 'critical';
  if (burnRate > 1) return 'warning';
  if (burnRate > 0.5) return 'info';
  return null;
}

export async function computeBurnRate(
  _db: ReturnType<typeof createServerClient>,
  slo: SLOConfig,
  _yearMonth: string,
  _windowStart: string,
  _windowEnd: string
): Promise<SLOBurnMetrics> {
  // Placeholder - in real impl, fetch from WAE or metrics table
  const totalRequests = 0;
  const goodRequests = 0;
  const badRequests = 0;
  const measuredValue = slo.targetValue;
  const errorBudget = slo.targetOperator === 'gte'
    ? (1 - slo.targetValue) * totalRequests
    : slo.targetValue * totalRequests;
  const errorBudgetConsumed = badRequests;
  const burnRate = errorBudget > 0 ? errorBudgetConsumed / errorBudget : 0;
  const alertLevel = evaluateAlertLevel(burnRate);

  return {
    totalRequests,
    goodRequests,
    badRequests,
    measuredValue,
    errorBudget,
    errorBudgetConsumed,
    burnRate,
    alertLevel,
    p50: 0,
    p95: 0,
    p99: 0,
  };
}
