/**
 * Enterprise Contract Converter & Store
 *
 * Implements conversion of accepted quotes to cryptographically hashed contracts and contract retrieval.
 *
 * Layer: land (Business domain workflow)
 *
 * @module land/contracts/workflow/contract-converter
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type EnterpriseContract,
  CURRENT_TERMS_VERSION,
  type ContractSignablePayload,
} from '@/seed/types/enterprise-contracts';
import { calculateEnterpriseVolumeDiscount } from '@/tree/contracts/volume-discount-calculator';
import { computeContractHash } from '@/tree/contracts/contract-signature-verifier';
import { getQuoteById } from './quote-manager';
import { type EnterpriseContractRow, mapRowToContract } from './types';

/**
 * Convert an accepted Enterprise Quote into a cryptographically anchored SLA Contract.
 */
export async function convertQuoteToContract(
  db: D1Database,
  quoteId: string,
): Promise<EnterpriseContract> {
  const quote = await getQuoteById(db, quoteId);
  if (!quote) {
    throw new Error(`Enterprise quote not found: ${quoteId}`);
  }

  if (quote.status === 'declined' || quote.status === 'expired') {
    throw new Error(`Cannot convert quote with status '${quote.status}' to a contract`);
  }

  const now = Math.floor(Date.now() / 1000);
  const effectiveDate = new Date().toISOString().slice(0, 10);
  const expirationDate = new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 10);

  const discount = calculateEnterpriseVolumeDiscount(quote.mcuCapacityMonthly, quote.billingCycle);
  const contractId = `ec_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const contractNumber = `CNT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

  const payload: ContractSignablePayload = {
    contractNumber,
    orgId: quote.orgId,
    mcuCapacityMonthly: quote.mcuCapacityMonthly,
    slaUptimePercent: quote.slaUptimePercent,
    billingCycle: quote.billingCycle,
    unitPricePerMcuCents: discount.unitPricePerMcuCents,
    monthlyCommitmentCents: discount.monthlyCommitmentCents,
    annualCommitmentCents: discount.annualCommitmentCents,
    currency: quote.currency,
    effectiveDate,
    expirationDate,
    termsVersion: CURRENT_TERMS_VERSION,
  };

  const contractSha256 = await computeContractHash(payload);

  // Transition quote to accepted
  await db
    .prepare('UPDATE enterprise_quotes SET status = ?1, updated_at = ?2 WHERE id = ?3')
    .bind('accepted', now, quoteId)
    .run();

  // Create contract row
  await db
    .prepare(
      `INSERT INTO enterprise_contracts (
        id, deal_id, org_id, quote_id, contract_number, status,
        sla_uptime_percent, mcu_capacity_monthly, billing_cycle,
        unit_price_per_mcu_cents, volume_discount_percent,
        monthly_commitment_cents, annual_commitment_cents, currency,
        contract_sha256, terms_version, effective_date, expiration_date,
        created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)`,
    )
    .bind(
      contractId,
      quote.dealId ?? null,
      quote.orgId,
      quote.id,
      contractNumber,
      'pending_signature',
      quote.slaUptimePercent,
      quote.mcuCapacityMonthly,
      quote.billingCycle,
      discount.unitPricePerMcuCents,
      discount.bracket.discountPercent,
      discount.monthlyCommitmentCents,
      discount.annualCommitmentCents,
      quote.currency,
      contractSha256,
      CURRENT_TERMS_VERSION,
      effectiveDate,
      expirationDate,
      now,
      now,
    )
    .run();

  const contract = await getContractById(db, contractId);
  if (!contract) throw new Error('Failed to retrieve newly generated enterprise contract');
  return contract;
}

export async function getContractById(
  db: D1Database,
  id: string,
): Promise<EnterpriseContract | null> {
  const row = await db
    .prepare('SELECT * FROM enterprise_contracts WHERE id = ?1 LIMIT 1')
    .bind(id)
    .first<EnterpriseContractRow>();

  return row ? mapRowToContract(row) : null;
}
