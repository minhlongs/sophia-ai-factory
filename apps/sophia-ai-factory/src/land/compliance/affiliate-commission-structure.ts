/**
 * Affiliate commission and payout structure — bilingual content data.
 *
 * The fixed economic terms of the affiliate program: what each plan costs,
 * what commission a partner earns, and how payouts are timed and tracked.
 * Rates are fixed by the program owner and must not drift per locale.
 */

/** Bilingual label/value pair, Vietnamese first. */
export interface BilingualText {
  vi: string;
  en: string;
}

export interface AffiliateCommissionTier {
  /** Canonical uppercase tier identifier. */
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  /** Tier name as partners see it. */
  name: BilingualText;
  /** Customer price in USD. */
  priceUsd: number;
  /** Whether the plan is charged monthly or once. */
  billing: BilingualText;
  /** Commission percentage applied to qualifying revenue. */
  commissionPercent: number;
  /** How many months the commission repeats. `null` means one payment only. */
  repeatsMonths: number | null;
}

/** Commission rates fixed by the program owner. */
export const AFFILIATE_COMMISSION_TIERS: readonly AffiliateCommissionTier[] = [
  {
    tier: 'BASIC',
    name: { vi: 'BASIC — Khởi đầu', en: 'BASIC — Starter' },
    priceUsd: 199,
    billing: { vi: 'thanh toán mỗi tháng', en: 'billed monthly' },
    commissionPercent: 30,
    repeatsMonths: 12,
  },
  {
    tier: 'PREMIUM',
    name: { vi: 'PREMIUM — Tăng trưởng', en: 'PREMIUM — Growth' },
    priceUsd: 399,
    billing: { vi: 'thanh toán mỗi tháng', en: 'billed monthly' },
    commissionPercent: 25,
    repeatsMonths: 12,
  },
  {
    tier: 'ENTERPRISE',
    name: { vi: 'ENTERPRISE — Nâng cao', en: 'ENTERPRISE — Premium' },
    priceUsd: 799,
    billing: { vi: 'thanh toán mỗi tháng', en: 'billed monthly' },
    commissionPercent: 20,
    repeatsMonths: 12,
  },
  {
    tier: 'MASTER',
    name: { vi: 'MASTER — Trọn đời', en: 'MASTER — Lifetime' },
    priceUsd: 4999,
    billing: { vi: 'thanh toán một lần', en: 'billed once' },
    commissionPercent: 10,
    repeatsMonths: null,
  },
] as const;

/** Payout and tracking rules partners ask about most. */
export const AFFILIATE_PAYOUT_RULES: readonly {
  label: BilingualText;
  value: BilingualText;
}[] = [
  {
    label: { vi: 'Cửa sổ ghi nhận', en: 'Attribution window' },
    value: { vi: '30 ngày kể từ lần nhấp chuột đầu tiên', en: '30 days from the first click' },
  },
  {
    label: { vi: 'Quy tắc ghi nhận', en: 'Attribution model' },
    value: { vi: 'Lần nhấp chuột cuối cùng (last-click)', en: 'Last click wins (last-click)' },
  },
  {
    label: { vi: 'Số tầng hoa hồng', en: 'Commission levels' },
    value: {
      vi: 'Chỉ một tầng — không hoa hồng nhiều cấp',
      en: 'One level only — no multi-level commission',
    },
  },
  {
    label: { vi: 'Thời điểm nhận tiền', en: 'Payout timing' },
    value: { vi: 'Thanh toán NET-30', en: 'Paid NET-30' },
  },
  {
    label: { vi: 'Mức tối thiểu để rút', en: 'Minimum payout' },
    value: { vi: '50 USD mỗi lần', en: '50 USD per payout' },
  },
  {
    label: { vi: 'Thời gian giữ tiền', en: 'Hold period' },
    value: {
      vi: '14 ngày để kiểm tra hoàn tiền và khiếu nại',
      en: '14 days to screen refunds and disputes',
    },
  },
] as const;
