/**
 * Empirical Challenger 2 Stress Test Suite:
 * Comprehensive adversarial verification of Requirement R3 & R4:
 * 1. R3: Affiliate Webhook Verifier (HMAC, anti-fraud, 14-day hold, duplicate idempotency)
 * 2. R3: Payout Module (TRC-20 Base58Check, rate limiting, batch error isolation)
 * 3. R4: Solutions Schema Builder (Multi-entity JSON-LD, fallbacks, bilingual linking)
 * 4. R4: Growth Analytics Service (Zero-visitor division, 100% drop-off, $5K MRR milestone)
 *
 * Strict 0 ':any' policy enforced.
 *
 * @vitest-environment node
 * @module tests/adversarial/challenger2-r3-r4-empirical.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';

import {
  calculatePayableTimestamp,
  verifyPostbackSignature,
  validateAntiFraudRules,
  processAffiliateCommissionWebhook,
  HOLD_PERIOD_DAYS,
  HOLD_PERIOD_MS,
  type CommissionWebhookPayload,
} from '@/land/affiliates/affiliate-webhook-verifier';

import {
  generateAffiliateHmac,
  verifyAffiliateHmac,
} from '@/tree/affiliate/hmac-verifier';

import {
  validateTrc20Address,
  validateErc20Address,
  validateUsdtAddress,
} from '@/land/payouts/usdt-addr-validator';

import {
  executeMultiPayoutBatch,
  exportBankReconciliationCsv,
  type BankReconciliationRecord,
  type MultiPayoutBatchInput,
} from '@/land/payouts/nowpayments-mass-payout';

import {
  buildSolutionsMultiEntitySchema,
  buildSoftwareApplicationEntity,
  buildProductEntity,
  buildFaqPageEntity,
  buildBreadcrumbListEntity,
  SITE_URL,
} from '@/land/seo/solutions-schema-builder';

import {
  calculateFunnelStages,
  calculateMrrProgress,
  getGrowthAnalyticsSummary,
  TARGET_MRR_USD,
  TARGET_PAYING_CUSTOMERS,
} from '@/land/growth/growth-analytics-service';

import { getSolutionIndustry } from '@/seed/config/solutions-catalog';
import * as dbClient from '@/seed/db/client';

/**
 * Creates a deterministic in-memory SQLite instance simulating Cloudflare D1
 * with strict constraints and full transaction support.
 */
