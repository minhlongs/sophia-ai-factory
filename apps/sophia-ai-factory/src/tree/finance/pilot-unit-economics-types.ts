/**
 * Pilot Unit-Economics Types & Input Validation
 * Layer: tree (Domain reusable)
 * @module tree/finance/pilot-unit-economics-types
 */

import { success, failure, type Result } from '@/seed/types/result';
import type { IpoAuditLedgerRecord, LedgerIntegrityResult } from './merkle';

export type PilotTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';

export interface PilotUnitEconomicsInput {
  pilotId: string;
  orgId: string;
  periodKey: string; // 'YYYY-MM'
  tier: PilotTier;
  collectedSubscriptionCents: number;
  paymentGatewayFeeCents: number;
  cloudflareEdgeCostCents: number;
  founderSupportMinutes: number;
  founderHourlyRateCents?: number;
}

export interface PilotUnitEconomicsSummary {
  pilotId: string;
  orgId: string;
  periodKey: string;
  tier: PilotTier;
  collectedSubscriptionCents: number;
  paymentGatewayFeeCents: number;
  cloudflareEdgeCostCents: number;
  founderSupportMinutes: number;
  founderHourlyRateCents: number;
  founderSupportCostCents: number;
  totalDirectCostCents: number;
  netContributionCents: number;
  unitMarginBasisPoints: number;
  unitMarginPercent: number;
}

export interface PilotCloseLedgerResult {
  summary: PilotUnitEconomicsSummary;
  auditRecord: IpoAuditLedgerRecord;
  integrity: LedgerIntegrityResult;
}

export type UnitEconomicsErrorCode =
  | 'INVALID_PERIOD_KEY'
  | 'INVALID_IDENTIFIER'
  | 'INVALID_CURRENCY_AMOUNT'
  | 'MERKLE_CHAIN_TAMPERED'
  | 'D1_LEDGER_ERROR';

const PERIOD_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DEFAULT_FOUNDER_HOURLY_RATE_CENTS = 5000; // $50.00/hour
const VALID_PILOT_TIERS: ReadonlySet<string> = new Set(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']);

export function validateUnitEconomicsInput(
  input: PilotUnitEconomicsInput,
  rate: number,
): Result<void, { code: UnitEconomicsErrorCode; message: string }> {
  if (!input || typeof input !== 'object') {
    return failure({ code: 'INVALID_IDENTIFIER', message: 'Input must be an object' });
  }
  if (!input.pilotId?.trim() || !input.orgId?.trim()) {
    return failure({ code: 'INVALID_IDENTIFIER', message: 'pilotId and orgId must be non-empty strings' });
  }
  if (!PERIOD_KEY_REGEX.test(input.periodKey)) {
    return failure({ code: 'INVALID_PERIOD_KEY', message: `Invalid periodKey: ${input.periodKey}` });
  }
  if (!VALID_PILOT_TIERS.has(input.tier)) {
    return failure({ code: 'INVALID_IDENTIFIER', message: `Invalid tier: ${String(input.tier)}` });
  }
  const amounts = [
    input.collectedSubscriptionCents,
    input.paymentGatewayFeeCents,
    input.cloudflareEdgeCostCents,
    rate,
  ];
  if (!amounts.every((v) => Number.isInteger(v) && v >= 0) || input.collectedSubscriptionCents === 0) {
    return failure({
      code: 'INVALID_CURRENCY_AMOUNT',
      message: 'All cent values must be non-negative integers; subscription must be > 0',
    });
  }
  if (
    typeof input.founderSupportMinutes !== 'number' ||
    input.founderSupportMinutes < 0 ||
    !Number.isFinite(input.founderSupportMinutes)
  ) {
    return failure({
      code: 'INVALID_CURRENCY_AMOUNT',
      message: 'founderSupportMinutes must be a non-negative finite number',
    });
  }
  return success(undefined);
}
