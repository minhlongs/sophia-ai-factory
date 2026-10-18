/**
 * Cross-Border Commission Ledger Database Entities & Summary Contracts
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 *
 * @module seed/types/cross-border-ledger-records
 */

import type {
  CrossBorderLedgerStatus,
  LedgerPayoutCurrency,
  TaxCertificateStatus,
  WithholdingJurisdiction,
} from './cross-border-ledger';

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
