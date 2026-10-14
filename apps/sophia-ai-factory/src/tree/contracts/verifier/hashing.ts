import type {
  EnterpriseContract,
  ContractSignablePayload,
} from '@/seed/types/enterprise-contracts';
import { sha256Hex } from '@/seed/security/token-hash';
import { canonicalizeJson } from './canonicalize';

/**
 * Compute the 64-character lowercase hexadecimal SHA-256 hash of a signable contract payload.
 *
 * @param payload Canonical signable terms and commitments
 * @returns 64-char lowercase hex digest
 */
export async function computeContractHash(payload: ContractSignablePayload): Promise<string> {
  const canonicalString = canonicalizeJson(payload);
  return sha256Hex(canonicalString);
}

/**
 * Reconstruct canonical signable payload from an EnterpriseContract entity.
 */
export function extractSignablePayload(contract: EnterpriseContract): ContractSignablePayload {
  return {
    contractNumber: contract.contractNumber,
    orgId: contract.orgId,
    mcuCapacityMonthly: contract.mcuCapacityMonthly,
    slaUptimePercent: contract.slaUptimePercent,
    billingCycle: contract.billingCycle,
    unitPricePerMcuCents: contract.unitPricePerMcuCents,
    monthlyCommitmentCents: contract.monthlyCommitmentCents,
    annualCommitmentCents: contract.annualCommitmentCents,
    currency: contract.currency,
    effectiveDate: contract.effectiveDate,
    expirationDate: contract.expirationDate,
    termsVersion: contract.termsVersion,
  };
}
