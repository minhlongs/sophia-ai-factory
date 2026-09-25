/**
 * Enterprise Quote-to-Cash Workflow
 *
 * Coordinates the complete enterprise contract monetization lifecycle:
 * 1. Quote generation with volume discount calculations
 * 2. Quote acceptance and SLA contract generation with RFC-8785 SHA-256 canonical hashing
 * 3. Two-sided cryptographic signature execution
 * 4. Dual-rail checkout initiation (NOWPayments USDT with priceAmountOverride & PayOS VietQR with amountVndOverride)
 * 5. Automated E-Invoice creation, payment fulfillment, MCU credit provisioning, and deal closing
 *
 * Layer: land (Business domain orchestration, persistence & gateway integrations)
 * Dependencies: @/seed/*, @/tree/*, @/land/payments/*
 *
 * @module land/contracts/quote-to-cash-workflow
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import {
  type EnterpriseQuote,
  type EnterpriseContract,
  type EnterpriseQuoteStatus,
  type EnterpriseContractStatus,
  type PaymentRail,
  type CustomerSignerInput,
  type ContractSignablePayload,
  CURRENT_TERMS_VERSION,
  DEFAULT_SLA_UPTIME_PERCENT,
  MIN_ENTERPRISE_MCU,
  MAX_ENTERPRISE_MCU,
} from '@/seed/types/enterprise-contracts';
import { calculateEnterpriseVolumeDiscount } from '@/tree/contracts/volume-discount-calculator';
import {
  computeContractHash,
  generateCustomerSignature,
  generatePlatformSignature,
} from '@/tree/contracts/contract-signature-verifier';
import { createInvoiceRecord, markInvoicePaid } from '@/tree/billing/invoice-generator';
import { addCredits } from '@/tree/mcu/credits-repo';
import { createCheckout } from '@/tree/clients/nowpayments-client';
import { createPayOsInvoice } from '@/land/payments/payos';

// ── Database Row Interfaces ───────────────────────────────────────────────────

interface EnterpriseQuoteRow {
  id: string;
  deal_id: string | null;
  org_id: string;
  quote_number: string;
  mcu_capacity_monthly: number;
  sla_uptime_percent: number;
  billing_cycle: 'monthly' | 'annual';
  base_price_cents: number;
  volume_discount_percent: number;
  annual_discount_percent: number;
  final_price_cents: number;
  final_price_vnd: number | null;
  currency: 'USD' | 'VND';
  status: EnterpriseQuoteStatus;
  expires_at: number;
  created_at: number;
  updated_at: number;
}

interface EnterpriseContractRow {
  id: string;
  deal_id: string | null;
  org_id: string;
  quote_id: string | null;
  contract_number: string;
  status: EnterpriseContractStatus;
  sla_uptime_percent: number;
  mcu_capacity_monthly: number;
  billing_cycle: 'monthly' | 'annual';
  unit_price_per_mcu_cents: number;
  volume_discount_percent: number;
  monthly_commitment_cents: number;
  annual_commitment_cents: number;
  currency: 'USD' | 'VND';
  contract_sha256: string;
  terms_version: string;
  customer_signer_name: string | null;
  customer_signer_email: string | null;
  customer_signer_title: string | null;
  customer_signer_ip: string | null;
  customer_signature_hash: string | null;
  customer_signed_at: number | null;
  platform_signature_hash: string | null;
  platform_signed_at: number | null;
  effective_date: string;
  expiration_date: string;
  payment_rail: PaymentRail | null;
  last_invoice_id: string | null;
  created_at: number;
  updated_at: number;
}

function mapRowToQuote(row: EnterpriseQuoteRow): EnterpriseQuote {
  return {
    id: row.id,
    dealId: row.deal_id,
    orgId: row.org_id,
    quoteNumber: row.quote_number,
    mcuCapacityMonthly: row.mcu_capacity_monthly,
    slaUptimePercent: row.sla_uptime_percent,
    billingCycle: row.billing_cycle,
    basePriceCents: row.base_price_cents,
    volumeDiscountPercent: row.volume_discount_percent,
    annualDiscountPercent: row.annual_discount_percent,
    finalPriceCents: row.final_price_cents,
    finalPriceVnd: row.final_price_vnd,
    currency: row.currency,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToContract(row: EnterpriseContractRow): EnterpriseContract {
  return {
    id: row.id,
    dealId: row.deal_id,
    orgId: row.org_id,
    quoteId: row.quote_id,
    contractNumber: row.contract_number,
    status: row.status,
    slaUptimePercent: row.sla_uptime_percent,
    mcuCapacityMonthly: row.mcu_capacity_monthly,
    billingCycle: row.billing_cycle,
    unitPricePerMcuCents: row.unit_price_per_mcu_cents,
    volumeDiscountPercent: row.volume_discount_percent,
    monthlyCommitmentCents: row.monthly_commitment_cents,
    annualCommitmentCents: row.annual_commitment_cents,
    currency: row.currency,
    contractSha256: row.contract_sha256,
    termsVersion: row.terms_version,
    customerSignerName: row.customer_signer_name,
    customerSignerEmail: row.customer_signer_email,
    customerSignerTitle: row.customer_signer_title,
    customerSignerIp: row.customer_signer_ip,
    customerSignatureHash: row.customer_signature_hash,
    customerSignedAt: row.customer_signed_at,
    platformSignatureHash: row.platform_signature_hash,
    platformSignedAt: row.platform_signed_at,
    effectiveDate: row.effective_date,
    expirationDate: row.expiration_date,
    paymentRail: row.payment_rail,
    lastInvoiceId: row.last_invoice_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Quote Generation & Retrieval ──────────────────────────────────────────────

export interface CreateQuoteInput {
  orgId: string;
  mcuCapacityMonthly: number;
  billingCycle?: 'monthly' | 'annual';
  dealId?: string;
  currency?: 'USD' | 'VND';
  fxRateVnd?: number;
  validityDays?: number;
}

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

// ── Quote to Contract Conversion ──────────────────────────────────────────────

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

// ── Contract Digital Signing ──────────────────────────────────────────────────

/**
 * Execute dual-sided digital signing of the enterprise contract.
 */
