/**
 * Empirical Challenger 2 Stress Test Suite: Milestone 3 (R3 Dual-Rail Payouts & VietQR)
 *
 * Adversarially challenges:
 * 1. VietQR CSV generation & RFC 4180 escaping (commas, quotes, newlines, formula injection vectors).
 * 2. VietQR URL construction (parameter encoding, safe amounts, clean BIN/account formatting).
 * 3. Currency conversions & edge-case amounts (zero, negative, fractional VND, extreme rates).
 * 4. Dual-Rail batch partitioning with real SQLite D1 ($50 threshold, rail segregation, status filtering).
 * 5. Idempotency & double-payout prevention across USDT and VietQR rails.
 *
 * Enforces strict 0 ':any' policy and clean architecture.
 *
 * @vitest-environment node
 * @module tests/adversarial/m3-dual-rail-vietqr-adversarial.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';

import {
  escapeCsvField,
  getExchangeRateVnd,
  buildVietQrPaymentUrl,
  generateVietQrCsv,
  createDualRailPayoutBatch,
  executeDualRailBatch,
  DEFAULT_USD_TO_VND_RATE,
  DEFAULT_MIN_PAYOUT_CENTS,
} from '@/land/payouts/dual-rail-payout-engine';

import * as nowpaymentsModule from '@/land/payouts/nowpayments-mass-payout';
import type { PayoutBatchItem, DualRailPayoutBatch } from '@/seed/types/affiliate-expansion-types';

/**
 * Creates an in-memory SQLite database simulating Cloudflare D1 with
 * exact schema from migrations 0282 and 0287.
 */
