/**
 * Pure Seed Types for Cross-Border Affiliate Commission Ledger & Withholding Tax Engine
 *
 * Layer: seed (pure primitives, schemas, constants, zero side-effects, no upper-layer imports)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module seed/types/cross-border-ledger
 */

/**
 * Statutory Withholding Tax (WHT) Jurisdictions supported for cross-border partner settlements.
 */
export type WithholdingJurisdiction =
  | 'VN_FCT' // Vietnam Foreign Contractor Tax (Circular 103 10% corp / Circular 111 5% individual)
  | 'US_W8' // US IRS W-8BEN (30% statutory or 0-15% treaty-reduced)
  | 'EU_RC' // European Union B2B Reverse Charge (0% with valid VAT ID)
  | 'SG_NR' // Singapore Non-Resident Withholding Tax (15% service fee)
  | 'STANDARD_ZERO'; // Standard Domestic or Zero-Withholding jurisdiction

/**
 * Supported Settlement & Payout Currencies for Cross-Border Ledger.
 */
export const LEDGER_PAYOUT_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'SGD',
  'AUD',
  'CAD',
  'VND',
  'THB',
  'IDR',
] as const;

export type LedgerPayoutCurrency = (typeof LEDGER_PAYOUT_CURRENCIES)[number];

/**
 * Currencies that do not use fractional sub-units (cents/pence) in standard cash and banking settlements.
 * For VND and JPY, amounts are rounded to integers.
 */
export const ZERO_DECIMAL_CURRENCIES: readonly LedgerPayoutCurrency[] = [
  'VND',
  'JPY',
] as const;

/**
 * Predicate to check if a payout currency is zero-decimal.
 */
export function isZeroDecimalCurrency(currency: LedgerPayoutCurrency): boolean {
  return (ZERO_DECIMAL_CURRENCIES as readonly string[]).includes(currency);
}

/**
 * Default FX hedging volatility buffer reserve percentage (+1.5%).
 * Protects platform and partners against intraday foreign exchange slippage.
 */
export const DEFAULT_HEDGING_BUFFER_PCT = 1.5;

/**
 * Partner Tax Residency & Exemption Certificate Status.
 */
export type TaxCertificateStatus = 'verified' | 'pending' | 'exempt' | 'rejected';

/**
 * Cross-border ledger entry settlement lifecycle status.
 */
export type CrossBorderLedgerStatus =
  | 'accrued'
  | 'withheld'
  | 'remitted_to_tax_authority'
  | 'settled'
  | 'cancelled';

/**
 * Withholding Tax Calculation Result.
 */
export interface TaxCalculationResult {
  grossCents: number;
  jurisdiction: WithholdingJurisdiction;
  ratePct: number;
  withholdingCents: number;
  netCents: number;
  treatyApplied: boolean;
  certificateStatus: TaxCertificateStatus;
  complianceNote: string;
}

/**
 * Multi-Currency Cross-Border Payout Calculation.
 */
export interface CrossBorderPayoutCalculation {
  grossCents: number;
  withholdingCents: number;
  netCents: number;
  targetCurrency: LedgerPayoutCurrency;
  baseFxRate: number;
  hedgingBufferPct: number;
  effectiveFxRate: number;
  localPayoutAmount: number; // Integer (dong/yen) or minor unit (cents/pence)
  isZeroDecimalCurrency: boolean;
}

/**
 * Database Entity: Partner Cross-Border Ledger Record (D1 table `partner_cross_border_ledger`).
 */
export interface PartnerCrossBorderLedgerEntry {
  id: string;
  partner_id: string;
  order_id: string;
  payout_batch_id: string | null;
  gross_commission_cents: number;
  wht_jurisdiction: WithholdingJurisdiction;
  wht_rate_pct: number;
  wht_amount_cents: number;
  net_commission_cents: number;
  payout_currency: LedgerPayoutCurrency;
  applied_fx_rate: number;
  hedging_buffer_pct: number;
  net_payout_local_amount: number;
  tax_id_number: string | null;
  tax_certificate_status: TaxCertificateStatus;
  status: CrossBorderLedgerStatus;
  created_at: number;
  settled_at: number | null;
}

/**
 * Input for recording a cross-border commission.
 */
export interface RecordCrossBorderCommissionInput {
  partnerId: string;
  orderId: string;
  grossCents: number;
  whtJurisdiction: WithholdingJurisdiction;
  payoutCurrency: LedgerPayoutCurrency;
  baseFxRate?: number;
  hedgingBufferPct?: number;
  isIndividual?: boolean;
  taxIdNumber?: string | null;
  taxCertificateStatus?: TaxCertificateStatus;
  customTreatyRatePct?: number;
}

/**
 * Aggregated Cross-Border Financial Summary for a Partner.
 */
export interface CrossBorderPartnerSummary {
  partnerId: string;
  totalGrossCents: number;
  totalWithheldCents: number;
  totalNetCents: number;
  totalSettledLocalAmounts: Record<string, number>;
  accruedCount: number;
  settledCount: number;
}