function createTestD1(): { d1: D1Database; rawDb: InstanceType<typeof DatabaseSync> } {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliate_partners (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      partner_code TEXT UNIQUE NOT NULL,
      tier TEXT NOT NULL DEFAULT 'STANDARD',
      commission_rate_pct REAL NOT NULL DEFAULT 20.0,
      tier2_rate_pct REAL NOT NULL DEFAULT 5.0,
      parent_partner_id TEXT,
      usdt_trc20_address_encrypted TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      total_earnings_cents INTEGER NOT NULL DEFAULT 0,
      pending_payout_cents INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS commission_ledger (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      affiliate_id TEXT NOT NULL,
      conversion_event_id TEXT NOT NULL UNIQUE,
      offer_id TEXT NOT NULL,
      gross_cents INTEGER NOT NULL,
      commission_pct REAL NOT NULL,
      commission_cents INTEGER NOT NULL,
      withheld_cents INTEGER NOT NULL DEFAULT 0,
      parent_conversion_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      payable_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payout_batches (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      affiliate_id TEXT,
      total_cents INTEGER,
      ledger_count INTEGER,
      status TEXT NOT NULL DEFAULT 'queued',
      payment_method TEXT,
      external_payment_id TEXT,
      network TEXT DEFAULT 'TRC20',
      recipient_addr_encrypted TEXT,
      failed_reason TEXT,
      created_at INTEGER,
      finalized_at INTEGER
    );
  `);

  const d1 = {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T = Record<string, unknown>>() => stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
            },
            all: async <T = Record<string, unknown>>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0, duration: 0 } };
            },
          };
        },
        first: async <T = Record<string, unknown>>() => stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
        },
        all: async <T = Record<string, unknown>>() => {
          return { results: stmt.all() as T[], meta: { changes: 0, duration: 0 } };
        },
      };
    },
    exec: async (sql: string) => {
      db.exec(sql);
    },
  } as unknown as D1Database;

  return { d1, rawDb: db };
}

describe('Challenger 2 Empirical Verification: R3 Affiliate & Payouts', () => {
  const secretKey = 'affiliate_super_secret_verification_key_2026';
  const genuinePayload = JSON.stringify({
    conversionEventId: 'evt_conv_order_9981',
    partnerCode: 'ALPHA_CREATOR',
    orderAmountCents: 19900,
    buyerUserId: 'buyer_usr_100',
    buyerEmail: 'client@example.com',
  });

  describe('R3.1 HMAC-SHA256 Signature Verification', () => {
    it('authenticates valid HMAC-SHA256 signature with and without sha256= prefix', async () => {
      const hexSignature = await generateAffiliateHmac(genuinePayload, secretKey, 'SHA-256');

      const rawCheck = await verifyPostbackSignature({
        rawBody: genuinePayload,
        signature: hexSignature,
        secret: secretKey,
      });
      expect(rawCheck).toBe(true);

      const prefixCheck = await verifyPostbackSignature({
        rawBody: genuinePayload,
        signature: `sha256=${hexSignature}`,
        secret: secretKey,
      });
      expect(prefixCheck).toBe(true);

      const upperPrefixCheck = await verifyPostbackSignature({
        rawBody: genuinePayload,
        signature: `SHA256=${hexSignature.toUpperCase()}`,
        secret: secretKey,
      });
      expect(upperPrefixCheck).toBe(true);
    });

    it('rejects bit-flipped, tampered, or corrupted HMAC signatures', async () => {
      const validSig = await generateAffiliateHmac(genuinePayload, secretKey, 'SHA-256');

      // 1. Bit flip in signature
      const corruptedSig = validSig.slice(0, -1) + (validSig.slice(-1) === 'a' ? 'b' : 'a');
      expect(
        await verifyPostbackSignature({
          rawBody: genuinePayload,
          signature: corruptedSig,
          secret: secretKey,
        })
      ).toBe(false);

      // 2. Truncated signature
      const truncatedSig = validSig.slice(0, 32);
      expect(
        await verifyPostbackSignature({
          rawBody: genuinePayload,
          signature: truncatedSig,
          secret: secretKey,
        })
      ).toBe(false);

      // 3. Signature for different payload
      const alteredPayload = genuinePayload.replace('19900', '19901');
      expect(
        await verifyPostbackSignature({
          rawBody: alteredPayload,
          signature: validSig,
          secret: secretKey,
        })
      ).toBe(false);

      // 4. Wrong secret
      expect(
        await verifyPostbackSignature({
          rawBody: genuinePayload,
          signature: validSig,
          secret: 'wrong_affiliate_secret_key',
        })
      ).toBe(false);

      // 5. Empty inputs
      expect(
        await verifyPostbackSignature({
          rawBody: '',
          signature: validSig,
          secret: secretKey,
        })
      ).toBe(false);

      expect(
        await verifyPostbackSignature({
          rawBody: genuinePayload,
          signature: '',
          secret: secretKey,
        })
      ).toBe(false);
    });
  });

  describe('R3.2 Anti-Fraud Rules & Self-Referral Detection', () => {
    it('blocks self-referral by exact user ID and trimmed user ID', () => {
      const checkExact = validateAntiFraudRules({
        partnerUserId: 'usr_partner_77',
        buyerUserId: 'usr_partner_77',
        orderAmountCents: 19900,
      });
      expect(checkExact.allowed).toBe(false);
      expect(checkExact.reason).toContain('SELF_REFERRAL_DETECTED');

      const checkTrimmed = validateAntiFraudRules({
        partnerUserId: 'usr_partner_77  ',
        buyerUserId: '  usr_partner_77',
        orderAmountCents: 19900,
      });
      expect(checkTrimmed.allowed).toBe(false);
      expect(checkTrimmed.reason).toContain('SELF_REFERRAL_DETECTED');
    });

    it('blocks self-referral by email address with case insensitivity and whitespace tolerance', () => {
      const checkEmail = validateAntiFraudRules({
        partnerUserId: 'usr_p1',
        buyerUserId: 'usr_b2',
        partnerEmail: 'Creator.Lead@AgencyOS.Network',
        buyerEmail: '  creator.lead@agencyos.network  ',
        orderAmountCents: 39900,
      });
      expect(checkEmail.allowed).toBe(false);
      expect(checkEmail.reason).toContain('SELF_REFERRAL_DETECTED');
    });

    it('blocks zero and negative order amounts', () => {
      const zeroResult = validateAntiFraudRules({
        partnerUserId: 'usr_p1',
        buyerUserId: 'usr_b2',
        orderAmountCents: 0,
      });
      expect(zeroResult.allowed).toBe(false);
      expect(zeroResult.reason).toContain('INVALID_ORDER_AMOUNT');

      const negativeResult = validateAntiFraudRules({
        partnerUserId: 'usr_p1',
        buyerUserId: 'usr_b2',
        orderAmountCents: -19900,
      });
      expect(negativeResult.allowed).toBe(false);
      expect(negativeResult.reason).toContain('INVALID_ORDER_AMOUNT');
    });

    it('identifies vulnerability: NaN or undefined order amounts bypass anti-fraud rule', () => {
      // EMPIRICAL CHALLENGE: In JavaScript, NaN <= 0 is false!
      const nanResult = validateAntiFraudRules({
        partnerUserId: 'usr_p1',
        buyerUserId: 'usr_b2',
        orderAmountCents: Number.NaN,
      });
      // Fixed: validateAntiFraudRules blocks NaN order amounts
      expect(nanResult.allowed).toBe(false);
      expect(nanResult.reason).toContain('INVALID_ORDER_AMOUNT');
    });

    it('permits genuine third-party referral purchases', () => {
      const legit = validateAntiFraudRules({
        partnerUserId: 'partner_agent_007',
        buyerUserId: 'buyer_customer_999',
        partnerEmail: 'partner@growth.io',
        buyerEmail: 'buyer@corporate.com',
        orderAmountCents: 19900,
      });
      expect(legit.allowed).toBe(true);
      expect(legit.reason).toBeUndefined();
    });
  });

  describe('R3.3 14-Day Hold Period Precision', () => {
    it('enforces exact millisecond arithmetic: 14 * 86400 * 1000 = 1,209,600,000 ms', () => {
      expect(HOLD_PERIOD_DAYS).toBe(14);
      expect(HOLD_PERIOD_MS).toBe(14 * 86400 * 1000);
      expect(HOLD_PERIOD_MS).toBe(1209600000);

      const timestamp = 1715000000000;
      const payableAt = calculatePayableTimestamp(timestamp);
      expect(payableAt - timestamp).toBe(1209600000);

      const expectedDate = new Date(timestamp + 14 * 24 * 60 * 60 * 1000);
      expect(new Date(payableAt).toISOString()).toBe(expectedDate.toISOString());
    });
  });

  describe('R3.4 Duplicate Event Idempotency & Balance Double-Crediting Challenge', () => {
    let testD1: { d1: D1Database; rawDb: InstanceType<typeof DatabaseSync> };

    beforeEach(() => {
      testD1 = createTestD1();
      vi.spyOn(dbClient, 'getD1').mockResolvedValue(testD1.d1);

      // Seed an active partner
      testD1.rawDb.exec(`
        INSERT INTO affiliate_partners (
          id, user_id, partner_code, tier, commission_rate_pct, tier2_rate_pct,
          status, total_earnings_cents, pending_payout_cents, created_at, updated_at
        ) VALUES (
          'aff_challenger_1', 'usr_ch_1', 'CHALLENGER_CODE', 'STANDARD', 20.0, 5.0,
          'active', 0, 0, 1710000000000, 1710000000000
        );
      `);
    });

    it('EMPIRICAL STRESS TEST: verifies uniqueness in commission_ledger but reveals partner balance double-credit on duplicate webhooks', async () => {
      const payload: CommissionWebhookPayload = {
        conversionEventId: 'conv_repeat_attack_001',
        partnerCode: 'CHALLENGER_CODE',
        orderAmountCents: 10000, // $100.00 -> 20% = 2,000 cents
        buyerUserId: 'customer_ext_1',
        timestamp: 1710000000000,
      };

      // 1. First webhook delivery
      const res1 = await processAffiliateCommissionWebhook(payload);
      expect(res1.success).toBe(true);
      expect(res1.entries).toHaveLength(1);
      expect(res1.entries![0].commissionCents).toBe(2000);

      // Verify DB state after 1st execution
      const ledgerRows1 = testD1.rawDb.prepare('SELECT * FROM commission_ledger').all();
      expect(ledgerRows1.length).toBe(1);

      const partnerAfter1 = testD1.rawDb
        .prepare('SELECT pending_payout_cents, total_earnings_cents FROM affiliate_partners WHERE id = ?')
        .get('aff_challenger_1') as { pending_payout_cents: number; total_earnings_cents: number };
      expect(partnerAfter1.pending_payout_cents).toBe(2000);
      expect(partnerAfter1.total_earnings_cents).toBe(2000);

      // 2. Second webhook delivery with IDENTICAL conversionEventId (e.g. network retry or adversary replay)
      const res2 = await processAffiliateCommissionWebhook(payload);

      // Verify DB state after 2nd execution
      const ledgerRows2 = testD1.rawDb.prepare('SELECT * FROM commission_ledger').all();
      // Uniqueness is preserved in commission_ledger (still 1 row due to UNIQUE constraint)
      expect(ledgerRows2.length).toBe(1);

      const partnerAfter2 = testD1.rawDb
        .prepare('SELECT pending_payout_cents, total_earnings_cents FROM affiliate_partners WHERE id = ?')
        .get('aff_challenger_1') as { pending_payout_cents: number; total_earnings_cents: number };

      // Fixed: Duplicate webhook is idempotent; pending_payout_cents remains 2000 cents
      expect(partnerAfter2.pending_payout_cents).toBe(2000);
      expect(res2.entries).toHaveLength(0);
    });
  });

  describe('R3.5 Payout Module: TRC-20 Address Validation & Rate Limiting', () => {
    it('accurately validates genuine TRC-20 Base58Check addresses (length 34, T-prefix, double-SHA256)', async () => {
      // Official Tron Tether USDT TRC-20 contract address
      const genuineTrc20 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
      expect(await validateTrc20Address(genuineTrc20)).toBe(true);

      const genericValid = await validateUsdtAddress(genuineTrc20, 'usdt_trc20');
      expect(genericValid).toBe(true);
    });

    it('rejects invalid TRC-20 addresses across all boundary conditions', async () => {
      // 1. Ethereum / ERC-20 address
      expect(await validateTrc20Address('0xdAC17F958D2ee523a2206206994597C13D831ec7')).toBe(false);

      // 2. Non-T prefix
      expect(await validateTrc20Address('1R7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')).toBe(false);

      // 3. Length != 34
      expect(await validateTrc20Address('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6')).toBe(false); // 33
      expect(await validateTrc20Address('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6tA')).toBe(false); // 35

      // 4. Non-Base58 characters (contains 0, O, I, l)
      expect(await validateTrc20Address('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj0t')).toBe(false); // contains '0'
      expect(await validateTrc20Address('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLjIt')).toBe(false); // contains 'I'
      expect(await validateTrc20Address('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLjOt')).toBe(false); // contains 'O'
      expect(await validateTrc20Address('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLjlt')).toBe(false); // contains 'l'

      // 5. Corrupted checksum (single character modified in Base58 string)
      expect(await validateTrc20Address('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u')).toBe(false);
    });

    it('enforces sequential rate limiting (200ms delay per request = max 5 req/s)', async () => {
      const testD1 = createTestD1();
      vi.spyOn(dbClient, 'getD1').mockResolvedValue(testD1.d1);

      delete process.env.NOWPAYMENTS_API_KEY;

      const input: MultiPayoutBatchInput = {
        batchId: 'batch_rate_limit_test',
        items: [
          { partnerId: 'p1', totalCents: 5000, recipientAddrEncrypted: 'mock1' },
          { partnerId: 'p2', totalCents: 5000, recipientAddrEncrypted: 'mock2' },
          { partnerId: 'p3', totalCents: 5000, recipientAddrEncrypted: 'mock3' },
        ],
      };

      const t0 = Date.now();
      const res = await executeMultiPayoutBatch(input);
      const elapsed = Date.now() - t0;

      expect(res.successCount).toBe(3);
      // 3 items * 200ms sleep = at least 600ms elapsed
      expect(elapsed).toBeGreaterThanOrEqual(580);
    });

    it('guarantees batch error isolation without failing entire mass payout', async () => {
      const testD1 = createTestD1();

      // Intercept and throw on partner 2 only
      const origPrepare = testD1.d1.prepare.bind(testD1.d1);
      vi.spyOn(testD1.d1, 'prepare').mockImplementation((sql: string) => {
        const stmt = origPrepare(sql);
        return {
          ...stmt,
          bind: (...args: unknown[]) => {
            if (args.some((a) => typeof a === 'string' && a.includes('partner_fail_2'))) {
              throw new Error('NOWPayments API gateway simulated timeout');
            }
            return stmt.bind(...args);
          },
        } as unknown as D1PreparedStatement;
      });

      vi.spyOn(dbClient, 'getD1').mockResolvedValue(testD1.d1);
      delete process.env.NOWPAYMENTS_API_KEY;

      const input: MultiPayoutBatchInput = {
        batchId: 'batch_iso_001',
        items: [
          { partnerId: 'partner_ok_1', totalCents: 5000, recipientAddrEncrypted: 'enc_1' },
          { partnerId: 'partner_fail_2', totalCents: 10000, recipientAddrEncrypted: 'enc_2' },
          { partnerId: 'partner_ok_3', totalCents: 7500, recipientAddrEncrypted: 'enc_3' },
        ],
      };

      const result = await executeMultiPayoutBatch(input);
      expect(result.totalCount).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
      expect(result.failures[0].partnerId).toBe('partner_fail_2');
      expect(result.failures[0].error).toContain('simulated timeout');
      expect(result.externalPaymentIds['partner_ok_1']).toBeDefined();
      expect(result.externalPaymentIds['partner_ok_3']).toBeDefined();
      expect(result.externalPaymentIds['partner_fail_2']).toBeUndefined();
    });

    it('generates compliant RFC 4180 Bank Reconciliation CSV export', () => {
      const records: BankReconciliationRecord[] = [
        {
          batchId: 'rec_01',
          affiliateId: 'aff_1',
          partnerCode: 'CODE,"SPECIAL"',
          payoutMethod: 'vietqr',
          recipientAddressOrAccount: 'VCB, 0123456789',
          amountCents: 20000,
          status: 'confirmed',
          vndRate: 25450,
        },
      ];

      const csv = exportBankReconciliationCsv(records);
      expect(csv).toContain('"CODE,""SPECIAL"""');
      expect(csv).toContain('"VCB, 0123456789"');
      expect(csv).toContain('"200.00"');
      expect(csv).toContain('"5090000"'); // 200 * 25450 = 5,090,000 VND
    });
  });
});

describe('Challenger 2 Empirical Verification: R4 SEO Schema & Growth Analytics', () => {
  const realEstate = getSolutionIndustry('real-estate');

  describe('R4.1 Solutions Schema Builder Multi-Entity Validation', () => {
    it('builds a valid 4-entity schema.org @graph (SoftwareApplication, Product, FAQPage, BreadcrumbList)', () => {
      const schema = buildSolutionsMultiEntitySchema({
        industry: realEstate,
        locale: 'en',
      });

      expect(schema['@context']).toBe('https://schema.org');
      expect(Array.isArray(schema['@graph'])).toBe(true);
      expect(schema['@graph']).toHaveLength(4);

      const [softwareApp, product, faqPage, breadcrumbList] = schema['@graph'];

      // 1. SoftwareApplication
      expect(softwareApp['@type']).toBe('SoftwareApplication');
      expect(softwareApp['@id']).toBe(`${SITE_URL}/#software`);
      expect(softwareApp.name).toBe('Sophia AI Factory');
      expect(softwareApp.offers.lowPrice).toBe('99');
      expect(softwareApp.offers.highPrice).toBe('4999');

      // 2. Product
      expect(product['@type']).toBe('Product');
      expect(product['@id']).toBe(`${SITE_URL}/en/solutions/real-estate#product`);
      expect(product.offers.price).toBe('199');
      expect(product.offers.url).toBe(`${SITE_URL}/en/solutions/real-estate`);

      // 3. FAQPage
      expect(faqPage['@type']).toBe('FAQPage');
      expect(faqPage['@id']).toBe(`${SITE_URL}/en/solutions/real-estate#faq`);
      expect(faqPage.mainEntity.length).toBeGreaterThanOrEqual(1);

      // 4. BreadcrumbList
      expect(breadcrumbList['@type']).toBe('BreadcrumbList');
      expect(breadcrumbList['@id']).toBe(`${SITE_URL}/en/solutions/real-estate#breadcrumb`);
      expect(breadcrumbList.itemListElement).toHaveLength(3);
      expect(breadcrumbList.itemListElement[0].name).toBe('Home');
      expect(breadcrumbList.itemListElement[2].item).toBe(`${SITE_URL}/en/solutions/real-estate`);
    });

    it('ensures full JSON-LD serialization without circular references', () => {
      const schema = buildSolutionsMultiEntitySchema({
        industry: realEstate,
        locale: 'vi',
        baseUrl: 'https://test.sophia.network',
      });

      const serialized = JSON.stringify(schema);
      expect(typeof serialized).toBe('string');
      const parsed = JSON.parse(serialized);
      expect(parsed['@graph']).toHaveLength(4);
      expect(parsed['@graph'][1]['@id']).toBe('https://test.sophia.network/vi/solutions/real-estate#product');
    });

    it('validates bilingual Vietnamese localization strings', () => {
      const schemaVi = buildSolutionsMultiEntitySchema({
        industry: realEstate,
        locale: 'vi',
      });

      const [, product, , breadcrumb] = schemaVi['@graph'];
      expect(product.name).toContain('Bất Động Sản');
      expect(breadcrumb.itemListElement[0].name).toBe('Trang chủ');
      expect(breadcrumb.itemListElement[1].name).toBe('Giải pháp');
      expect(breadcrumb.itemListElement[2].name).toBe('Bất Động Sản');
    });
  });

  describe('R4.2 Growth Analytics Service: Funnel Math & $5,000 MRR Milestone', () => {
    it('handles zero visitors without division by zero or NaN', () => {
      const stages = calculateFunnelStages({
        visitors: 0,
        leads: 0,
        trials: 0,
        paid: 0,
      });

      expect(stages).toHaveLength(4);
      for (const s of stages) {
        expect(Number.isNaN(s.conversionRateFromPrev)).toBe(false);
        expect(Number.isNaN(s.dropoffRateFromPrev)).toBe(false);
        expect(Number.isFinite(s.conversionRateFromPrev)).toBe(true);
        expect(Number.isFinite(s.dropoffRateFromPrev)).toBe(true);
      }

      // Stage 1 default
      expect(stages[0].conversionRateFromPrev).toBe(100.0);
      expect(stages[0].dropoffRateFromPrev).toBe(0.0);

      // Stages 2, 3, 4 with 0 input
      expect(stages[1].conversionRateFromPrev).toBe(0);
      expect(stages[2].conversionRateFromPrev).toBe(0);
      expect(stages[3].conversionRateFromPrev).toBe(0);
    });

    it('handles 100% drop-off at every funnel stage accurately', () => {
      // 1. Drop-off after visitors
      const dropAfterVisitors = calculateFunnelStages({
        visitors: 1000,
        leads: 0,
        trials: 0,
        paid: 0,
      });
      expect(dropAfterVisitors[1].conversionRateFromPrev).toBe(0);
      expect(dropAfterVisitors[1].dropoffRateFromPrev).toBe(100.0);

      // 2. Drop-off after leads
      const dropAfterLeads = calculateFunnelStages({
        visitors: 1000,
        leads: 200,
        trials: 0,
        paid: 0,
      });
      expect(dropAfterLeads[1].conversionRateFromPrev).toBe(20.0);
      expect(dropAfterLeads[2].conversionRateFromPrev).toBe(0);
      expect(dropAfterLeads[2].dropoffRateFromPrev).toBe(100.0);

      // 3. Drop-off after trials
      const dropAfterTrials = calculateFunnelStages({
        visitors: 1000,
        leads: 200,
        trials: 50,
        paid: 0,
      });
      expect(dropAfterTrials[2].conversionRateFromPrev).toBe(25.0);
      expect(dropAfterTrials[3].conversionRateFromPrev).toBe(0);
      expect(dropAfterTrials[3].dropoffRateFromPrev).toBe(100.0);
    });

    it('handles inverted / viral signups where leads exceed recorded web visitors', () => {
      // e.g. direct viral telegram signup without web page view
      const viralAnomaly = calculateFunnelStages({
        visitors: 10,
        leads: 50,
        trials: 25,
        paid: 5,
      });

      expect(viralAnomaly[1].conversionRateFromPrev).toBe(500.0);
      expect(viralAnomaly[1].dropoffRateFromPrev).toBe(0.0); // dropoff clamped at 0
    });

    it('calculates $5,000 MRR milestone metrics, gaps, ARPU, and 10 paying customers target', () => {
      // 2 Basic ($199) + 2 Premium ($399) + 2 Enterprise ($799) = 6 customers
      // MRR: 2*199 + 2*399 + 2*799 = 398 + 798 + 1598 = $2,794
      const progress = calculateMrrProgress({
        tierCounts: { basic: 2, premium: 2, enterprise: 2, master: 0 },
      });

      expect(progress.targetMrrUsd).toBe(TARGET_MRR_USD); // 5000
      expect(progress.currentMrrUsd).toBe(2794);
      expect(progress.gapToTargetUsd).toBe(2206); // 5000 - 2794
      expect(progress.progressPct).toBe(55.9); // (2794 / 5000) * 100 = 55.88 -> 55.9%

      expect(progress.targetPayingCustomers).toBe(TARGET_PAYING_CUSTOMERS); // 10
      expect(progress.currentPayingCustomers).toBe(6);
      expect(progress.customerGap).toBe(4);
      expect(progress.customerProgressPct).toBe(60.0);

      // ARPU = 2794 / 6 = 465.666 -> 466
      expect(progress.arpu).toBe(466);
    });

    it('caps progress percentage at 100% when $5K MRR milestone is exceeded', () => {
      const overTarget = calculateMrrProgress({
        tierCounts: { basic: 10, premium: 10, enterprise: 5, master: 0 },
      });

      // MRR: 10*199 + 10*399 + 5*799 = 1990 + 3990 + 3995 = $9,975
      expect(overTarget.currentMrrUsd).toBe(9975);
      expect(overTarget.progressPct).toBe(100.0);
      expect(overTarget.gapToTargetUsd).toBe(0);
      expect(overTarget.customerProgressPct).toBe(100.0);
      expect(overTarget.customerGap).toBe(0);
    });

    it('analyzes Master Tier impact: Master $4,999 revenue is excluded from monthly MRR but counted in paying customers', () => {
      // 1 Master customer ($4,999 one-time agency setup)
      const masterOnly = calculateMrrProgress({
        tierCounts: { basic: 0, premium: 0, enterprise: 0, master: 1 },
      });

      expect(masterOnly.tierBreakdown.master.revenue).toBe(4999);
      // MRR is strictly recurring (Basic, Premium, Enterprise)
      expect(masterOnly.currentMrrUsd).toBe(0);
      expect(masterOnly.progressPct).toBe(0);
      expect(masterOnly.gapToTargetUsd).toBe(5000);

      // But paying customer count includes master
      expect(masterOnly.currentPayingCustomers).toBe(1);
      expect(masterOnly.customerProgressPct).toBe(10.0);
      expect(masterOnly.customerGap).toBe(9);
      expect(masterOnly.arpu).toBe(0);
    });
  });
});
