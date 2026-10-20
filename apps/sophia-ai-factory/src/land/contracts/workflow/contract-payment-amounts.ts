/**
 * Contract payment amounts — FX resolution for dual-rail checkout.
 *
 * PayOS invoices are issued in VND and include the invoice engine's 10% VAT;
 * NOWPayments remains billed in USD.
 *
 * @module land/contracts/workflow/contract-payment-amounts
 */

import type { EnterpriseContract } from '@/seed/types/enterprise/contracts';

export type ContractAmounts = {
  isAnnual: boolean;
  period: 'yearly' | 'monthly';
  amountCents: number;
  amountUsd: number;
  usdToVnd: number;
  netAmountVnd: number;
};

export function resolveContractAmounts(contract: EnterpriseContract): ContractAmounts {
  const isAnnual = contract.billingCycle === 'annual';
  const amountCents = isAnnual ? contract.annualCommitmentCents : contract.monthlyCommitmentCents;
  const amountUsd = amountCents / 100;
  const configuredFx = process.env.USD_TO_VND;
  const usdToVnd = configuredFx ? Number(configuredFx) : 25400;
  if (!Number.isFinite(usdToVnd) || usdToVnd <= 0) throw new Error('USD_TO_VND must be a positive finite number');
  const netAmountVnd = Math.round((amountUsd * usdToVnd) / 1000) * 1000;

  return { isAnnual, period: isAnnual ? 'yearly' : 'monthly', amountCents, amountUsd, usdToVnd, netAmountVnd };
}