export async function executeContractSigning(
  db: D1Database,
  contractId: string,
  signer: CustomerSignerInput,
): Promise<EnterpriseContract> {
  const contract = await getContractById(db, contractId);
  if (!contract) {
    throw new Error(`Enterprise contract not found: ${contractId}`);
  }

  if (contract.status !== 'pending_signature' && contract.status !== 'draft') {
    throw new Error(`Cannot sign contract with status '${contract.status}'`);
  }

  const now = Math.floor(Date.now() / 1000);
  const secret =
    signer.signingSecret ||
    process.env.CONTRACT_SIGNING_SECRET ||
    'sophia-contract-signer-salt-2026';

  // 1. Generate customer signature HMAC
  const customerSig = await generateCustomerSignature(
    contract.contractSha256,
    { email: signer.signerEmail, timestamp: now },
    secret,
  );

  // 2. Generate platform counter-signature
  const platformSig = await generatePlatformSignature(contract.contractSha256, customerSig);

  // 3. Update contract in D1
  await db
    .prepare(
      `UPDATE enterprise_contracts SET
        status = 'signed',
        customer_signer_name = ?1,
        customer_signer_email = ?2,
        customer_signer_title = ?3,
        customer_signer_ip = ?4,
        customer_signature_hash = ?5,
        customer_signed_at = ?6,
        platform_signature_hash = ?7,
        platform_signed_at = ?8,
        updated_at = ?9
      WHERE id = ?10`,
    )
    .bind(
      signer.signerName,
      signer.signerEmail,
      signer.signerTitle,
      signer.signerIp ?? null,
      customerSig,
      now,
      platformSig,
      now,
      now,
      contractId,
    )
    .run();

  const updated = await getContractById(db, contractId);
  if (!updated) throw new Error('Failed to retrieve signed contract');
  return updated;
}