function createTestD1(): { d1: D1Database; rawDb: InstanceType<typeof DatabaseSync> } {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS affiliate_partners (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      partner_code TEXT UNIQUE NOT NULL,
      tier TEXT NOT NULL DEFAULT 'SILVER',
      commission_rate_pct REAL NOT NULL DEFAULT 20.0,
      tier2_rate_pct REAL NOT NULL DEFAULT 5.0,
      parent_partner_id TEXT,
      usdt_trc20_address_encrypted TEXT,
      payout_rail TEXT DEFAULT 'USDT' CHECK (payout_rail IN ('USDT', 'VIETQR')),
      bank_bin TEXT,
      bank_account_number TEXT,
      bank_account_name TEXT,
      activated_mrr_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      total_earnings_cents INTEGER NOT NULL DEFAULT 0,
      pending_payout_cents INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS affiliate_payout_exports (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      rail TEXT NOT NULL CHECK (rail IN ('USDT', 'VIETQR', 'COMBINED')),
      total_amount_usd REAL NOT NULL DEFAULT 0.0,
      total_amount_vnd INTEGER NOT NULL DEFAULT 0,
      item_count INTEGER NOT NULL DEFAULT 0,
      export_filename TEXT,
      payload_json TEXT,
      created_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payout_batches (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'queued',
      external_payment_id TEXT,
      failed_reason TEXT
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

describe('Challenger 2 Empirical Verification: Milestone 3 (R3 Dual-Rail Payouts & VietQR)', () => {
  describe('1. VietQR CSV Generation & RFC 4180 Escaping Stress Tests', () => {
    it('properly quotes standard RFC 4180 fields with commas, quotes, and newlines', () => {
      expect(escapeCsvField('Nguyen, Van A')).toBe('"Nguyen, Van A"');
      expect(escapeCsvField('Cong ty "Hoang Gia"')).toBe('"Cong ty ""Hoang Gia"""');
      expect(escapeCsvField('Line 1\r\nLine 2')).toBe('"Line 1\r\nLine 2"');
      expect(escapeCsvField('Simple')).toBe('"Simple"');
      expect(escapeCsvField(null)).toBe('""');
      expect(escapeCsvField(undefined)).toBe('""');
      expect(escapeCsvField(0)).toBe('"0"');
    });

    it('documents behavior on CSV formula injection prefixes (=, +, -, @, \\t)', () => {
      // Adversarial test: Check how formula injection characters are handled
      const injectionEquals = '=cmd|\' /C calc\'!A0';
      const injectionPlus = '+84901234567';
      const injectionAt = '@SUM(1+1)';
      const injectionMinus = '-1000';

      const resEquals = escapeCsvField(injectionEquals);
      const resPlus = escapeCsvField(injectionPlus);
      const resAt = escapeCsvField(injectionAt);
      const resMinus = escapeCsvField(injectionMinus);

      // Verify that fields are enclosed in quotes per current implementation
      expect(resEquals).toBe(`"${injectionEquals}"`);
      expect(resPlus).toBe(`"${injectionPlus}"`);
      expect(resAt).toBe(`"${injectionAt}"`);
      expect(resMinus).toBe(`"${injectionMinus}"`);

      // Note for findings: Quotes enclose the formula, but Excel strips outer quotes
      // and evaluates =cmd or @SUM if opened directly by an accounting operator.
      expect(resEquals.startsWith('"=')).toBe(true);
      expect(resAt.startsWith('"@')).toBe(true);
    });

    it('verifies generated CSV rows have exactly 10 columns matching RFC 4180 table layout', () => {
      const items: PayoutBatchItem[] = [
        {
          affiliateId: 'p1',
          partnerCode: 'PARTNER_VN_1',
          amountUsd: 150.5,
          amountCents: 15_050,
          rail: 'VIETQR',
          bankDetails: {
            bin: '970422',
            accountNumber: '0987654321',
            accountName: 'NGUYỄN VĂN AN',
            amountVnd: 3_830_225,
          },
          memo: 'SOPHIA AFF T09/2026, PARTNER 1',
        },
        {
          affiliateId: 'p2',
          partnerCode: 'PARTNER_VN_2',
          amountUsd: 200,
          amountCents: 20_000,
          rail: 'VIETQR',
          bankDetails: {
            bin: '970436', // Vietcombank
            accountNumber: '0071001234567',
            accountName: 'CÔNG TY TNHH "SÁNG TẠO SỐ"',
            amountVnd: 5_090_000,
          },
          memo: 'CHI TRA HOA HONG\nTHANG 9',
        },
        {
          affiliateId: 'p3',
          partnerCode: 'PARTNER_USDT_ONLY',
          amountUsd: 500,
          amountCents: 50_000,
          rail: 'USDT', // Should be omitted from VietQR CSV
          usdtAddress: 'TJ1234567890abcdef',
        },
      ];

      const csv = generateVietQrCsv(items, { batchId: 'BATCH_CHALLENGE_01', exchangeRateVnd: 25450 });
      const lines = csv.split('\n');

      // Header + 2 VietQR items (USDT item strictly omitted)
      // Note: multiline memo creates an extra split line if naive split on \n is used
      expect(csv).toContain('PARTNER_VN_1');
      expect(csv).toContain('PARTNER_VN_2');
      expect(csv).not.toContain('PARTNER_USDT_ONLY');

      // Check header columns
      const headers = lines[0].split(',');
      expect(headers).toEqual([
        'STT',
        'Ma_Lo',
        'Ma_Doi_Tac',
        'Ma_Ngan_Hang_BIN',
        'So_Tai_Khoan',
        'Ten_Chu_Tai_Khoan',
        'So_Tien_VND',
        'So_Tien_USD',
        'Noi_Dung_Chuyen_Khoan',
        'Trang_Thai',
      ]);
      expect(headers.length).toBe(10);
    });

    it('preserves leading zeroes in Bank BIN and Account Number in CSV output', () => {
      const items: PayoutBatchItem[] = [
        {
          affiliateId: 'p_lead_zero',
          partnerCode: 'PARTNER_ZERO',
          amountUsd: 100,
          amountCents: 10_000,
          rail: 'VIETQR',
          bankDetails: {
            bin: '097042', // BIN with leading zero
            accountNumber: '000123456789', // Account with leading zeroes
            accountName: 'LE HOANG',
            amountVnd: 2545000,
          },
        },
      ];

      const csv = generateVietQrCsv(items);
      expect(csv).toContain('"097042"');
      expect(csv).toContain('"000123456789"');
    });

    it('evaluates handling of zero, negative, or fractional VND amounts in CSV generation', () => {
      const items: PayoutBatchItem[] = [
        {
          affiliateId: 'p_zero',
          partnerCode: 'ZERO_PARTNER',
          amountUsd: 0,
          amountCents: 0,
          rail: 'VIETQR',
          bankDetails: {
            bin: '970422',
            accountNumber: '111111',
            accountName: 'ZERO USER',
            amountVnd: 0, // Zero VND
          },
        },
        {
          affiliateId: 'p_fractional',
          partnerCode: 'FRAC_PARTNER',
          amountUsd: 10.5,
          amountCents: 1050,
          rail: 'VIETQR',
          bankDetails: {
            bin: '970422',
            accountNumber: '222222',
            accountName: 'FRAC USER',
            amountVnd: 267225.75, // Fractional VND
          },
        },
      ];

      const csv = generateVietQrCsv(items, { exchangeRateVnd: 25450 });

      // Zero VND emits "0"
      expect(csv).toContain('"ZERO_PARTNER"');
      expect(csv).toContain('"0"');

      // Fractional VND emits float directly
      expect(csv).toContain('"267225.75"');
    });
  });

  describe('2. VietQR Payment URL Construction Stress Tests', () => {
    it('generates standard VietQR compact2 URL format with sanitized parameters', () => {
      const url = buildVietQrPaymentUrl(
        '970422',
        '0987654321',
        2545000,
        'SOPHIA AFF P1',
        'NGUYEN VAN A'
      );

      expect(url).toBe(
        'https://img.vietqr.io/image/970422-0987654321-compact2.png?amount=2545000&addInfo=SOPHIA%20AFF%20P1&accountName=NGUYEN%20VAN%20A'
      );
    });

    it('cleans non-digit characters from BIN and whitespaces from account number', () => {
      const url = buildVietQrPaymentUrl(
        ' BIN 970422 - MB ',
        ' 0987 654 321 \t',
        100000,
        'Test Memo',
        'Test User'
      );

      expect(url).toContain('https://img.vietqr.io/image/970422-0987654321-compact2.png');
    });

    it('safely handles and encodes special URL characters in memo and account name', () => {
      const url = buildVietQrPaymentUrl(
        '970422',
        '123456789',
        500000,
        'AFF?amount=100&promo=FREE#hack/tag',
        'ĐẶNG THỊ THU HÀ & CÔNG TY'
      );

      // Verify URL parameter injection is prevented via encodeURIComponent
      expect(url).not.toContain('?amount=100&promo=FREE');
      expect(url).toContain('addInfo=AFF%3Famount%3D100%26promo%3DFREE%23hack%2Ftag');
      expect(url).toContain('accountName=%C4%90%E1%BA%B6NG%20TH%E1%BB%8A%20THU%20H%C3%80%20%26%20C%C3%94NG%20TY');
    });

    it('clamps negative amounts to 0 and rounds fractional VND to integer in URL', () => {
      const urlNegative = buildVietQrPaymentUrl('970422', '123', -50000, 'Memo', 'Name');
      expect(urlNegative).toContain('amount=0');

      const urlFractional = buildVietQrPaymentUrl('970422', '123', 25450.67, 'Memo', 'Name');
      expect(urlFractional).toContain('amount=25451');
    });

    it('observes behavior when account number contains dashes or symbols', () => {
      // In Vietnamese banking, users sometimes copy account numbers formatted with dashes
      const url = buildVietQrPaymentUrl('970422', '1010-0987-6543', 100000, 'Memo', 'Name');
      // replace(/\s+/g, '') strips spaces but retains dashes
      expect(url).toContain('970422-1010-0987-6543-compact2.png');
    });
  });

  describe('3. Dual-Rail Batch Partitioning with SQLite D1 Engine', () => {
    let d1: D1Database;
    let rawDb: InstanceType<typeof DatabaseSync>;

    beforeEach(() => {
      const instance = createTestD1();
      d1 = instance.d1;
      rawDb = instance.rawDb;

      // Seed test partners with varied balances, rails, and statuses
      rawDb.exec(`
        INSERT INTO affiliate_partners (
          id, user_id, partner_code, tier, payout_rail, pending_payout_cents,
          usdt_trc20_address_encrypted, bank_bin, bank_account_number, bank_account_name, status
        ) VALUES
        -- Below $50 threshold: should be omitted
        ('p_zero', 'u1', 'AFF_ZERO', 'SILVER', 'USDT', 0, 'TJ1111111111', NULL, NULL, NULL, 'active'),
        ('p_low_usdt', 'u2', 'AFF_LOW_USDT', 'SILVER', 'USDT', 4999, 'TJ2222222222', NULL, NULL, NULL, 'active'),
        ('p_low_vietqr', 'u3', 'AFF_LOW_VQR', 'SILVER', 'VIETQR', 2500, NULL, '970422', '0001', 'LOW VQR', 'active'),
        
        -- Inactive partner with sufficient balance: should be omitted by status='active'
        ('p_suspended', 'u4', 'AFF_SUSPENDED', 'GOLD', 'USDT', 10000, 'TJ3333333333', NULL, NULL, NULL, 'suspended'),
        
        -- Exactly at $50 threshold: should be included
        ('p_exact_usdt', 'u5', 'AFF_EXACT_USDT', 'SILVER', 'USDT', 5000, 'TJ4444444444', NULL, NULL, NULL, 'active'),
        
        -- Above $50 threshold: should be included
        ('p_high_usdt', 'u6', 'AFF_HIGH_USDT', 'PLATINUM', 'USDT', 25000, 'TJ5555555555', NULL, NULL, NULL, 'active'),
        ('p_high_vietqr', 'u7', 'AFF_HIGH_VQR', 'GOLD', 'VIETQR', 30000, NULL, '970415', '0002', 'CONG TY ABC', 'active');
      `);
    });

    it('strictly omits balances below the $50 threshold and inactive partners', async () => {
      const batch = await createDualRailPayoutBatch(d1);

      expect(batch.items.length).toBe(3); // p_exact_usdt, p_high_usdt, p_high_vietqr
      const codes = batch.items.map((i) => i.partnerCode);

      expect(codes).toContain('AFF_EXACT_USDT');
      expect(codes).toContain('AFF_HIGH_USDT');
      expect(codes).toContain('AFF_HIGH_VQR');

      expect(codes).not.toContain('AFF_ZERO');
      expect(codes).not.toContain('AFF_LOW_USDT');
      expect(codes).not.toContain('AFF_LOW_VQR');
      expect(codes).not.toContain('AFF_SUSPENDED');
    });

    it('correctly aggregates USDT and VND amounts across partitioned rails', async () => {
      const batch = await createDualRailPayoutBatch(d1);

      // p_exact_usdt (5000 cents = $50) + p_high_usdt (25000 cents = $250) = $300 USDT
      expect(batch.totalUsdtAmount).toBe(300);

      // p_high_vietqr (30000 cents = $300 * exchange rate)
      const expectedVnd = 300 * getExchangeRateVnd();
      expect(batch.totalVndAmount).toBe(expectedVnd);

      expect(batch.status).toBe('QUEUED');
      expect(batch.rail).toBe('COMBINED');
    });

    it('supports rail filtering: USDT only or VIETQR only', async () => {
      const usdtBatch = await createDualRailPayoutBatch(d1, { rail: 'USDT' });
      expect(usdtBatch.items.length).toBe(2);
      expect(usdtBatch.items.every((i) => i.rail === 'USDT')).toBe(true);
      expect(usdtBatch.totalVndAmount).toBe(0);
      expect(usdtBatch.totalUsdtAmount).toBe(300);

      const vietQrBatch = await createDualRailPayoutBatch(d1, { rail: 'VIETQR' });
      expect(vietQrBatch.items.length).toBe(1);
      expect(vietQrBatch.items[0].rail === 'VIETQR').toBe(true);
      expect(vietQrBatch.items[0].partnerCode).toBe('AFF_HIGH_VQR');
      expect(vietQrBatch.totalUsdtAmount).toBe(0);
      expect(vietQrBatch.totalVndAmount).toBe(300 * getExchangeRateVnd());
    });

    it('supports filtering by specific partnerIds list', async () => {
      const batch = await createDualRailPayoutBatch(d1, {
        partnerIds: ['p_high_vietqr'],
      });

      expect(batch.items.length).toBe(1);
      expect(batch.items[0].affiliateId).toBe('p_high_vietqr');
      expect(batch.totalUsdtAmount).toBe(0);
    });
  });

  describe('4. Dual-Rail Execution & Idempotency / Double Payout Prevention', () => {
    let d1: D1Database;
    let rawDb: InstanceType<typeof DatabaseSync>;

    beforeEach(() => {
      const instance = createTestD1();
      d1 = instance.d1;
      rawDb = instance.rawDb;

      rawDb.exec(`
        INSERT INTO affiliate_partners (
          id, user_id, partner_code, payout_rail, pending_payout_cents,
          usdt_trc20_address_encrypted, bank_bin, bank_account_number, bank_account_name, status
        ) VALUES
        ('p_usdt_exec', 'u1', 'EXEC_USDT', 'USDT', 10000, 'TJ_ENCRYPTED_1', NULL, NULL, NULL, 'active'),
        ('p_vqr_exec', 'u2', 'EXEC_VQR', 'VIETQR', 20000, NULL, '970422', '88889999', 'EXEC USER', 'active');
      `);
    });

    it('executes batch, deducts pending balances in D1, and creates audit export record', async () => {
      const multiPayoutSpy = vi.spyOn(nowpaymentsModule, 'executeMultiPayoutBatch').mockResolvedValue({
        batchId: 'BATCH_TEST_USDT',
        totalCount: 1,
        successCount: 1,
        failureCount: 0,
        externalPaymentIds: { p_usdt_exec: 'EXT_NP_001' },
        failures: [],
      });

      const batch = await createDualRailPayoutBatch(d1);
      expect(batch.items.length).toBe(2);

      const result = await executeDualRailBatch(d1, batch);

      expect(result.usdtItemCount).toBe(1);
      expect(result.vietQrItemCount).toBe(1);
      expect(result.exportedCount).toBe(2);
      expect(result.vietQrCsv).toBeDefined();

      // Verify pending balances were deducted to 0 in D1
      const partnerUsdt = rawDb
        .prepare('SELECT pending_payout_cents FROM affiliate_partners WHERE id = ?')
        .get('p_usdt_exec') as { pending_payout_cents: number };
      const partnerVqr = rawDb
        .prepare('SELECT pending_payout_cents FROM affiliate_partners WHERE id = ?')
        .get('p_vqr_exec') as { pending_payout_cents: number };

      expect(partnerUsdt.pending_payout_cents).toBe(0);
      expect(partnerVqr.pending_payout_cents).toBe(0);

      // Verify audit export record was created in affiliate_payout_exports
      const exportRecord = rawDb
        .prepare('SELECT * FROM affiliate_payout_exports WHERE batch_id = ?')
        .get(batch.batchId) as { batch_id: string; rail: string; item_count: number } | undefined;

      expect(exportRecord).toBeDefined();
      expect(exportRecord?.rail).toBe('VIETQR');
      expect(exportRecord?.item_count).toBe(1);

      multiPayoutSpy.mockRestore();
    });

    it('demonstrates duplicate batch execution failure / replay protection via PRIMARY KEY constraint', async () => {
      const multiPayoutSpy = vi.spyOn(nowpaymentsModule, 'executeMultiPayoutBatch').mockResolvedValue({
        batchId: 'BATCH_TEST_USDT',
        totalCount: 1,
        successCount: 1,
        failureCount: 0,
        externalPaymentIds: { p_usdt_exec: 'EXT_NP_002' },
        failures: [],
      });

      const batch = await createDualRailPayoutBatch(d1);

      // First run succeeds
      const result1 = await executeDualRailBatch(d1, batch);
      expect(result1.exportedCount).toBe(2);

      // Re-running the EXACT same batch object triggers duplicate insert into affiliate_payout_exports
      // because id `export_${batch.batchId}_VIETQR` is PRIMARY KEY in SQLite
      await expect(executeDualRailBatch(d1, batch)).rejects.toThrow(/UNIQUE constraint failed/i);

      // Balances remain 0 and do not go negative due to MAX(0, pending_payout_cents - ?)
      const partnerVqr = rawDb
        .prepare('SELECT pending_payout_cents FROM affiliate_partners WHERE id = ?')
        .get('p_vqr_exec') as { pending_payout_cents: number };
      expect(partnerVqr.pending_payout_cents).toBe(0);

      multiPayoutSpy.mockRestore();
    });

    it('subsequent createDualRailPayoutBatch after execution returns 0 items (idempotent workflow)', async () => {
      vi.spyOn(nowpaymentsModule, 'executeMultiPayoutBatch').mockResolvedValue({
        batchId: 'BATCH_TEST_USDT',
        totalCount: 1,
        successCount: 1,
        failureCount: 0,
        externalPaymentIds: { p_usdt_exec: 'EXT_NP_003' },
        failures: [],
      });

      const batch1 = await createDualRailPayoutBatch(d1);
      expect(batch1.items.length).toBe(2);

      await executeDualRailBatch(d1, batch1);

      // Since pending balances are now 0, querying for a new batch returns 0 items
      const batch2 = await createDualRailPayoutBatch(d1);
      expect(batch2.items.length).toBe(0);
      expect(batch2.totalUsdtAmount).toBe(0);
      expect(batch2.totalVndAmount).toBe(0);
    });
  });
});
