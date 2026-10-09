/**
 * Funnel Stage Conversion & Dropoff Calculator
 *
 * Layer: Land (Domain service & data aggregation, imports seed only)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module land/growth/analytics-service/funnel-calculator
 */

import type { FunnelStageMetrics } from '@/seed/types/solutions-types';
import type { CalculateFunnelStagesInput } from './types';

/**
 * Pure helper to compute stage conversion and dropoff percentages.
 */
export function calculateFunnelStages(counts: CalculateFunnelStagesInput): FunnelStageMetrics[] {
  const visitors = Math.max(0, counts.visitors);
  const leads = Math.max(0, counts.leads);
  const trials = Math.max(0, counts.trials);
  const paid = Math.max(0, counts.paid);

  // Conversion rate from previous stage
  const leadsConvRate = visitors > 0 ? (leads / visitors) * 100 : 0;
  const trialsConvRate = leads > 0 ? (trials / leads) * 100 : 0;
  const paidConvRate = trials > 0 ? (paid / trials) * 100 : 0;

  return [
    {
      stage: 'visitors',
      labelEn: 'Stage 1: Visitors & Impressions',
      labelVi: 'Giai Đoạn 1: Lượt Tiếp Cận & Click',
      count: visitors,
      previousCount: visitors,
      conversionRateFromPrev: 100.0,
      dropoffRateFromPrev: 0.0,
    },
    {
      stage: 'leads',
      labelEn: 'Stage 2: Inbound Leads',
      labelVi: 'Giai Đoạn 2: Khách Tiềm Năng',
      count: leads,
      previousCount: visitors,
      conversionRateFromPrev: Number(leadsConvRate.toFixed(2)),
      dropoffRateFromPrev: Number(Math.max(0, 100 - leadsConvRate).toFixed(2)),
    },
    {
      stage: 'trials',
      labelEn: 'Stage 3: Demos & Trials Dispatched',
      labelVi: 'Giai Đoạn 3: Xem Demo & Dùng Thử',
      count: trials,
      previousCount: leads,
      conversionRateFromPrev: Number(trialsConvRate.toFixed(2)),
      dropoffRateFromPrev: Number(Math.max(0, 100 - trialsConvRate).toFixed(2)),
    },
    {
      stage: 'paid',
      labelEn: 'Stage 4: Active Paying Customers',
      labelVi: 'Giai Đoạn 4: Khách Hàng Trả Phí',
      count: paid,
      previousCount: trials,
      conversionRateFromPrev: Number(paidConvRate.toFixed(2)),
      dropoffRateFromPrev: Number(Math.max(0, 100 - paidConvRate).toFixed(2)),
    },
  ];
}
