/**
 * Canonical Option A Commercial SKU Contract — Single Source of Truth.
 *
 * All pricing, checkout, offline bank transfer, receipt email, terms, refund policy,
 * and entitlement activation code MUST read Option A Paid Pilot invariants from here.
 *
 * Layer: seed (foundational config — zero upward imports).
 * @module seed/config/tiers/option-a-pilot-contract
 */

import { sha256Hex } from '@/seed/security/token-hash';

/** Pilot-only promise; never replaces higher or grandfathered entitlements. */
export const OPTION_A_PILOT_COPY = {
  en: {
    scope: '14-Day Paid Pilot: 1,990,000 VND; 500 MCU granted once; 14 calendar days in Asia/Saigon; AI scripts, campaign plans and affiliate assets; 0 Cloud video renders; no auto-renewal. BYOK provider charges are separate. Existing higher or grandfathered benefits are preserved.',
    refund: 'Pilot only: request a refund within 7 days regardless of MCU usage, or within 14 days for a Sophia-verified Option A campaign/script delivery failure. Refund is 100% of the amount actually received by Sophia. Third-party BYOK charges are excluded. Statutory rights remain unchanged.',
    channel: 'Manual offline bank transfer only (offline_bank_transfer). Refund requests remain available by emailing your order ID to support@mekongmind.com for manual review; missing email evidence remains reviewable and is never automatically denied.',
    checkoutConsent: 'I agree to the 14-Day Paid Pilot (Option A) terms: 1,990,000 VND one-time offline bank transfer, 14 calendar days (Asia/Saigon), 500 MCU once, 0 Cloud video renders, no auto-renewal, no public publishing guarantee, separate BYOK provider charges, and the 7-day goodwill / 14-day delivery-failure refund policy.',
  },
  vi: {
    scope: 'Pilot 14 ngày: 1.990.000 VND; cấp 500 MCU một lần; 14 ngày lịch theo Asia/Saigon; kịch bản AI, kế hoạch chiến dịch và tài nguyên affiliate; 0 lượt dựng video Cloud; không tự gia hạn. Phí nhà cung cấp BYOK tính riêng. Giữ nguyên quyền lợi cao hơn hoặc quyền lợi cũ.',
    refund: 'Riêng Pilot: yêu cầu hoàn tiền trong 7 ngày bất kể mức sử dụng MCU, hoặc trong 14 ngày nếu Sophia xác minh lỗi cung cấp campaign/script Option A. Hoàn 100% số tiền Sophia thực nhận. Không bao gồm phí BYOK bên thứ ba. Quyền luật định được giữ nguyên.',
    channel: 'Chỉ áp dụng chuyển khoản ngân hàng thủ công (offline_bank_transfer). Yêu cầu hoàn tiền có thể gửi qua cổng hoàn tiền web đã xác thực (ghi nhận dấu thời gian máy chủ ngay lập tức) hoặc gửi mã đơn hàng tới support@mekongmind.com để rà soát thủ công có giới hạn; thiếu bằng chứng email vẫn được xem xét và không bị từ chối tự động.',
    checkoutConsent: 'Tôi đồng ý với điều khoản Pilot 14 ngày (Option A): 1.990.000 VND chuyển khoản ngân hàng thủ công một lần, 14 ngày lịch (Asia/Saigon), 500 MCU một lần, 0 lượt dựng video Cloud, không tự gia hạn, không cam kết tự đăng công khai, phí BYOK tính riêng, và chính sách hoàn tiền thiện chí 7 ngày / lỗi cung cấp 14 ngày.',
  },
} as const;

const OPTION_A_PILOT_CONTRACT_BASE = {
  skuCode: 'BASIC_PILOT_14D',
  tier: 'BASIC',
  period: 'pilot_14d',
  paymentMethod: 'offline_bank_transfer',
  priceVnd: 1_990_000,
  currency: 'VND',
  timezone: 'Asia/Saigon',
  priceUsd: 79,
  priceUsdCents: 7_900,
  durationDays: 14,
  includedMcu: 500,
  guaranteedVideos: 0,
  videoRenderingIncluded: false,
  videoRenderingMinimumTier: 'PREMIUM',
  autoRenews: false,
  byokBilledDirectlyByProviders: true,
  publicSocialAutoPublishIncluded: false,
  brandName: 'Sophia AI Factory / MekongMind',
  supportEmail: 'support@mekongmind.com',
  legalApprovalStatus: 'pending_legal_review',
  termsVersion: '2026-11-19-v1-pending-legal-review',
  refundChannels: ['authenticated_web_intake', 'email_manual_review'] as const,
  refundPolicy: {
    pilotGoodwillWindowDays: 7,
    pilotDeliveryFailureWindowDays: 14,
    standardSubscriptionWindowDays: 30,
    masterWindowDays: 14,
    thirdPartyByokFeesRefundable: false,
    consumedMcuRefundable: true,
    goodwillRegardlessOfUsage: true,
    refundPercent: 100,
  },
} as const;

/**
 * Deterministic canonical JSON payload hashed to bind customer acceptance
 * to the exact Option A commercial terms, channel semantics, and bilingual copy.
 */
export function getOptionAAgreementCanonicalPayload(): string {
  return JSON.stringify({
    contract: OPTION_A_PILOT_CONTRACT_BASE,
    copy: OPTION_A_PILOT_COPY,
  });
}

/**
 * Computes the SHA-256 hex digest of the canonical Option A agreement payload.
 */
export async function computeOptionAAgreementHash(): Promise<string> {
  return sha256Hex(getOptionAAgreementCanonicalPayload());
}

/**
 * Precomputed SHA-256 hex digest of getOptionAAgreementCanonicalPayload().
 * Verified at test time against computeOptionAAgreementHash() and used for
 * synchronous client rendering + constant-time server verification.
 */
export const OPTION_A_PILOT_AGREEMENT_HASH =
  'b2b12dc6cdb7988028f9992a98170d86f5fe80ca0eff8162a950881a661f2e0f';

export const OPTION_A_PILOT_CONTRACT = {
  ...OPTION_A_PILOT_CONTRACT_BASE,
  termsHash: OPTION_A_PILOT_AGREEMENT_HASH,
} as const;

export type OptionAPilotContract = typeof OPTION_A_PILOT_CONTRACT;

export function formatOptionAPriceVnd(locale: 'vi' | 'en' = 'vi'): string {
  return locale === 'vi' ? '1.990.000 VND' : '1,990,000 VND';
}
