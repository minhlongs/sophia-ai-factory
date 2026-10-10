export interface ResellerActionError {
  code: string;
  message: string;
}

export interface BindSubResellerActionInput {
  masterPartnerId: string;
  subPartnerId: string;
  agreementRef?: string | null;
}

export interface CreateLicensePoolActionInput {
  partnerId: string;
  poolName: string;
  seats: number;
  mcuCredits: number;
  unitPriceCents: number;
  autoTopupEnabled?: boolean;
  autoTopupThresholdMcu?: number;
  autoTopupAmountMcu?: number;
  periodStart?: number;
  periodEnd?: number;
  autoRenew?: boolean;
}

export interface AllocatePoolQuotaActionInput {
  poolId: string;
  subaccountId: string;
  seats: number;
  mcuCredits: number;
}

export interface RecordMcuConsumptionActionInput {
  poolId: string;
  subaccountId: string;
  mcuConsumed: number;
}
