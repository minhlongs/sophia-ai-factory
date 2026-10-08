/**
 * @file live-stock-synchronizer.ts
 * @description Real-time live shopping inventory monitor & surge flash-sale trigger
 * @layer tree
 */

export interface StockEvaluationInput {
  currentViewers: number;
  baselineViewers: number;
  remainingStock: number;
  surgeThresholdPercentage?: number;
}

export interface SurgeVoucherResult {
  shouldTriggerSurge: boolean;
  surgePercentage: number;
  recommendedVoucherCode?: string;
  recommendedDiscountPercent?: number;
  urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  fomoAnnouncementText: string;
}

export function evaluateLiveSurgeVoucher(input: StockEvaluationInput): SurgeVoucherResult {
  const threshold = input.surgeThresholdPercentage ?? 20;
  const viewerDiff = input.currentViewers - input.baselineViewers;
  const surgePercentage = input.baselineViewers > 0
    ? Math.round((viewerDiff / input.baselineViewers) * 100)
    : 0;

  const isViewerSurging = surgePercentage >= threshold;
  const isStockLow = input.remainingStock <= 50;

  if (isViewerSurging && input.remainingStock > 0) {
    const discount = isStockLow ? 40 : 25;
    const urgency = input.remainingStock <= 20 ? 'CRITICAL' : 'HIGH';

    return {
      shouldTriggerSurge: true,
      surgePercentage,
      recommendedVoucherCode: `FLASH_${discount}_OFF`,
      recommendedDiscountPercent: discount,
      urgencyLevel: urgency,
      fomoAnnouncementText: `🔥 Lượng xem tăng vọt +${surgePercentage}%! Kích hoạt ngay voucher giảm ${discount}% cho ${input.remainingStock} suất cuối cùng!`,
    };
  }

  return {
    shouldTriggerSurge: false,
    surgePercentage: Math.max(0, surgePercentage),
    urgencyLevel: 'LOW',
    fomoAnnouncementText: 'Giá sản phẩm và giỏ hàng đang ở mức tiêu chuẩn ổn định.',
  };
}
