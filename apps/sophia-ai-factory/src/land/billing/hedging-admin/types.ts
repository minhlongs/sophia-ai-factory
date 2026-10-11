export interface HedgingAdminError {
  code: string;
  message: string;
}

export interface FxReservesSummary {
  totalEscrowedCents: number;
  totalRealizedPnlCents: number;
  escrowedCount: number;
  realizedGainCount: number;
  absorbedLossCount: number;
  rebalancedCount: number;
  totalCount: number;
}
