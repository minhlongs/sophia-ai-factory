import type { DunningState } from '@/forest/components/billing/dunning-status-banner';

export interface UsageSummaryResponse {
  period: { start: number; end: number };
  usage: { apiCalls: number; videoGenerations: number; storage: number };
  limits: { apiCalls: number; videoGenerations: number; storage: number };
  percentages: { apiCalls: number; videoGenerations: number; storage: number };
  status: {
    apiCalls: 'ok' | 'warning' | 'critical' | 'overage';
    videoGenerations: 'ok' | 'warning' | 'critical' | 'overage';
    storage: 'ok' | 'warning' | 'critical' | 'overage';
  };
  overageEvents: {
    total: number;
    totalCredits: number;
    byType: Record<string, number>;
    billableEvents: number;
  };
  projectedCharges: {
    basePriceCents: number;
    overageChargesCents: number;
    totalCents: number;
    currency: string;
    gracePeriodCredits: number;
    billableCredits: number;
  };
  license: { nonce: string; tier: string };
}

export interface DunningStatusResponse {
  allowed: boolean;
  state: DunningState;
  gracePeriodEndsAt?: string | null;
  failedPaymentCount?: number;
  blockReason?: string;
}
