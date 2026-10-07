/**
 * Bridge Page Builder
 *
 * Constructs high-converting, localized landing page metadata and copy
 * for TikTok, Reels, and YouTube Shorts bio-links.
 *
 * Layer: tree/affiliate/bridge (Domain Logic)
 * @module tree/affiliate/bridge/bridge-page-builder
 */

import type { BridgePageData, BuildBridgePageInput, BridgeNiche } from './bridge-page-types';

const SAAS_TEMPLATES = {
  vi: {
    title: 'Công Cụ Tự Động Hóa AI Đột Phá - Ưu Đãi Độc Quyền',
    headline: 'Tự Động Hóa 80% Quy Trình Với Trợ Lý AI Chuyên Sâu',
    subheadline: 'Tiết kiệm 15+ giờ mỗi tuần. Dùng thử miễn phí & nhận ưu đãi giảm 20% khi đăng ký hôm nay.',
    bulletPoints: [
      'Tích hợp tức thì với workflow chỉ trong 2 phút',
      'Xử lý hàng nghìn tác vụ lặp lại mà không cần biết code',
      'Hỗ trợ kỹ thuật 24/7 và cam kết hoàn tiền trong 30 ngày',
    ],
    couponText: 'Giảm 20% cho gói thường niên',
    ctaLabel: 'Nhận Ưu Đãi & Dùng Thử Ngay',
  },
  en: {
    title: 'Breakthrough AI Automation Tool - Exclusive Partner Offer',
    headline: 'Automate 80% of Daily Operations with Next-Gen AI',
    subheadline: 'Save 15+ hours every week. Try free today with an exclusive 20% off annual plan discount.',
    bulletPoints: [
      'Instant plug-and-play setup in under 2 minutes',
      'Scale repetitive content & operations with zero coding',
      '24/7 dedicated support with a 30-day money-back guarantee',
    ],
    couponText: '20% OFF Annual Subscription',
    ctaLabel: 'Claim Exclusive Offer & Start Free',
  },
};

const CRYPTO_TEMPLATES = {
  vi: {
    title: 'Cổng Giao Dịch Thế Hệ Mới - Ưu Đãi Giảm 100% Phí',
    headline: 'Tối Ưu Hóa Lợi Nhuận Giao Dịch Với Khớp Lệnh Cực Nhanh',
    subheadline: 'Khám phá nền tảng chuẩn tổ chức. Nhận mã giảm 30% phí giao dịch trọn đời khi đăng ký.',
    bulletPoints: [
      'Khớp lệnh micro-giây với thanh khoản sâu hàng đầu thị trường',
      'Bảo chứng an toàn quỹ tài sản với bảo mật đa chữ ký MPC',
      'Đặc quyền tham gia các đợt phát hành token sớm',
    ],
    couponText: 'Hoàn 30% phí giao dịch trọn đời',
    ctaLabel: 'Mở Tài Khoản & Nhận Ưu Đãi',
  },
  en: {
    title: 'Institutional Grade Trading Venue - VIP Zero Fee Access',
    headline: 'Maximize Trading Yield with Sub-Millisecond Execution',
    subheadline: 'Experience institutional liquidity with lifetime 30% fee rebate for early partner signups.',
    bulletPoints: [
      'Sub-millisecond order matching engine with top-tier depth',
      'MPC institutional-grade cold storage asset protection',
      'Exclusive allocation to early ecosystem launches',
    ],
    couponText: '30% Lifetime Trading Fee Rebate',
    ctaLabel: 'Claim VIP Pass & Register Now',
  },
};

export function buildBridgePageData(input: BuildBridgePageInput): BridgePageData {
  const isCrypto = input.productId.toLowerCase().startsWith('crypto');
  const niche: BridgeNiche = isCrypto ? 'crypto' : 'saas';
  const locale = input.locale === 'en' ? 'en' : 'vi';
  const country = (input.country || 'VN').toUpperCase();
  const template = niche === 'crypto' ? CRYPTO_TEMPLATES[locale] : SAAS_TEMPLATES[locale];
  const couponCode = niche === 'crypto' ? 'SOPHIAVIP' : 'SOPHIA20';

  return {
    productId: input.productId,
    niche,
    title: template.title,
    headline: template.headline,
    subheadline: template.subheadline,
    teaserVideoUrl: `/assets/videos/teaser-${niche}.mp4`,
    thumbnailUrl: `/assets/images/poster-${niche}.webp`,
    bulletPoints: template.bulletPoints,
    vanityCoupon: {
      code: couponCode,
      discountText: template.couponText,
      expiresInSeconds: 900,
    },
    destinationUrl: input.destinationUrl,
    ctaLabel: template.ctaLabel,
    locale,
    country,
  };
}
