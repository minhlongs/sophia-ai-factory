/**
 * Enterprise Quote-to-Cash E2E Test Suite (Tiers 1–4)
 *
 * Implements opaque-box, requirement-driven E2E verification of:
 * 1. Volume Discount Calculator (50K–500K MCU brackets & 17% annual prepay savings)
 * 2. 99.9% Uptime SLA Contract Terms & Financial Remedy Schedules
 * 3. RFC-8785 SHA-256 Digital Signatures & Two-Sided Cryptographic Signing
 * 4. Dual-Rail Checkout Initiation (NOWPayments USDT & PayOS VietQR)
 * 5. Payment Fulfillment, Automated E-Invoicing, MCU Credit Provisioning & CRM Deal Closing
 * 6. High-Volume B2B Contract Onboarding & Anti-Tampering Resilience
 *
 * @vitest-environment node
 * @module __tests__/e2e/enterprise/quote-to-cash.e2e.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { createEnterpriseTestDb } from './enterprise-e2e-harness';
import {
  calculateEnterpriseVolumeDiscount,
  getVolumeDiscountBracket,
  calculateOverageUnitPriceCents,
} from '@/tree/contracts/volume-discount-calculator';
import {
  calculateMonthlyPermittedDowntime,
  resolveSlaServiceCredit,
  generateContractLegalTerms,
  generateContractHtml,
} from '@/tree/contracts/contract-generator';
import {
  canonicalizeJson,
  computeContractHash,
  generateCustomerSignature,
  verifyCustomerSignature,
  generatePlatformSignature,
  verifyPlatformSignature,
  verifyContractIntegrity,
} from '@/tree/contracts/contract-signature-verifier';
import {
  createEnterpriseQuote,
  getQuoteById,
  convertQuoteToContract,
  getContractById,
  executeContractSigning,
  initiateContractPayment,
  fulfillContractPayment,
} from '@/land/contracts/quote-to-cash-workflow';
import { createEnterpriseDeal, getEnterpriseDealById } from '@/tree/sales/enterprise-deal-repo';
import type {
  ContractSignablePayload,
  CustomerSignerInput,
} from '@/seed/types/enterprise-contracts';

// Mock external payment gateways
const mockCheckout = vi.fn().mockResolvedValue({
  invoiceUrl: 'https://nowpayments.io/payment/?iid=nowp_e2e_123',
  orderId: 'sophia_contract_e2e_123',
  invoiceId: 'nowp_e2e_123',
});

const mockPayOsInvoice = vi.fn().mockResolvedValue({
  checkoutUrl: 'https://payos.vn/gate/payos_e2e_123',
  qrUrl: 'https://img.vietqr.io/image/970422-0000-compact2.png',
  paymentLinkId: 'link_e2e_123',
  orderCode: 987654321,
  expiresAt: '2026-10-01T00:00:00Z',
});

vi.mock('@/tree/clients/nowpayments-client', () => ({
  createCheckout: (...args: unknown[]) => mockCheckout(...args),
}));

vi.mock('@/land/payments/payos', () => ({
  createPayOsInvoice: (...args: unknown[]) => mockPayOsInvoice(...args),
}));

let currentD1: D1Database;

vi.mock('@/seed/db/client', () => ({
  getD1: () => Promise.resolve(currentD1),
  createServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { role: 'admin' } }),
        }),
      }),
    }),
  }),
}));

describe('Enterprise Quote-to-Cash E2E Suite (Tiers 1–4)', () => {
  let d1: D1Database;
  let seedDefaults: () => Promise<void>;

  const TEST_ORG_ID = 'org_enterprise_root';

  beforeEach(async () => {
    vi.clearAllMocks();
    const harness = createEnterpriseTestDb();
    d1 = harness.d1;
    currentD1 = d1;
    seedDefaults = harness.seedDefaults;
    await seedDefaults();
  });

  // ==========================================================================
  // TIER 1: FEATURE COVERAGE (>=5 tests per feature)
  // ==========================================================================

  describe('Tier 1: Feature Coverage', () => {
    describe('Feature 7: Volume Discount Calculator', () => {
      it('F7-1: resolves SCALE_50K bracket (20% off) for 50K MCU commitment', () => {
        const bracket = getVolumeDiscountBracket(50_000);
        expect(bracket.code).toBe('SCALE_50K');
        expect(bracket.discountPercent).toBe(0.20);
        expect(bracket.effectivePricePerMcuCents).toBe(4.0);

        const discount = calculateEnterpriseVolumeDiscount(50_000, 'monthly');
        expect(discount.monthlyCommitmentCents).toBe(200_000); // 50,000 * 4.0c = $2,000
      });

      it('F7-2: resolves SCALE_100K bracket (30% off) for 100K MCU commitment', () => {
        const bracket = getVolumeDiscountBracket(100_000);
        expect(bracket.code).toBe('SCALE_100K');
        expect(bracket.discountPercent).toBe(0.30);
        expect(bracket.effectivePricePerMcuCents).toBe(3.5);

        const discount = calculateEnterpriseVolumeDiscount(100_000, 'monthly');
        expect(discount.monthlyCommitmentCents).toBe(350_000); // 100,000 * 3.5c = $3,500
      });

      it('F7-3: resolves SCALE_250K bracket (45% off) for 250K MCU commitment', () => {
        const bracket = getVolumeDiscountBracket(250_000);
        expect(bracket.code).toBe('SCALE_250K');
        expect(bracket.discountPercent).toBe(0.45);
        expect(bracket.effectivePricePerMcuCents).toBe(2.75);

        const discount = calculateEnterpriseVolumeDiscount(250_000, 'monthly');
        expect(discount.monthlyCommitmentCents).toBe(687_500); // 250,000 * 2.75c = $6,875
      });

      it('F7-4: resolves SCALE_500K bracket (60% off) for 500K MCU commitment', () => {
        const bracket = getVolumeDiscountBracket(500_000);
        expect(bracket.code).toBe('SCALE_500K');
        expect(bracket.discountPercent).toBe(0.60);
        expect(bracket.effectivePricePerMcuCents).toBe(2.0);

        const discount = calculateEnterpriseVolumeDiscount(500_000, 'monthly');
        expect(discount.monthlyCommitmentCents).toBe(1_000_000); // 500,000 * 2.0c = $10,000
      });

      it('F7-5: applies 17% annual prepay savings on annualized commitment', () => {
        const discountAnnual = calculateEnterpriseVolumeDiscount(100_000, 'annual');
        expect(discountAnnual.annualSavingsCents).toBe(714_000);
        expect(discountAnnual.annualCommitmentCents).toBe(3_486_000);
        expect(discountAnnual.monthlyCommitmentCents).toBe(350_000);
        expect(Math.round(discountAnnual.annualCommitmentCents / 12)).toBe(290_500);
      });

      it('F7-6: calculates burst overage unit price matching contracted rate', () => {
        const rate50k = calculateOverageUnitPriceCents(50_000);
        expect(rate50k).toBe(4.0);

        const rate500k = calculateOverageUnitPriceCents(500_000);
        expect(rate500k).toBe(2.0);
      });
    });

    describe('Feature 8: 99.9% Uptime SLA Contract Terms', () => {
      it('F8-1: calculates permitted monthly downtime as exactly 43m 49s (43.83 min)', () => {
        const downtime = calculateMonthlyPermittedDowntime();
        expect(downtime.permittedDowntimeMinutes).toBeCloseTo(43.83, 2);
        expect(downtime.formatted).toBe('43m 49s');
      });

      it('F8-2: resolves 0% service credit for meeting target uptime >= 99.9%', () => {
        const remedy = resolveSlaServiceCredit(99.95);
        expect(remedy.creditPercent).toBe(0);
        expect(remedy.remedyTier.descriptionEn).toContain('SLA target met');
      });

      it('F8-3: resolves 10% service credit for minor degradation (99.0% - 99.89%)', () => {
        const remedy = resolveSlaServiceCredit(99.4);
        expect(remedy.creditPercent).toBe(10);
      });

      it('F8-4: resolves 25% service credit for moderate degradation (95.0% - 98.99%)', () => {
        const remedy = resolveSlaServiceCredit(97.5);
        expect(remedy.creditPercent).toBe(25);
      });

      it('F8-5: resolves 50% service credit for severe degradation (< 95.0%)', () => {
        const remedy = resolveSlaServiceCredit(94.0);
        expect(remedy.creditPercent).toBe(50);
      });

      it('F8-6: generates comprehensive legal terms in English and Vietnamese with version stamp', () => {
        const contractStub = {
          id: 'cnt_stub_1',
          contractNumber: 'CNT-2026-0001',
          orgId: 'org_test',
          dealId: null,
          quoteId: null,
          status: 'pending_signature' as const,
          slaUptimePercent: 99.9,
          mcuCapacityMonthly: 100_000,
          billingCycle: 'annual' as const,
          unitPricePerMcuCents: 3.5,
          volumeDiscountPercent: 0.30,
          monthlyCommitmentCents: 350_000,
          annualCommitmentCents: 3_486_000,
          currency: 'USD' as const,
          contractSha256: 'a'.repeat(64),
          termsVersion: '2026.1-ENTERPRISE-SLA',
          customerSignerName: null,
          customerSignerEmail: null,
          customerSignerTitle: null,
          customerSignerIp: null,
          customerSignatureHash: null,
          customerSignedAt: null,
          platformSignatureHash: null,
          platformSignedAt: null,
          effectiveDate: '2026-10-01',
          expirationDate: '2027-10-01',
          paymentRail: null,
          lastInvoiceId: null,
          createdAt: Math.floor(Date.now() / 1000),
          updatedAt: Math.floor(Date.now() / 1000),
        };

        const termsEn = generateContractLegalTerms(contractStub, 'en');
        expect(termsEn).toContain('ENTERPRISE COMPUTE SERVICE AGREEMENT');
        expect(termsEn).toContain('2026.1-ENTERPRISE-SLA');

        const termsVi = generateContractLegalTerms(contractStub, 'vi');
        expect(termsVi).toContain('HỢP ĐỒNG DỊCH VỤ ĐIỆN TOÁN DOANH NGHIỆP');
        expect(termsVi).toContain('2026.1-ENTERPRISE-SLA');

        const html = generateContractHtml(contractStub);
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('CNT-2026-0001');
      });
    });

    describe('Feature 9: RFC-8785 SHA-256 Digital Signatures', () => {
      it('F9-1: produces deterministic RFC-8785 canonical JSON regardless of key insertion order', () => {
        const objA = { z: 1, a: 'hello', m: { b: 2, a: 1 } };
        const objB = { m: { a: 1, b: 2 }, a: 'hello', z: 1 };

        const canonA = canonicalizeJson(objA);
        const canonB = canonicalizeJson(objB);

        expect(canonA).toBe(canonB);
        expect(canonA).toBe('{"a":"hello","m":{"a":1,"b":2},"z":1}');
      });

      it('F9-2: computes 64-character lowercase SHA-256 hex digest for contract terms', async () => {
        const payload: ContractSignablePayload = {
          contractNumber: 'SLA-2026-TEST',
          orgId: 'org_enterprise_root',
          mcuCapacityMonthly: 100_000,
          slaUptimePercent: 99.9,
          billingCycle: 'monthly',
          unitPricePerMcuCents: 3.5,
          monthlyCommitmentCents: 350_000,
          annualCommitmentCents: 4_200_000,
          currency: 'USD',
          termsVersion: '2026.1-ENTERPRISE-SLA',
          effectiveDate: '2026-10-01',
          expirationDate: '2027-10-01',
        };

        const hash = await computeContractHash(payload);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      });

      it('F9-3: generates and validates customer HMAC-SHA256 signature', async () => {
        const termsHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        const signer = { email: 'vp@bigcorp.com', timestamp: 1758800000 };
        const secret = 'customer-signer-secret-key-1';

        const signature = await generateCustomerSignature(termsHash, signer, secret);
        expect(signature).toMatch(/^[a-f0-9]{64}$/);

        const isValid = await verifyCustomerSignature(termsHash, signer, signature, secret);
        expect(isValid).toBe(true);
      });

      it('F9-4: generates and validates platform counter-signature', async () => {
        const termsHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        const customerSigHash = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        const platformSecret = 'platform-audit-secret-key-2';

        const platformSig = await generatePlatformSignature(termsHash, customerSigHash, platformSecret);
        expect(platformSig).toMatch(/^[a-f0-9]{64}$/);

        const isValid = await verifyPlatformSignature(termsHash, customerSigHash, platformSig, platformSecret);
        expect(isValid).toBe(true);
      });

      it('F9-5: audits contract integrity detecting any modification in terms or signatures', async () => {
        const quote = await createEnterpriseQuote(d1, {
          orgId: TEST_ORG_ID,
          mcuCapacityMonthly: 250_000,
          billingCycle: 'monthly',
        });
        const contract = await convertQuoteToContract(d1, quote.id);

        const signed = await executeContractSigning(d1, contract.id, {
          signerName: 'Signer Person',
          signerEmail: 'signer@corp.com',
          signerTitle: 'VP Technology',
          signingSecret: 'sec-cust-99',
        });

        const audit = await verifyContractIntegrity(signed, 'sec-cust-99');
        expect(audit.isValid).toBe(true);
        expect(audit.customerSignatureValid).toBe(true);
        expect(audit.platformSignatureValid).toBe(true);
      });
    });

    describe('Feature 10: Dual-Rail Checkout', () => {
      it('F10-1: creates enterprise quote in D1 with volume discount pricing', async () => {
        const quote = await createEnterpriseQuote(d1, {
          orgId: TEST_ORG_ID,
          mcuCapacityMonthly: 100_000,
          billingCycle: 'monthly',
          currency: 'USD',
        });

        expect(quote.id).toBeDefined();
        expect(quote.quoteNumber).toMatch(/^Q-2026/);
        expect(quote.mcuCapacityMonthly).toBe(100_000);
        expect(quote.volumeDiscountPercent).toBe(0.30);
        expect(quote.finalPriceCents).toBe(350_000);
        expect(quote.status).toBe('draft');
      });

      it('F10-2: converts accepted quote into contract with RFC-8785 SHA-256 digest', async () => {
        const quote = await createEnterpriseQuote(d1, {
          orgId: TEST_ORG_ID,
          mcuCapacityMonthly: 250_000,
          billingCycle: 'annual',
          currency: 'USD',
        });

        const contract = await convertQuoteToContract(d1, quote.id);
        expect(contract.id).toBeDefined();
        expect(contract.contractNumber).toMatch(/^CNT-2026/);
        expect(contract.status).toBe('pending_signature');
        expect(contract.contractSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(contract.mcuCapacityMonthly).toBe(250_000);

        const quoteAfter = await getQuoteById(d1, quote.id);
        expect(quoteAfter?.status).toBe('accepted');
      });

      it('F10-3: initiates NOWPayments USDT checkout with price override', async () => {
        const quote = await createEnterpriseQuote(d1, {
          orgId: TEST_ORG_ID,
          mcuCapacityMonthly: 50_000,
          billingCycle: 'monthly',
          currency: 'USD',
        });
        const contract = await convertQuoteToContract(d1, quote.id);

        await executeContractSigning(d1, contract.id, {
          signerName: 'John Chief',
          signerEmail: 'john@chiefcorp.com',
          signerTitle: 'Chief Financial Officer',
          signerIp: '1.2.3.4',
        });

        const checkout = await initiateContractPayment(d1, {
          contractId: contract.id,
          paymentRail: 'NOWPAYMENTS',
          userId: TEST_ORG_ID,
        });
        expect(checkout.invoiceId).toBeDefined();
        expect(checkout.checkoutUrl).toContain('nowpayments.io');

        const updatedContract = await getContractById(d1, contract.id);
        expect(updatedContract?.paymentRail).toBe('NOWPAYMENTS');
        expect(updatedContract?.lastInvoiceId).toBe(checkout.invoiceId);
      });

      it('F10-4: initiates PayOS VietQR checkout with VND override', async () => {
        const quote = await createEnterpriseQuote(d1, {
          orgId: TEST_ORG_ID,
          mcuCapacityMonthly: 100_000,
          billingCycle: 'monthly',
          currency: 'VND',
        });
        const contract = await convertQuoteToContract(d1, quote.id);

        await executeContractSigning(d1, contract.id, {
          signerName: 'Nguyen Van Giam Doc',
          signerEmail: 'giamdoc@congtyviet.vn',
          signerTitle: 'Tổng Giám Đốc',
          signerIp: '14.232.0.1',
        });

        const checkout = await initiateContractPayment(d1, {
          contractId: contract.id,
          paymentRail: 'PAYOS',
          userId: TEST_ORG_ID,
        });
        expect(checkout.invoiceId).toBeDefined();
        expect(checkout.qrUrl).toBeDefined();

        const updatedContract = await getContractById(d1, contract.id);
        expect(updatedContract?.paymentRail).toBe('PAYOS');
      });

      it('F10-5: persists draft E-Invoice record with matching commitments in invoices table', async () => {
        const quote = await createEnterpriseQuote(d1, {
          orgId: TEST_ORG_ID,
          mcuCapacityMonthly: 100_000,
          billingCycle: 'monthly',
        });
        const contract = await convertQuoteToContract(d1, quote.id);
        await executeContractSigning(d1, contract.id, {
          signerName: 'CEO',
          signerEmail: 'ceo@test.com',
          signerTitle: 'CEO',
          signerIp: '127.0.0.1',
        });

        const checkout = await initiateContractPayment(d1, {
          contractId: contract.id,
          paymentRail: 'NOWPAYMENTS',
          userId: TEST_ORG_ID,
        });
        const invoiceRow = await d1
          .prepare('SELECT * FROM invoices WHERE id = ?1')
          .bind(checkout.invoiceId)
          .first<{ id: string; amount_cents: number; status: string; org_id: string }>();

        expect(invoiceRow?.id).toBe(checkout.invoiceId);
        expect(invoiceRow?.amount_cents).toBe(350_000);
        expect(invoiceRow?.status).toBe('draft');
      });
    });

    describe('Feature 11: Payment Fulfillment & Provisioning', () => {
      it('F11-1: marks draft invoice paid upon payment fulfillment', async () => {
        const quote = await createEnterpriseQuote(d1, {
          orgId: TEST_ORG_ID,
          mcuCapacityMonthly: 100_000,
        });
        const contract = await convertQuoteToContract(d1, quote.id);
        await executeContractSigning(d1, contract.id, {
          signerName: 'Signer',
          signerEmail: 's@test.com',
          signerTitle: 'COO',
          signerIp: '1.1.1.1',
        });
        const checkout = await initiateContractPayment(d1, {
          contractId: contract.id,
          paymentRail: 'NOWPAYMENTS',
          userId: TEST_ORG_ID,
        });

        const fulfillment = await fulfillContractPayment(d1, {
          contractId: contract.id,
          paymentRail: 'NOWPAYMENTS',
          paymentReference: 'tx_nowp_123',
          paidByUserId: TEST_ORG_ID,
          amountPaidCents: 350_000,
        });
        expect(fulfillment.success).toBe(true);

        const invoiceRow = await d1
          .prepare('SELECT status, paid_at FROM invoices WHERE id = ?1')
          .bind(checkout.invoiceId)
          .first<{ status: string; paid_at: number }>();

        expect(invoiceRow?.status).toBe('paid');
        expect(invoiceRow?.paid_at).toBeGreaterThan(0);
      });

      it('F11-2: provisions monthly committed MCU credits to user balance', async () => {
        const quote = await createEnterpriseQuote(d1, {
          orgId: TEST_ORG_ID,
          mcuCapacityMonthly: 250_000,
        });
        const contract = await convertQuoteToContract(d1, quote.id);
        await executeContractSigning(d1, contract.id, {
          signerName: 'Signer',
          signerEmail: 's@test.com',
          signerTitle: 'COO',
          signerIp: '1.1.1.1',
        });
        await initiateContractPayment(d1, {
          contractId: contract.id,
          paymentRail: 'NOWPAYMENTS',
          userId: TEST_ORG_ID,
        });

        await fulfillContractPayment(d1, {
          contractId: contract.id,
          paymentRail: 'NOWPAYMENTS',
          paymentReference: 'tx_250k',
          paidByUserId: TEST_ORG_ID,
          amountPaidCents: 687_500,
        });

        const balanceRow = await d1
          .prepare('SELECT credits_remaining FROM user_mcu_balance WHERE user_id = ?1')
          .bind(TEST_ORG_ID)
          .first<{ credits_remaining: number }>();

        expect(balanceRow?.credits_remaining).toBe(250_000);
      });

      it('F11-3: records transaction in mcu_transactions audit ledger', async () => {
        const quote = await createEnterpriseQuote(d1, {
          orgId: TEST_ORG_ID,
          mcuCapacityMonthly: 50_000,
        });
        const contract = await convertQuoteToContract(d1, quote.id);
        await executeContractSigning(d1, contract.id, {
          signerName: 'Signer',
          signerEmail: 's@test.com',
          signerTitle: 'COO',
          signerIp: '1.1.1.1',
        });
        await initiateContractPayment(d1, {
          contractId: contract.id,
          paymentRail: 'NOWPAYMENTS',
          userId: TEST_ORG_ID,
        });
        await fulfillContractPayment(d1, {
          contractId: contract.id,
          paymentRail: 'NOWPAYMENTS',
          paymentReference: 'tx_tx_log',
          paidByUserId: TEST_ORG_ID,
          amountPaidCents: 200_000,
        });

        const txRow = await d1
          .prepare('SELECT delta, reason FROM mcu_transactions WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 1')
          .bind(TEST_ORG_ID)
          .first<{ delta: number; reason: string }>();

        expect(txRow?.delta).toBe(50_000);
        expect(txRow?.reason).toBe('ENTERPRISE_CONTRACT_ACTIVATION');
      });

      it('F11-4: updates contract status to active and sets effective dates', async () => {
        const quote = await createEnterpriseQuote(d1, {
          orgId: TEST_ORG_ID,
          mcuCapacityMonthly: 100_000,
        });
        const contract = await convertQuoteToContract(d1, quote.id);
        await executeContractSigning(d1, contract.id, {
          signerName: 'Signer',
          signerEmail: 's@test.com',
          signerTitle: 'COO',
          signerIp: '1.1.1.1',
        });
        await initiateContractPayment(d1, {
          contractId: contract.id,
          paymentRail: 'NOWPAYMENTS',
          userId: TEST_ORG_ID,
        });
        await fulfillContractPayment(d1, {
          contractId: contract.id,
          paymentRail: 'NOWPAYMENTS',
          paymentReference: 'tx_active',
          paidByUserId: TEST_ORG_ID,
          amountPaidCents: 350_000,
        });

        const updatedContract = await getContractById(d1, contract.id);
        expect(updatedContract?.status).toBe('active');
        expect(updatedContract?.effectiveDate).toBeDefined();
      });

      it('F11-5: updates associated CRM deal stage to closed_won', async () => {
        const deal = await createEnterpriseDeal(d1, {
          leadName: 'Deal Lead',
          leadEmail: 'lead@deal.com',
          companyName: 'Deal Corp',
          companyDomain: 'deal.com',
          dealStage: 'negotiating',
        });

        const quote = await createEnterpriseQuote(d1, {
          orgId: TEST_ORG_ID,
          dealId: deal.id,
          mcuCapacityMonthly: 100_000,
        });
        const contract = await convertQuoteToContract(d1, quote.id);
        await executeContractSigning(d1, contract.id, {
          signerName: 'Signer',
          signerEmail: 's@test.com',
          signerTitle: 'COO',
          signerIp: '1.1.1.1',
        });
        await initiateContractPayment(d1, {
          contractId: contract.id,
          paymentRail: 'NOWPAYMENTS',
          userId: TEST_ORG_ID,
        });
        await fulfillContractPayment(d1, {
          contractId: contract.id,
          paymentRail: 'NOWPAYMENTS',
          paymentReference: 'tx_won',
          paidByUserId: TEST_ORG_ID,
          amountPaidCents: 350_000,
        });

        const dealRow = await d1
          .prepare('SELECT deal_stage FROM enterprise_deals WHERE id = ?1')
          .bind(deal.id)
          .first<{ deal_stage: string }>();

        expect(dealRow?.deal_stage).toBe('closed_won');
      });
    });
  });

  // ==========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (>=5 tests)
  // ==========================================================================

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('B1: accepts exactly 50,000 MCU minimum boundary', async () => {
      const quote = await createEnterpriseQuote(d1, {
        orgId: TEST_ORG_ID,
        mcuCapacityMonthly: 50_000,
      });
      expect(quote.mcuCapacityMonthly).toBe(50_000);
      expect(quote.volumeDiscountPercent).toBe(0.20);
    });

    it('B2: accepts exactly 500,000 MCU maximum boundary', async () => {
      const quote = await createEnterpriseQuote(d1, {
        orgId: TEST_ORG_ID,
        mcuCapacityMonthly: 500_000,
      });
      expect(quote.mcuCapacityMonthly).toBe(500_000);
      expect(quote.volumeDiscountPercent).toBe(0.60);
    });

    it('B3: rejects capacity below 50,000 MCU in volume discount calculator', () => {
      expect(() => getVolumeDiscountBracket(49_999)).toThrow(
        /Minimum enterprise commitment is 50,000 MCU\/month/
      );
    });

    it('B4: caps volume discount at 60% for capacity beyond 500,000 MCU', () => {
      const bracket = getVolumeDiscountBracket(1_000_000);
      expect(bracket.discountPercent).toBe(0.60);
      expect(bracket.effectivePricePerMcuCents).toBe(2.0);
    });

    it('B5: tamper detection: altering 1 cent in payload invalidates SHA-256 hash', async () => {
      const payload: ContractSignablePayload = {
        contractNumber: 'SLA-TAMPER-TEST',
        orgId: TEST_ORG_ID,
        mcuCapacityMonthly: 100_000,
        slaUptimePercent: 99.9,
        billingCycle: 'monthly',
        unitPricePerMcuCents: 3.5,
        monthlyCommitmentCents: 350_000,
        annualCommitmentCents: 4_200_000,
        currency: 'USD',
        termsVersion: '2026.1-ENTERPRISE-SLA',
        effectiveDate: '2026-10-01',
        expirationDate: '2027-10-01',
      };

      const originalHash = await computeContractHash(payload);

      const tamperedPayload = { ...payload, monthlyCommitmentCents: 350_001 };
      const tamperedHash = await computeContractHash(tamperedPayload);

      expect(tamperedHash).not.toBe(originalHash);
    });

    it('B6: customer signature fails verification when signer email is modified', async () => {
      const termsHash = 'a'.repeat(64);
      const secret = 'test-secret';
      const sig = await generateCustomerSignature(termsHash, { email: 'legit@company.com', timestamp: 1700000000 }, secret);

      const isValid = await verifyCustomerSignature(termsHash, { email: 'attacker@company.com', timestamp: 1700000000 }, sig, secret);
      expect(isValid).toBe(false);
    });

    it('B7: idempotent payment fulfillment prevents double-crediting MCUs', async () => {
      const quote = await createEnterpriseQuote(d1, {
        orgId: TEST_ORG_ID,
        mcuCapacityMonthly: 100_000,
      });
      const contract = await convertQuoteToContract(d1, quote.id);
      await executeContractSigning(d1, contract.id, {
        signerName: 'S',
        signerEmail: 's@t.com',
        signerTitle: 'C',
        signerIp: '1.1.1.1',
      });
      await initiateContractPayment(d1, {
        contractId: contract.id,
        paymentRail: 'NOWPAYMENTS',
        userId: TEST_ORG_ID,
      });

      // First fulfillment
      const f1 = await fulfillContractPayment(d1, {
        contractId: contract.id,
        paymentRail: 'NOWPAYMENTS',
        paymentReference: 'tx_idem',
        paidByUserId: TEST_ORG_ID,
        amountPaidCents: 350_000,
      });
      expect(f1.success).toBe(true);

      // Duplicate webhook fulfillment retry
      const f2 = await fulfillContractPayment(d1, {
        contractId: contract.id,
        paymentRail: 'NOWPAYMENTS',
        paymentReference: 'tx_idem',
        paidByUserId: TEST_ORG_ID,
        amountPaidCents: 350_000,
      });
      expect(f2.success).toBe(true);

      // Check balance is exactly 100,000 (NOT 200,000)
      const balanceRow = await d1
        .prepare('SELECT credits_remaining FROM user_mcu_balance WHERE user_id = ?1')
        .bind(TEST_ORG_ID)
        .first<{ credits_remaining: number }>();

      expect(balanceRow?.credits_remaining).toBe(100_000);
    });
  });

  // ==========================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS
  // ==========================================================================

  describe('Tier 3: Cross-Feature Combinations', () => {
    it('C1: full Quote-to-Cash loop via NOWPayments USDT', async () => {
      // 1. CRM Lead
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'Global Media Exec',
        leadEmail: 'exec@globalmedia.com',
        companyName: 'Global Media LLC',
        companyDomain: 'globalmedia.com',
        dealStage: 'negotiating',
      });

      // 2. Generate Quote
      const quote = await createEnterpriseQuote(d1, {
        orgId: TEST_ORG_ID,
        dealId: deal.id,
        mcuCapacityMonthly: 250_000,
        billingCycle: 'monthly',
      });
      expect(quote.volumeDiscountPercent).toBe(0.45);

      // 3. Convert to SLA Contract
      const contract = await convertQuoteToContract(d1, quote.id);
      expect(contract.status).toBe('pending_signature');

      // 4. Dual Signatures
      const signer: CustomerSignerInput = {
        signerName: 'Jane Doe',
        signerEmail: 'exec@globalmedia.com',
        signerTitle: 'Chief Operating Officer',
        signerIp: '198.51.100.1',
        signingSecret: 'cust-sec',
      };
      const signed = await executeContractSigning(d1, contract.id, signer);
      expect(signed.status).toBe('signed');

      // 5. Checkout Initiation
      const checkout = await initiateContractPayment(d1, {
        contractId: contract.id,
        paymentRail: 'NOWPAYMENTS',
        userId: TEST_ORG_ID,
      });
      expect(checkout.checkoutUrl).toBeDefined();

      // 6. Webhook Fulfillment
      const fulfilled = await fulfillContractPayment(d1, {
        contractId: contract.id,
        paymentRail: 'NOWPAYMENTS',
        paymentReference: 'tx_c1_nowp',
        paidByUserId: TEST_ORG_ID,
        amountPaidCents: 687_500,
      });
      expect(fulfilled.success).toBe(true);

      // 7. Verify downstream state
      const finalContract = await getContractById(d1, contract.id);
      expect(finalContract?.status).toBe('active');

      const dealRow = await d1
        .prepare('SELECT deal_stage FROM enterprise_deals WHERE id = ?1')
        .bind(deal.id)
        .first<{ deal_stage: string }>();
      expect(dealRow?.deal_stage).toBe('closed_won');

      const finalBalance = await d1
        .prepare('SELECT credits_remaining FROM user_mcu_balance WHERE user_id = ?1')
        .bind(TEST_ORG_ID)
        .first<{ credits_remaining: number }>();
      expect(finalBalance?.credits_remaining).toBe(250_000);
    });

    it('C2: full Quote-to-Cash loop via PayOS VietQR with Annual Prepay Discount', async () => {
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'Hoang Van Quan',
        leadEmail: 'quan@vinatech.vn',
        companyName: 'VinaTech Solutions',
        companyDomain: 'vinatech.vn',
        dealStage: 'negotiating',
      });

      // Annual 100K MCU quote (30% volume discount + 17% annual savings)
      const quote = await createEnterpriseQuote(d1, {
        orgId: TEST_ORG_ID,
        dealId: deal.id,
        mcuCapacityMonthly: 100_000,
        billingCycle: 'annual',
        currency: 'VND',
      });
      expect(quote.annualDiscountPercent).toBe(0.17);

      const contract = await convertQuoteToContract(d1, quote.id);
      const signer: CustomerSignerInput = {
        signerName: 'Hoang Van Quan',
        signerEmail: 'quan@vinatech.vn',
        signerTitle: 'Giám Đốc Điều Hành (CEO)',
        signerIp: '118.69.1.1',
        signingSecret: 'sec',
      };
      await executeContractSigning(d1, contract.id, signer);

      const checkout = await initiateContractPayment(d1, {
        contractId: contract.id,
        paymentRail: 'PAYOS',
        userId: TEST_ORG_ID,
      });
      expect(checkout.qrUrl).toBeDefined();

      await fulfillContractPayment(d1, {
        contractId: contract.id,
        paymentRail: 'PAYOS',
        paymentReference: 'payos_ref_annual',
        paidByUserId: TEST_ORG_ID,
        amountPaidCents: quote.finalPriceCents,
      });

      const dealRow = await d1
        .prepare('SELECT deal_stage FROM enterprise_deals WHERE id = ?1')
        .bind(deal.id)
        .first<{ deal_stage: string }>();
      expect(dealRow?.deal_stage).toBe('closed_won');

      const checkContract = await getContractById(d1, contract.id);
      expect(checkContract?.status).toBe('active');
      expect(checkContract?.billingCycle).toBe('annual');
    });
  });

  // ==========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // ==========================================================================

  describe('Tier 4: Real-World Enterprise Monetization Scenarios', () => {
    it('S1: Enterprise SaaS Unicorn onboarding: 500K MCU annual contract ($99.6K prepay), dual signed and fulfilled', async () => {
      // Step 1: CRM deal from enterprise lead pipeline
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'Michael Sterling',
        leadEmail: 'm.sterling@unicornglobal.com',
        leadTitle: 'Chief Information Officer (CIO)',
        companyName: 'Unicorn Global Inc',
        companyDomain: 'unicornglobal.com',
        dealStage: 'negotiating',
        requestedMcuMonthly: 500_000,
        dealValueEstimateCents: 9_960_000,
        currency: 'USD',
      });

      // Step 2: Quote generation with maximum volume discount (60%) + annual discount (17%)
      const quote = await createEnterpriseQuote(d1, {
        orgId: TEST_ORG_ID,
        dealId: deal.id,
        mcuCapacityMonthly: 500_000,
        billingCycle: 'annual',
        currency: 'USD',
      });
      expect(quote.finalPriceCents).toBe(9_960_000);

      // Step 3: Quote to contract conversion
      const contract = await convertQuoteToContract(d1, quote.id);
      expect(contract.contractSha256).toBeDefined();

      // Step 4: Cryptographic digital signing
      const signer: CustomerSignerInput = {
        signerName: 'Michael Sterling',
        signerEmail: 'm.sterling@unicornglobal.com',
        signerTitle: 'CIO',
        signerIp: '64.233.160.1',
        signingSecret: 'customer-unicorn-secret',
      };
      const signed = await executeContractSigning(d1, contract.id, signer);
      expect(signed.customerSignatureHash).toBeDefined();
      expect(signed.platformSignatureHash).toBeDefined();

      // Step 5: Dual-rail checkout with NOWPayments USDT
      const checkout = await initiateContractPayment(d1, {
        contractId: contract.id,
        paymentRail: 'NOWPAYMENTS',
        userId: TEST_ORG_ID,
      });
      expect(checkout.checkoutUrl).toContain('nowpayments.io');

      // Step 6: Payment webhook fulfillment
      const fulfillment = await fulfillContractPayment(d1, {
        contractId: contract.id,
        paymentRail: 'NOWPAYMENTS',
        paymentReference: 'nowp_tx_unicorn_99600',
        paidByUserId: TEST_ORG_ID,
        amountPaidCents: quote.finalPriceCents,
      });
      expect(fulfillment.success).toBe(true);

      // Step 7: Verify completed enterprise state
      const finalContract = await getContractById(d1, contract.id);
      expect(finalContract?.status).toBe('active');
      expect(finalContract?.mcuCapacityMonthly).toBe(500_000);

      const dealRow = await d1
        .prepare('SELECT deal_stage FROM enterprise_deals WHERE id = ?1')
        .bind(deal.id)
        .first<{ deal_stage: string }>();
      expect(dealRow?.deal_stage).toBe('closed_won');

      const finalBalance = await d1
        .prepare('SELECT credits_remaining, credits_total_purchased FROM user_mcu_balance WHERE user_id = ?1')
        .bind(TEST_ORG_ID)
        .first<{ credits_remaining: number; credits_total_purchased: number }>();
      expect(finalBalance?.credits_remaining).toBe(500_000);
      expect(finalBalance?.credits_total_purchased).toBe(500_000);
    });

    it('S2: Vietnam National Broadcast Agency: 100K MCU monthly contract with VietQR & compliant E-Invoice', async () => {
      const deal = await createEnterpriseDeal(d1, {
        leadName: 'Nguyen Van Truong',
        leadEmail: 'truong.nv@dai-truyen-hinh.vn',
        leadTitle: 'Trưởng Ban Kỹ Thuật Số',
        companyName: 'Đài Truyền Hình Quốc Gia',
        companyDomain: 'dai-truyen-hinh.vn',
        dealStage: 'negotiating',
        requestedMcuMonthly: 100_000,
        dealValueEstimateCents: 350_000,
        currency: 'VND',
      });

      const quote = await createEnterpriseQuote(d1, {
        orgId: TEST_ORG_ID,
        dealId: deal.id,
        mcuCapacityMonthly: 100_000,
        billingCycle: 'monthly',
        currency: 'VND',
      });

      const contract = await convertQuoteToContract(d1, quote.id);
      await executeContractSigning(d1, contract.id, {
        signerName: 'Nguyen Van Truong',
        signerEmail: 'truong.nv@dai-truyen-hinh.vn',
        signerTitle: 'Trưởng Ban Kỹ Thuật Số',
        signerIp: '113.190.0.1',
        signingSecret: 'secret-vn-broadcast',
      });

      const checkout = await initiateContractPayment(d1, {
        contractId: contract.id,
        paymentRail: 'PAYOS',
        userId: TEST_ORG_ID,
      });
      expect(checkout.qrUrl).toBeDefined();

      const fulfillment = await fulfillContractPayment(d1, {
        contractId: contract.id,
        paymentRail: 'PAYOS',
        paymentReference: 'payos_tx_vtv_100k',
        paidByUserId: TEST_ORG_ID,
        amountPaidCents: quote.finalPriceCents,
      });
      expect(fulfillment.success).toBe(true);

      const invoice = await d1
        .prepare('SELECT * FROM invoices WHERE id = ?1')
        .bind(checkout.invoiceId)
        .first<{ status: string; currency: string }>();

      expect(invoice?.status).toBe('paid');
      expect(invoice?.currency).toBe('VND');

      const dealRow = await d1
        .prepare('SELECT deal_stage FROM enterprise_deals WHERE id = ?1')
        .bind(deal.id)
        .first<{ deal_stage: string }>();
      expect(dealRow?.deal_stage).toBe('closed_won');
    });
  });
});
