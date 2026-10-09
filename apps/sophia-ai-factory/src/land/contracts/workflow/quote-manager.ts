/**
 * Enterprise Quote Manager
 *
 * Implements enterprise quote calculation, persistence, and lookup.
 *
 * Layer: land (Business domain workflow)
 *
 * @module land/contracts/workflow/quote-manager
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type EnterpriseQuote,
  DEFAULT_SLA_UPTIME_PERCENT,
  MIN_ENTERPRISE_MCU,
  MAX_ENTERPRISE_MCU,
} from '@/seed/types/enterprise-contracts';
import { calculateEnterpriseVolumeDiscount } from '@/tree/contracts/volume-discount-calculator';
import {
  type EnterpriseQuoteRow,
  type CreateQuoteInput,
  mapRowToQuote,
} from './types';

/**
 * Generate and persist an Enterprise Volume Quote.
 */
export async function createEnterpriseQuote(
  db: D1Database,
  input: CreateQuoteInput,
): Promise<EnterpriseQuote> {
  const mcu = Math.max(MIN_ENTERPRISE_MCU, Math.min(MAX_ENTERPRISE_MCU, input.mcuCapacityMonthly));
  const billingCycle = input.billingCycle ?? 'monthly';
  const currency = input.currency ?? 'USD';
  const fxRate = input.fxRateVnd ?? (process.env.USD_TO_VND ? Number(process.env.USD_TO_VND) : 25400);
  const validityDays = input.validityDays ?? 14;

  const discount = calculateEnterpriseVolumeDiscount(mcu, billingCycle);

  const basePriceCents = mcu * 5; // $0.050 base in cents
  const volumeDiscountPercent = discount.bracket.discountPercent;
  const annualDiscountPercent = billingCycle === 'annual' ? 0.17 : 0.0;
  const finalPriceCents = billingCycle === 'annual' ? discount.annualCommitmentCents : discount.monthlyCommitmentCents;

  const finalPriceVnd = Math.round((finalPriceCents / 100) * fxRate);

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + validityDays * 86400;
  const id = `eq_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const quoteNumber = `Q-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

  await db
    .prepare(
      `INSERT INTO enterprise_quotes (
        id, deal_id, org_id, quote_number, mcu_capacity_monthly,
        sla_uptime_percent, billing_cycle, base_price_cents,
        volume_discount_percent, annual_discount_percent, final_price_cents,
        final_price_vnd, currency, status, expires_at, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)`,
    )
    .bind(
      id,
      input.dealId ?? null,
      input.orgId,
      quoteNumber,
      mcu,
      DEFAULT_SLA_UPTIME_PERCENT,
      billingCycle,
      basePriceCents,
      volumeDiscountPercent,
      annualDiscountPercent,
      finalPriceCents,
      finalPriceVnd,
      currency,
      'draft',
      expiresAt,
      now,
      now,
    )
    .run();

  const quote = await getQuoteById(db, id);
  if (!quote) throw new Error('Failed to retrieve newly created enterprise quote');
  return quote;
}

export async function getQuoteById(db: D1Database, id: string): Promise<EnterpriseQuote | null> {
  const row = await db
    .prepare('SELECT * FROM enterprise_quotes WHERE id = ?1 LIMIT 1')
    .bind(id)
    .first<EnterpriseQuoteRow>();

  return row ? mapRowToQuote(row) : null;
}
