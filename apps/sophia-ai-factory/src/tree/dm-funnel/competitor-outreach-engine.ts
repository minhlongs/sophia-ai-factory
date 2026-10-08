/**
 * @file competitor-outreach-engine.ts
 * @description Analyzes competitor video comments for purchase intent and prepares safe outreach
 * @layer tree
 */

export interface CompetitorCommentEvaluationInput {
  commentText: string;
  authorUsername: string;
  competitorTopic: string;
  targetOfferName: string;
  targetDiscountPercentage?: number;
}

export interface OutreachRecommendation {
  isEligibleForOutreach: boolean;
  intentScore: number;
  detectedIntentType: 'PRICE_SEEKING' | 'PRODUCT_LINK' | 'DISSATISFACTION' | 'NEUTRAL';
  outreachMessage: string;
  complianceWarning?: string;
}

export function evaluateCompetitorOutreach(
  input: CompetitorCommentEvaluationInput,
): OutreachRecommendation {
  const text = input.commentText.toLowerCase();
  const discount = input.targetDiscountPercentage ?? 20;

  if (text.includes('giá') || text.includes('bao nhiêu') || text.includes('nhiêu tiền') || text.includes('price')) {
    return {
      isEligibleForOutreach: true,
      intentScore: 92,
      detectedIntentType: 'PRICE_SEEKING',
      outreachMessage: `Chào bạn ${input.authorUsername}! Bên mình vừa ra mắt ${input.targetOfferName} có tính năng tương tự nhưng đang trợ giá giảm ${discount}%. Bạn check tin nhắn riêng để nhận link voucher nhé!`,
    };
  }

  if (text.includes('link') || text.includes('mua ở đâu') || text.includes('shop ở đâu') || text.includes('xin link')) {
    return {
      isEligibleForOutreach: true,
      intentScore: 96,
      detectedIntentType: 'PRODUCT_LINK',
      outreachMessage: `Chào ${input.authorUsername}! Nếu bạn quan tâm dòng ${input.targetOfferName}, mình gửi bạn link chính hãng kèm mã giảm ${discount}% tại đây nha!`,
    };
  }

  if (text.includes('chán') || text.includes('lỗi') || text.includes('đắt quá') || text.includes('thất vọng')) {
    return {
      isEligibleForOutreach: true,
      intentScore: 85,
      detectedIntentType: 'DISSATISFACTION',
      outreachMessage: `Chào ${input.authorUsername}! Thấy bạn chưa ưng ý với sản phẩm bên đó, bạn có thể tham khảo qua ${input.targetOfferName} bên mình được bảo hành 1 đổi 1 trong 30 ngày nha!`,
    };
  }

  return {
    isEligibleForOutreach: false,
    intentScore: 30,
    detectedIntentType: 'NEUTRAL',
    outreachMessage: '',
    complianceWarning: 'Không phát hiện ý định mua hàng rõ ràng, bỏ qua để tránh spam.',
  };
}
