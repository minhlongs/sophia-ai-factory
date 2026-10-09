/**
 * License Pool & MCU Quota Types
 *
 * Layer: tree (pure domain types & contracts)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/types/license-types
 */

export type LicensePoolStatus = 'active' | 'exhausted' | 'expired' | 'revoked';

/**
 * Database Entity: Partner License Pool
 */
export interface PartnerLicensePool {
  id: string;
  partner_id: string;
  pool_name: string;
  total_seats: number;
  allocated_seats: number;
  total_mcu_credits: number;
  allocated_mcu_credits: number;
  consumed_mcu_credits: number;
  unit_price_cents: number;
  auto_topup_enabled: number; // 0 or 1
  auto_topup_threshold_mcu: number;
  auto_topup_amount_mcu: number;
  period_start: number | null;
  period_end: number | null;
  auto_renew: number; // 0 or 1
  status: LicensePoolStatus;
  created_at: number;
  updated_at: number;
}

export interface CreateLicensePoolInput {
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

export interface CreateLicensePoolResult {
  success: boolean;
  pool?: PartnerLicensePool;
  error?: string;
}

export interface AllocateLicensePoolInput {
  poolId: string;
  subaccountId: string;
  seats: number;
  mcuCredits: number;
}

export type AllocatePoolInput = AllocateLicensePoolInput;

export interface AllocateLicensePoolResult {
  success: boolean;
  poolId: string;
  subaccountId: string;
  allocatedSeats: number;
  allocatedMcuCredits: number;
  remainingPoolSeats: number;
  remainingPoolMcu: number;
  error?: string;
}

export type AllocatePoolResult = AllocateLicensePoolResult;

export interface RecordMcuConsumptionInput {
  poolId: string;
  subaccountId: string;
  mcuConsumed: number;
}

export interface RecordMcuConsumptionResult {
  success: boolean;
  poolId: string;
  subaccountId: string;
  mcuConsumed: number;
  totalConsumedMcu: number;
  remainingAllocatedMcu: number;
  thresholdTriggered: boolean;
  autoTopupExecuted: boolean;
  error?: string;
}
