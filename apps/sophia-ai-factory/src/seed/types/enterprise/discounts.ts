export type VolumeDiscountBracketCode =
  | 'SCALE_50K'
  | 'SCALE_100K'
  | 'SCALE_250K'
  | 'SCALE_500K';

export interface VolumeDiscountBracket {
  code: VolumeDiscountBracketCode;
  minMcu: number;
  maxMcu: number;
  basePriceCents: number; // 5.0 cents ($0.050)
  discountPercent: number; // 0.20, 0.30, 0.45, 0.60
  effectivePricePerMcuCents: number; // 4.0, 3.5, 2.75, 2.0 cents
}

export const BASE_ENTERPRISE_MCU_PRICE_CENTS = 5.0; // $0.050 / MCU
export const ANNUAL_COMMITMENT_DISCOUNT_PERCENT = 0.17; // 17% savings for annual billing
export const MIN_ENTERPRISE_MCU = 50_000;
export const MAX_ENTERPRISE_MCU = 500_000;

export const VOLUME_DISCOUNT_BRACKETS: readonly VolumeDiscountBracket[] = [
  {
    code: 'SCALE_50K',
    minMcu: 50_000,
    maxMcu: 99_999,
    basePriceCents: 5.0,
    discountPercent: 0.20,
    effectivePricePerMcuCents: 4.0,
  },
  {
    code: 'SCALE_100K',
    minMcu: 100_000,
    maxMcu: 249_999,
    basePriceCents: 5.0,
    discountPercent: 0.30,
    effectivePricePerMcuCents: 3.5,
  },
  {
    code: 'SCALE_250K',
    minMcu: 250_000,
    maxMcu: 499_999,
    basePriceCents: 5.0,
    discountPercent: 0.45,
    effectivePricePerMcuCents: 2.75,
  },
  {
    code: 'SCALE_500K',
    minMcu: 500_000,
    maxMcu: Number.POSITIVE_INFINITY,
    basePriceCents: 5.0,
    discountPercent: 0.60,
    effectivePricePerMcuCents: 2.0,
  },
] as const;

export interface VolumeDiscountResult {
  mcuCapacityMonthly: number;
  billingCycle: 'monthly' | 'annual';
  bracket: VolumeDiscountBracket;
  unitPricePerMcuCents: number;
  monthlyCommitmentCents: number;
  annualCommitmentCents: number;
  annualSavingsCents: number;
  effectiveRateDisplayUsd: string;
  monthlyCommitmentUsd: number;
  annualCommitmentUsd: number;
}
