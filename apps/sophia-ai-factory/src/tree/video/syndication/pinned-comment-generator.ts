/**
 * Pinned Comment Generator
 *
 * Generates conversion-focused pinned comments for YouTube Shorts, TikTok,
 * and Instagram Reels with built-in affiliate disclosures and vanity coupons.
 *
 * Layer: tree/video/syndication (Domain Reusable Logic)
 * @module tree/video/syndication/pinned-comment-generator
 */

import type { PinnedCommentSpec } from './niche-syndication-types';

export interface GeneratePinnedCommentInput {
  productName: string;
  trackedUrl: string;
  niche: 'saas_global' | 'crypto_global';
  vanityCoupon?: string | null;
  locale?: 'en' | 'vi';
}

export function generatePinnedComment(input: GeneratePinnedCommentInput): PinnedCommentSpec {
  const { productName, trackedUrl, niche, vanityCoupon, locale = 'en' } = input;
  const isEn = locale === 'en';
  const isCrypto = niche === 'crypto_global';

  let cta: string;
  let text: string;

  if (isCrypto) {
    cta = isEn
      ? `🎁 Claim exclusive bonus & fee discount on ${productName}`
      : `🎁 Nhận thưởng nạp và giảm phí độc quyền trên ${productName}`;

    const codePart = vanityCoupon
      ? isEn
        ? `\n🔑 Promo Code: ${vanityCoupon}`
        : `\n🔑 Mã giới thiệu: ${vanityCoupon}`
      : '';

    const linkPart = isEn ? `👉 Access link: ${trackedUrl}` : `👉 Link đăng ký: ${trackedUrl}`;
    const disclaimerPart = isEn
      ? '\n⚠️ Disclaimer: Crypto trading involves risk. Not financial advice (FTC/MiCA).'
      : '\n⚠️ Lưu ý: Giao dịch Crypto có rủi ro. Không phải lời khuyên tài chính.';

    text = `${cta}${codePart}\n${linkPart}${disclaimerPart}`;
  } else {
    cta = isEn
      ? `🚀 Unlock ${productName} exclusive free trial & discount`
      : `🚀 Trải nghiệm ${productName} với ưu đãi giảm giá độc quyền`;

    const codePart = vanityCoupon
      ? isEn
        ? `\n🔑 Discount Code: ${vanityCoupon}`
        : `\n🔑 Mã giảm giá: ${vanityCoupon}`
      : '';

    const linkPart = isEn ? `👉 Link here: ${trackedUrl}` : `👉 Bấm vào đây: ${trackedUrl}`;
    const disclosurePart = isEn
      ? '\nℹ️ Ad disclosure: We may earn a commission if you sign up via this link.'
      : '\nℹ️ Minh bạch: Kênh có thể nhận hoa hồng nếu bạn đăng ký qua link này.';

    text = `${cta}${codePart}\n${linkPart}${disclosurePart}`;
  }

  return {
    text,
    trackedUrl,
    hasDisclaimer: true,
    couponCode: vanityCoupon || undefined,
    callToAction: cta,
  };
}
