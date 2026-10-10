export interface PayoutPayload {
  address: string;
  currency: string;
  amountUsdt: number;
  ipn_callback_url: string;
  extraId?: string;
}

export interface WithdrawalResponse {
  id: string;
  status: string;
}

export interface BatchQueueInput {
  batchId: string;
  affiliateId: string;
  /** Payout amount in INTEGER cents */
  totalCents: number;
  recipientAddrEncrypted: string;
  network: string;
}

export interface MassPayoutItem {
  partnerId: string;
  partnerCode?: string;
  totalCents: number;
  recipientAddrEncrypted: string;
  network?: string;
}

export interface MultiPayoutBatchInput {
  batchId: string;
  tenantId?: string;
  items: MassPayoutItem[];
}

export interface MultiPayoutBatchResult {
  batchId: string;
  totalCount: number;
  successCount: number;
  failureCount: number;
  externalPaymentIds: Record<string, string>;
  failures: Array<{ partnerId: string; error: string }>;
}

export interface BankReconciliationRecord {
  batchId: string;
  affiliateId: string;
  partnerCode: string;
  payoutMethod: string;
  recipientAddressOrAccount: string;
  amountCents: number;
  status: string;
  createdAt?: string | number;
  vndRate?: number;
}
