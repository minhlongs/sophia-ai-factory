import { BillingSummary, DunningRow, OverageRow } from './types';

export const OVERAGE_PRICING: Record<string, number> = {
  BASIC: 0.1,
  PREMIUM: 0.05,
  ENTERPRISE: 0.03,
  MASTER: 0.02,
};

export function calculateUnbilledOverageCents(rows: OverageRow[]): number {
  const total = rows.reduce((sum, row) => {
    const pricePerCredit = OVERAGE_PRICING[row.tier_at_exceeded] ?? 0.1;
    return sum + row.exceeded_by * pricePerCredit;
  }, 0);
  return Math.round(total * 100);
}

export function aggregateDunningStates(rows: DunningRow[]): BillingSummary['dunningStates'] {
  const counts = { current: 0, past_due: 0, delinquent: 0, suspended: 0 };
  for (const row of rows) {
    const state = row.dunning_state;
    if (state in counts) {
      counts[state as keyof typeof counts]++;
    }
  }
  return counts;
}
