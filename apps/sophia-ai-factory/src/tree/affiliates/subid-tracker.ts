/**
 * SubID Tracker & Multi-Network Affiliate URL Builder
 *
 * Tailors tracking query parameters across Impact, PartnerStack, Rewardful, FirstPromoter, and Crypto Exchanges.
 * Layer: land (affiliates business logic)
 * @module land/affiliates/subid-tracker
 */

export type AffiliateNetworkType =
  | 'IMPACT'
  | 'PARTNERSTACK'
  | 'REWARDFUL'
  | 'FIRSTPROMOTER'
  | 'BINANCE'
  | 'BYBIT'
  | 'GENERIC';

export interface NetworkTrackedUrlInput {
  targetUrl: string;
  affiliateCode: string;
  subId?: string | null;
  vanityCoupon?: string | null;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export function detectAffiliateNetwork(rawUrl: string): AffiliateNetworkType {
  const lower = rawUrl.toLowerCase();
  if (lower.includes('impact.com') || lower.includes('sjv.io') || lower.includes('pxf.io')) {
    return 'IMPACT';
  }
  if (lower.includes('partnerstack.com') || lower.includes('grsm.io')) {
    return 'PARTNERSTACK';
  }
  if (lower.includes('rewardful') || lower.includes('via=')) {
    return 'REWARDFUL';
  }
  if (lower.includes('firstpromoter') || lower.includes('fpr=')) {
    return 'FIRSTPROMOTER';
  }
  if (lower.includes('binance.com')) {
    return 'BINANCE';
  }
  if (lower.includes('bybit.com')) {
    return 'BYBIT';
  }
  return 'GENERIC';
}

const NETWORK_PARAM_MAP: Record<AffiliateNetworkType, { ref: string; sub: string }> = {
  IMPACT: { ref: 'subId1', sub: 'subId2' },
  PARTNERSTACK: { ref: 'ps_partner_key', sub: 'ps_xid' },
  REWARDFUL: { ref: 'via', sub: 'campaign' },
  FIRSTPROMOTER: { ref: 'fpr', sub: 'fp_sub' },
  BINANCE: { ref: 'ref', sub: 'sub_id' },
  BYBIT: { ref: 'affiliate_id', sub: 'sub_id' },
  GENERIC: { ref: 'ref', sub: 'sub_id' },
};

export function buildNetworkTrackedUrl(input: NetworkTrackedUrlInput): string {
  const { targetUrl, affiliateCode, subId, vanityCoupon, utmSource = 'youtube_short', utmMedium = 'video', utmCampaign } = input;

  let urlObj: URL;
  try {
    urlObj = new URL(targetUrl);
  } catch {
    return targetUrl;
  }

  const network = detectAffiliateNetwork(targetUrl);
  const mapping = NETWORK_PARAM_MAP[network] ?? NETWORK_PARAM_MAP.GENERIC;
  urlObj.searchParams.set(mapping.ref, affiliateCode);
  if (subId) {
    urlObj.searchParams.set(mapping.sub, subId);
  }

  urlObj.searchParams.set('utm_source', utmSource);
  urlObj.searchParams.set('utm_medium', utmMedium);
  if (utmCampaign) {
    urlObj.searchParams.set('utm_campaign', utmCampaign);
  }
  if (vanityCoupon) {
    urlObj.searchParams.set('coupon', vanityCoupon);
  }

  return urlObj.toString();
}

export function formatComplianceCaption(
  productName: string,
  trackedUrl: string,
  vanityCoupon?: string | null,
  isCrypto: boolean = false,
  locale: 'en' | 'vi' = 'en',
): string {
  const couponLine = vanityCoupon
    ? locale === 'vi'
      ? `🎁 Mã ưu đãi độc quyền: ${vanityCoupon}`
      : `🎁 Exclusive Promo Code: ${vanityCoupon}`
    : '';

  const disclosure = isCrypto
    ? locale === 'vi'
      ? '⚠️ CẢNH BÁO RỦI RO: Giao dịch tiền mã hóa có rủi ro thua lỗ vốn cao. 70-80% tài khoản nhà đầu tư cá nhân thua lỗ. Nội dung mang tính giáo dục, không phải lời khuyên tài chính. Paid partnership (FTC 16 CFR § 255).'
      : '⚠️ RISK WARNING: Crypto trading involves substantial loss risk. 70-80% retail lose capital. Not financial advice. Paid partnership (FTC 16 CFR § 255 / CFTC 4.41).'
    : locale === 'vi'
    ? '⚖️ MINH BẠCH: Video có chứa liên kết tiếp thị liên kết (affiliate link). Chúng tôi nhận hoa hồng khi bạn đăng ký dịch vụ (FTC 16 C.F.R. § 255).'
    : '⚖️ DISCLOSURE: This content contains affiliate links. We receive a commission when you register at no extra cost to you (FTC 16 C.F.R. § 255).';

  return [
    `🔥 ${productName}:`,
    `👉 ${trackedUrl}`,
    couponLine,
    '',
    disclosure,
  ]
    .filter(Boolean)
    .join('\n');
}
