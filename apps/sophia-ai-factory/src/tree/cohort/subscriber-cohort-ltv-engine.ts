/**
 * @file subscriber-cohort-ltv-engine.ts
 * @description Pure algorithmic engine for Subscriber Cohort LTV & Weibull Hazard Decay
 * @layer tree
 */

import type {
  SubscriberCohortInput,
  MonthlyCohortSurvivalPoint,
  CohortLtvReport,
} from '@/seed/types/growth-triad-v8-types';

/**
 * Computes subscriber cohort survival curve, cumulative LTV, and peak hazard churn point
 */
export function computeSubscriberCohortLtv(input: SubscriberCohortInput): CohortLtvReport {
  const {
    cohortMonth,
    initialSubscribers,
    monthlySubscriptionPriceUsd,
    projectionMonths,
    weibullShapeBeta,
    weibullScaleLambda,
  } = input;

  const survivalCurve: MonthlyCohortSurvivalPoint[] = [];
  let cumulativeRevenue = 0;
  let maxHazardRate = -1;
  let peakHazardMonth = 1;

  for (let m = 1; m <= projectionMonths; m++) {
    // S(t) = exp(-(lambda * t)^beta)
    const scaledTime = weibullScaleLambda * m;
    const exponent = Math.pow(scaledTime, weibullShapeBeta);
    const survivalProbability = Number(Math.exp(-exponent).toFixed(4));

    // Instantaneous hazard rate h(t) = beta * lambda * (lambda * t)^(beta - 1)
    const hazardRate = weibullShapeBeta * weibullScaleLambda * Math.pow(scaledTime, weibullShapeBeta - 1);
    const normalizedHazard = Number(Math.min(1.0, Math.max(0.01, hazardRate)).toFixed(4));

    if (normalizedHazard > maxHazardRate) {
      maxHazardRate = normalizedHazard;
      peakHazardMonth = m;
    }

    const activeSubscribers = Math.round(initialSubscribers * survivalProbability);
    const projectedRevenueUsd = activeSubscribers * monthlySubscriptionPriceUsd;
    cumulativeRevenue += projectedRevenueUsd;

    survivalCurve.push({
      monthIndex: m,
      survivalProbability,
      activeSubscribers,
      projectedRevenueUsd: Number(projectedRevenueUsd.toFixed(2)),
      hazardRate: normalizedHazard,
    });
  }

  const cumulativeLtvUsd = Number(cumulativeRevenue.toFixed(2));

  // Determine prescribed intervention
  let recommendedAction: string;
  if (peakHazardMonth <= 3) {
    recommendedAction = `Khẩn cấp: Tăng cường Onboarding & kích hoạt tính năng VIP trước tháng ${peakHazardMonth} để chặn làn sóng churn sớm.`;
  } else if (peakHazardMonth <= 6) {
    recommendedAction = `Tối ưu hóa: Triển khai chiến dịch quà tặng định kỳ (VIP gift drops) vào tháng ${peakHazardMonth - 1} để gia hạn chu kỳ đăng ký.`;
  } else {
    recommendedAction = `Mở rộng: Chuyển đổi nhóm thành viên trung thành sang gói Annual Membership trước tháng ${peakHazardMonth} với ưu đãi 20%.`;
  }

  return {
    cohortMonth,
    cumulativeLtvUsd,
    churnHazardPeakMonth: peakHazardMonth,
    recommendedAction,
    survivalCurve,
  };
}
