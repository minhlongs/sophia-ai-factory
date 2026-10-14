import type {
  WithholdingJurisdiction,
  LedgerPayoutCurrency,
  TaxCertificateStatus,
} from '@/seed/types/cross-border-ledger';

export interface CrossBorderActionError {
  code: string;
  message: string;
}

export interface PreviewCrossBorderPayoutInput {
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

export interface RecordCrossBorderCommissionActionInput {
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

export interface SettleCrossBorderPayoutActionInput {
  ledgerId: string;
  batchId: string;
}
