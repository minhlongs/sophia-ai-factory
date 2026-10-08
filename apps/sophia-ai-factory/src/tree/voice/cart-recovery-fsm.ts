/**
 * @file cart-recovery-fsm.ts
 * @description Pure FSM for AI Voice Objection Handling & TCPA/DNC Safe Time Windows
 * @layer tree
 */

import type { CartObjectionType } from '@/seed/types/growth-triad-v2-types';

export interface DncWindowCheckInput {
  currentHourLocal: number; // 0 - 23
  earliestAllowedHour?: number; // default 9 (09:00)
  latestAllowedHour?: number; // default 20 (20:00)
}

export interface ObjectionResolutionOutput {
  objection: CartObjectionType;
  resolutionStrategy: 'DISCOUNT_VOUCHER' | 'FREE_SHIPPING' | 'TRUST_GUARANTEE' | 'ALTERNATIVE_PRODUCT' | 'POLITE_CLOSE';
  suggestedDiscountPercent: number;
  voucherCodePrefix: string;
  responseScriptVi: string;
}

/**
 * Checks if current hour is within compliant DNC time window (e.g. 09:00 - 20:00)
 */
export function isDncCallingWindowSafe(input: DncWindowCheckInput): boolean {
  const earliest = input.earliestAllowedHour ?? 9;
  const latest = input.latestAllowedHour ?? 20;

  return input.currentHourLocal >= earliest && input.currentHourLocal < latest;
}

/**
 * Pure objection resolution mapper
 */
export function resolveCartObjection(
  objection: CartObjectionType,
  cartValue: number,
): ObjectionResolutionOutput {
  switch (objection) {
    case 'PRICE_TOO_HIGH': {
      const discount = cartValue > 500000 ? 15 : 10;
      return {
        objection,
        resolutionStrategy: 'DISCOUNT_VOUCHER',
        suggestedDiscountPercent: discount,
        voucherCodePrefix: 'VOICE_FLASH',
        responseScriptVi: `Dạ em hiểu ngân sách là rất quan trọng ạ! Để hỗ trợ anh/chị trải nghiệm ngay, bên em tặng riêng mã giảm ${discount}% áp dụng duy nhất trong 1 giờ tới nhé!`,
      };
    }
    case 'SHIPPING_COST': {
      return {
        objection,
        resolutionStrategy: 'FREE_SHIPPING',
        suggestedDiscountPercent: 0,
        voucherCodePrefix: 'FREESHIP',
        responseScriptVi: 'Dạ bên em vừa kích hoạt ưu đãi miễn phí giao hàng hỏa tốc toàn quốc cho đơn của anh/chị ngay bây giờ ạ!',
      };
    }
    case 'TRUST_ISSUE': {
      return {
        objection,
        resolutionStrategy: 'TRUST_GUARANTEE',
        suggestedDiscountPercent: 5,
        voucherCodePrefix: 'TRUST_CARE',
        responseScriptVi: 'Anh/chị hoàn toàn yên tâm ạ! Sản phẩm được bảo hành chính hãng đổi mới 1-1 trong 30 ngày và kiểm tra hàng trước khi thanh toán!',
      };
    }
    case 'COMPARE_OTHER': {
      return {
        objection,
        resolutionStrategy: 'ALTERNATIVE_PRODUCT',
        suggestedDiscountPercent: 10,
        voucherCodePrefix: 'BEST_CHOICE',
        responseScriptVi: 'Dòng này bên em được hơn 10.000 khách đánh giá 4.9 sao và hiện đang có quà tặng kèm độc quyền ạ!',
      };
    }
    case 'ACCIDENTAL_ADD':
    case 'UNKNOWN':
    default: {
      return {
        objection,
        resolutionStrategy: 'POLITE_CLOSE',
        suggestedDiscountPercent: 0,
        voucherCodePrefix: 'WELCOME',
        responseScriptVi: 'Dạ cảm ơn anh/chị đã quan tâm! Em xin phép gửi thông tin chi tiết qua SMS/Zalo để mình tiện tham khảo khi có nhu cầu nhé ạ!',
      };
    }
  }
}