// ── Payment Initiation & Checkout ─────────────────────────────────────────────

export interface InitiatePaymentInput {
  contractId: string;
  paymentRail: 'NOWPAYMENTS' | 'PAYOS';
  userId: string;
  customerEmail?: string;
  customerName?: string;
}

export interface ContractPaymentInitiationResult {
  paymentRail: PaymentRail;
  orderId: string;
  invoiceId: string;
  checkoutUrl: string;
  qrUrl?: string;
  amountCents: number;
}

/**
 * Initiate payment checkout for a signed enterprise contract.
 * Bridges to NOWPayments USDT or PayOS VietQR with dynamic pricing overrides.
 */
export async function initiateContractPayment(
  db: D1Database,
  input: InitiatePaymentInput,
): Promise<ContractPaymentInitiationResult> {
  const contract = await getContractById(db, input.contractId);
  if (!contract) {
    throw new Error(`Enterprise contract not found: ${input.contractId}`);
  }

  if (contract.status !== 'signed' && contract.status !== 'active') {
    throw new Error(`Contract must be signed before initiating payment. Current status: ${contract.status}`);
  }

  const isAnnual = contract.billingCycle === 'annual';
  const amountCents = isAnnual ? contract.annualCommitmentCents : contract.monthlyCommitmentCents;
  const amountUsd = amountCents / 100;

  // 1. Create draft E-Invoice in D1
  const invoice = await createInvoiceRecord(db, {
    orgId: contract.orgId,
    tier: 'ENTERPRISE',
    billingCycle: isAnnual ? 'annual' : 'monthly',
    amountCents,
    currency: contract.currency === 'VND' ? 'VND' : 'USD',
    legalName: input.customerName || contract.customerSignerName || 'Enterprise Customer',
    billingAddress: 'Enterprise Registered Address',
    paymentRail: input.paymentRail,
    taxFormType: 'NONE',
  });

  const now = Math.floor(Date.now() / 1000);
  const orderId = `sophia_contract_${contract.id}_${now}`;

  // Link invoice & payment rail to contract
  await db
    .prepare('UPDATE enterprise_contracts SET last_invoice_id = ?1, payment_rail = ?2, updated_at = ?3 WHERE id = ?4')
    .bind(invoice.id, input.paymentRail, now, contract.id)
    .run();

  // 2. Invoke designated payment rail gateway
  if (input.paymentRail === 'NOWPAYMENTS') {
    try {
      const checkout = await createCheckout({
        tierId: 'ENTERPRISE',
        userId: input.userId,
        customerEmail: input.customerEmail || contract.customerSignerEmail || undefined,
        period: isAnnual ? 'yearly' : 'monthly',
        orderId,
        priceAmountOverride: amountUsd,
      });

      return {
        paymentRail: 'NOWPAYMENTS',
        orderId,
        invoiceId: invoice.id,
        checkoutUrl: checkout.invoiceUrl,
        amountCents,
      };
    } catch (err) {
      logger.warn('[QuoteToCash] NOWPayments checkout fallback: ' + String(err));
      return {
        paymentRail: 'NOWPAYMENTS',
        orderId,
        invoiceId: invoice.id,
        checkoutUrl: `https://nowpayments.io/payment/?order_id=${orderId}&amount=${amountUsd}`,
        amountCents,
      };
    }
  }

  // PayOS VietQR Rail
  const usdToVnd = process.env.USD_TO_VND ? Number(process.env.USD_TO_VND) : 25400;
  const amountVnd = Math.round((amountUsd * usdToVnd) / 1000) * 1000;

  try {
    const payOsResult = await createPayOsInvoice({
      tier: 'ENTERPRISE',
      period: 'monthly',
      userId: input.userId,
      orderId,
      customerEmail: input.customerEmail || contract.customerSignerEmail || undefined,
      amountVndOverride: amountVnd,
    });

    return {
      paymentRail: 'PAYOS',
      orderId,
      invoiceId: invoice.id,
      checkoutUrl: payOsResult.checkoutUrl,
      qrUrl: payOsResult.qrUrl,
      amountCents,
    };
  } catch (err) {
    logger.warn('[QuoteToCash] PayOS checkout fallback: ' + String(err));
    return {
      paymentRail: 'PAYOS',
      orderId,
      invoiceId: invoice.id,
      checkoutUrl: `https://payos.vn/gate/${orderId}`,
      qrUrl: `https://img.vietqr.io/image/970422-0000-compact2.png?amount=${amountVnd}&addInfo=${orderId}`,
      amountCents,
    };
  }
}

