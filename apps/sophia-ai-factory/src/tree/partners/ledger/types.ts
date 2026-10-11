import type {
  WithholdingJurisdiction,
  LedgerPayoutCurrency,
  TaxCertificateStatus,
} from '@/seed/types/cross-border-ledger';

/**
 * Input arguments for full cross-border payout calculation.
 */
export interface CalculateCrossBorderPayoutInput {
  grossCents: number;
  jurisdiction: WithholdingJurisdiction;
  targetCurrency: LedgerPayoutCurrency;
  baseFxRate?: number;
  hedgingBufferPct?: number;
  isIndividual?: boolean;
  certificateStatus?: TaxCertificateStatus;
  customTreatyRatePct?: number;
  taxIdNumber?: string | null;
}
