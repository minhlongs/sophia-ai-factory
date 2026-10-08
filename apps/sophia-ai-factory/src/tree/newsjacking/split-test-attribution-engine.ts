/**
 * @file split-test-attribution-engine.ts
 * @description Evaluates video Hook A vs Hook B performance and recommends auto loss-cut
 * @layer tree
 */

export interface SplitTestMetricsInput {
  experimentId: string;
  variantA: {
    views: number;
    clicks: number;
    conversions: number;
  };
  variantB: {
    views: number;
    clicks: number;
    conversions: number;
  };
  minViewsThreshold?: number;
  lossCutConversionDiffThreshold?: number;
}

export interface SplitTestEvaluationResult {
  experimentId: string;
  status: 'INSUFFICIENT_DATA' | 'RUNNING' | 'AUTO_CUT_TRIGGERED' | 'WINNER_DECLARED';
  winnerVariant: 'VARIANT_A' | 'VARIANT_B' | 'INCONCLUSIVE';
  conversionRateA: number;
  conversionRateB: number;
  trafficAllocationRecommendation: {
    allocationRatioA: number;
    allocationRatioB: number;
  };
  recommendationReason: string;
}

type VariantResolution = Pick<
  SplitTestEvaluationResult,
  'status' | 'winnerVariant' | 'trafficAllocationRecommendation' | 'recommendationReason'
>;

function computeRatios(isVariantAWinner: boolean, isSevereLoss: boolean): { allocationRatioA: number; allocationRatioB: number } {
  const winnerRatio = isSevereLoss ? 1.0 : 0.8;
  const loserRatio = isSevereLoss ? 0.0 : 0.2;
  return isVariantAWinner
    ? { allocationRatioA: winnerRatio, allocationRatioB: loserRatio }
    : { allocationRatioA: loserRatio, allocationRatioB: winnerRatio };
}

function resolveVariantAdvantage(
  higherRate: number,
  lowerRate: number,
  isVariantAWinner: boolean,
): VariantResolution {
  const isSevereLoss = lowerRate < 0.5 && higherRate > 2.0;
  const winner = isVariantAWinner ? 'VARIANT_A' : 'VARIANT_B';
  const label = isVariantAWinner ? 'Hook A' : 'Hook B';
  const loserLabel = isVariantAWinner ? 'Hook B' : 'Hook A';

  const recommendationReason = isSevereLoss
    ? `${label} vượt trội rõ rệt. Đã kích hoạt Auto-Cut dừng hoàn toàn ngân sách cho ${loserLabel}.`
    : `${label} đang dẫn đầu với tỷ lệ chuyển đổi cao hơn đáng kể.`;

  return {
    status: isSevereLoss ? 'AUTO_CUT_TRIGGERED' : 'WINNER_DECLARED',
    winnerVariant: winner,
    trafficAllocationRecommendation: computeRatios(isVariantAWinner, isSevereLoss),
    recommendationReason,
  };
}

function resolveSignificantDifference(
  rateA: number,
  rateB: number,
  diffThreshold: number,
): VariantResolution | null {
  const rateDiff = Math.abs(rateA - rateB);
  if (rateDiff < diffThreshold) return null;
  return rateA > rateB
    ? resolveVariantAdvantage(rateA, rateB, true)
    : resolveVariantAdvantage(rateB, rateA, false);
}

export function evaluateSplitTestAttribution(
  input: SplitTestMetricsInput,
): SplitTestEvaluationResult {
  const minViews = input.minViewsThreshold ?? 100;
  const rateA = input.variantA.views > 0
    ? (input.variantA.conversions / input.variantA.views) * 100
    : 0;
  const rateB = input.variantB.views > 0
    ? (input.variantB.conversions / input.variantB.views) * 100
    : 0;

  const roundedRateA = Number(rateA.toFixed(2));
  const roundedRateB = Number(rateB.toFixed(2));

  if (input.variantA.views < minViews || input.variantB.views < minViews) {
    return {
      experimentId: input.experimentId,
      status: 'INSUFFICIENT_DATA',
      winnerVariant: 'INCONCLUSIVE',
      conversionRateA: roundedRateA,
      conversionRateB: roundedRateB,
      trafficAllocationRecommendation: { allocationRatioA: 0.5, allocationRatioB: 0.5 },
      recommendationReason: `Chưa đủ dữ liệu tối thiểu (${minViews} views mỗi biến thể) để đánh giá.`,
    };
  }

  const diffThreshold = input.lossCutConversionDiffThreshold ?? 1.5;
  const resolvedAdvantage = resolveSignificantDifference(rateA, rateB, diffThreshold);

  if (resolvedAdvantage) {
    return {
      experimentId: input.experimentId,
      conversionRateA: roundedRateA,
      conversionRateB: roundedRateB,
      ...resolvedAdvantage,
    };
  }

  return {
    experimentId: input.experimentId,
    status: 'RUNNING',
    winnerVariant: 'INCONCLUSIVE',
    conversionRateA: roundedRateA,
    conversionRateB: roundedRateB,
    trafficAllocationRecommendation: { allocationRatioA: 0.5, allocationRatioB: 0.5 },
    recommendationReason: 'Hiệu suất 2 Hook đang tương đương nhau. Tiếp tục chia đều 50/50 traffic.',
  };
}