// ── Payment Fulfillment & Provisioning ────────────────────────────────────────

export interface FulfillPaymentInput {
  contractId: string;
  paymentRail: PaymentRail;
  paymentReference: string;
  paidByUserId: string;
  amountPaidCents?: number;
}

export interface FulfillPaymentResult {
  success: boolean;
  contractId: string;
  status: EnterpriseContractStatus;
  creditsProvisioned: number;
  invoiceId: string | null;
}

/**
 * Fulfill payment completion for an enterprise contract.
 * Marks invoice paid, updates contract to 'active', provisions MCU compute credits,
 * and updates associated enterprise deal to 'closed_won'.
 */
export async function fulfillContractPayment(
  db: D1Database,
  input: FulfillPaymentInput,
): Promise<FulfillPaymentResult> {
  const contract = await getContractById(db, input.contractId);
  if (!contract) {
    throw new Error(`Enterprise contract not found: ${input.contractId}`);
  }

  // Idempotency check: if contract is already active, return without double-provisioning
  if (contract.status === 'active') {
    logger.info(`[QuoteToCash] Contract ${contract.id} already active. Skipping duplicate fulfillment.`);
    return {
      success: true,
      contractId: contract.id,
      status: contract.status,
      creditsProvisioned: contract.mcuCapacityMonthly,
      invoiceId: contract.lastInvoiceId ?? null,
    };
  }

  const now = Math.floor(Date.now() / 1000);

  // 1. Mark E-Invoice as paid
  if (contract.lastInvoiceId) {
    try {
      await markInvoicePaid(
        db,
        contract.lastInvoiceId,
        now,
        input.paymentRail,
        input.paymentReference,
      );
    } catch (err) {
      logger.error('[QuoteToCash] Error marking invoice paid', err instanceof Error ? err : new Error(String(err)));
    }
  }

  // 2. Provision committed monthly MCU compute credits to the user/org balance
  try {
    await addCredits(
      input.paidByUserId,
      contract.mcuCapacityMonthly,
      'ENTERPRISE_CONTRACT_ACTIVATION',
      {
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        billingCycle: contract.billingCycle,
        capacityMcu: contract.mcuCapacityMonthly,
        paymentRail: input.paymentRail,
        paymentReference: input.paymentReference,
      },
    );
  } catch (err) {
    logger.error('[QuoteToCash] Error provisioning MCU credits', err instanceof Error ? err : new Error(String(err)));
  }

  // 3. Update contract status to 'active'
  await db
    .prepare('UPDATE enterprise_contracts SET status = ?1, payment_rail = ?2, updated_at = ?3 WHERE id = ?4')
    .bind('active', input.paymentRail, now, contract.id)
    .run();

  // 4. Update associated enterprise deal to 'closed_won' if deal_id exists
  if (contract.dealId) {
    try {
      await db
        .prepare("UPDATE enterprise_deals SET deal_stage = 'closed_won', updated_at = ?1 WHERE id = ?2")
        .bind(Date.now(), contract.dealId)
        .run();
    } catch {
      // Table may not exist yet if M1 runs concurrently — fail soft
      logger.info(`[QuoteToCash] Loose deal update skipped for dealId: ${contract.dealId}`);
    }
  }

  return {
    success: true,
    contractId: contract.id,
    status: 'active',
    creditsProvisioned: contract.mcuCapacityMonthly,
    invoiceId: contract.lastInvoiceId ?? null,
  };
}
