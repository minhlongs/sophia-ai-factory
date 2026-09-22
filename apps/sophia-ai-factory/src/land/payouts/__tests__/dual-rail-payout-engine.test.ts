import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  escapeCsvField,
  getExchangeRateVnd,
  buildVietQrPaymentUrl,
  generateVietQrCsv,
  createDualRailPayoutBatch,
  executeDualRailBatch,
  DEFAULT_USD_TO_VND_RATE,
} from '../dual-rail-payout-engine';
import * as nowpaymentsModule from '../nowpayments-mass-payout';
import { PayoutBatchItem, DualRailPayoutBatch } from '@/seed/types/affiliate-expansion-types';

describe('Dual-Rail Affiliate Payout Engine', () => {
  describe('CSV & VietQR URL Helpers', () => {
    it('escapeCsvField escapes strings with commas, quotes, and newlines per RFC 4180', () => {
      expect(escapeCsvField('normal')).toBe('"normal"');
      expect(escapeCsvField('hello, world')).toBe('"hello, world"');
      expect(escapeCsvField('with "quotes"')).toBe('"with ""quotes"""');
      expect(escapeCsvField(null)).toBe('""');
      expect(escapeCsvField(undefined)).toBe('""');
    });

    it('getExchangeRateVnd reads env var or defaults to 25,450', () => {
      // In test env, USD_TO_VND is set to 25000 in .env.test
      expect(getExchangeRateVnd()).toBe(25000);

      const originalEnv = process.env.USD_TO_VND;
      delete process.env.USD_TO_VND;
      try {
        expect(getExchangeRateVnd()).toBe(DEFAULT_USD_TO_VND_RATE); // 25450
      } finally {
        process.env.USD_TO_VND = originalEnv;
      }
    });

    it('buildVietQrPaymentUrl formats proper VietQR image URL with parameters', () => {
      const url = buildVietQrPaymentUrl(
        '970422',
        '0987654321',
        2545000,
        'SOPHIA AFF P1',
        'NGUYEN VAN A'
      );

      expect(url).toContain('https://img.vietqr.io/image/970422-0987654321-compact2.png');
      expect(url).toContain('amount=2545000');
      expect(url).toContain('addInfo=SOPHIA%20AFF%20P1');
      expect(url).toContain('accountName=NGUYEN%20VAN%20A');
    });

    it('generateVietQrCsv creates RFC 4180 CSV with Vietnamese banking columns', () => {
      const items: PayoutBatchItem[] = [
        {
          affiliateId: 'p1',
          partnerCode: 'VN_PARTNER_01',
          amountUsd: 100,
          amountCents: 10_000,
          rail: 'VIETQR',
          bankDetails: {
            bin: '970422',
            accountNumber: '123456789',
            accountName: 'TRAN VAN B',
            amountVnd: 2_545_000,
          },
          memo: 'SOPHIA AFF VN_PARTNER_01',
        },
        {
          affiliateId: 'p2',
          partnerCode: 'US_PARTNER_02',
          amountUsd: 200,
          amountCents: 20_000,
          rail: 'USDT', // Should be skipped in VietQR domestic export
        },
      ];

      const csv = generateVietQrCsv(items, { exchangeRateVnd: 25450, batchId: 'BATCH_TEST_01' });
      const lines = csv.split('\n');

      expect(lines.length).toBe(2); // Header + 1 VietQR row (USDT row ignored)
      expect(lines[0]).toBe(
        'STT,Ma_Lo,Ma_Doi_Tac,Ma_Ngan_Hang_BIN,So_Tai_Khoan,Ten_Chu_Tai_Khoan,So_Tien_VND,So_Tien_USD,Noi_Dung_Chuyen_Khoan,Trang_Thai'
      );
      expect(lines[1]).toContain('"VN_PARTNER_01"');
      expect(lines[1]).toContain('"970422"');
      expect(lines[1]).toContain('"123456789"');
      expect(lines[1]).toContain('"TRAN VAN B"');
      expect(lines[1]).toContain('"2545000"');
      expect(lines[1]).toContain('"100.00"');
    });
  });

  describe('D1 Database Batch Creation & Execution', () => {
    let mockD1: {
      prepare: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockD1 = {
        prepare: vi.fn(),
      };
    });

    it('createDualRailPayoutBatch splits partners into USDT and VietQR rails', async () => {
      const selectStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'p_usdt',
              partner_code: 'CRYPTO_WHALE',
              payout_rail: 'USDT',
              pending_payout_cents: 15_000, // $150.00
              usdt_trc20_address_encrypted: 'TJ1234567890abcdef',
              bank_bin: null,
              bank_account_number: null,
              bank_account_name: null,
            },
            {
              id: 'p_vietqr',
              partner_code: 'SAIGON_AGENCY',
              payout_rail: 'VIETQR',
              pending_payout_cents: 20_000, // $200.00
              usdt_trc20_address_encrypted: null,
              bank_bin: '970415',
              bank_account_number: '101009876543',
              bank_account_name: 'CONG TY SAIGON',
            },
          ],
        }),
      };

      mockD1.prepare.mockReturnValueOnce(selectStmt);

      const batch = await createDualRailPayoutBatch(mockD1 as unknown as D1Database, {
        minPayoutCents: 5000,
      });

      expect(batch.items.length).toBe(2);
      expect(batch.totalUsdtAmount).toBe(150);
      expect(batch.totalVndAmount).toBe(200 * getExchangeRateVnd());

      const usdtItem = batch.items.find((i) => i.rail === 'USDT');
      expect(usdtItem?.affiliateId).toBe('p_usdt');
      expect(usdtItem?.usdtAddress).toBe('TJ1234567890abcdef');

      const vietQrItem = batch.items.find((i) => i.rail === 'VIETQR');
      expect(vietQrItem?.affiliateId).toBe('p_vietqr');
      expect(vietQrItem?.bankDetails?.bin).toBe('970415');
      expect(vietQrItem?.bankDetails?.accountName).toBe('CONG TY SAIGON');
    });

    it('executeDualRailBatch executes USDT payouts and records VietQR CSV export', async () => {
      const executeMultiPayoutSpy = vi.spyOn(nowpaymentsModule, 'executeMultiPayoutBatch').mockResolvedValue({
        batchId: 'BATCH_1_USDT',
        totalCount: 1,
        successCount: 1,
        failureCount: 0,
        externalPaymentIds: { p_usdt: 'EXT_NP_9988' },
        failures: [],
      });

      const batch: DualRailPayoutBatch = {
        batchId: 'BATCH_DUAL_TEST',
        createdAt: new Date().toISOString(),
        rail: 'COMBINED',
        totalUsdtAmount: 100,
        totalVndAmount: 2545000,
        itemCount: 2,
        status: 'QUEUED',
        items: [
          {
            affiliateId: 'p_usdt',
            partnerCode: 'USDT_AFF',
            amountUsd: 100,
            amountCents: 10000,
            rail: 'USDT',
            usdtAddress: 'TJ_ENCRYPTED_ADDR',
          },
          {
            affiliateId: 'p_vietqr',
            partnerCode: 'VIETQR_AFF',
            amountUsd: 100,
            amountCents: 10000,
            rail: 'VIETQR',
            bankDetails: {
              bin: '970422',
              accountNumber: '0987654321',
              accountName: 'NGUYEN A',
              amountVnd: 2545000,
            },
          },
        ],
      };

      const updateUsdtBalanceStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };
      const insertExportStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };
      const updateVietQrBalanceStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      mockD1.prepare
        .mockReturnValueOnce(updateUsdtBalanceStmt)
        .mockReturnValueOnce(insertExportStmt)
        .mockReturnValueOnce(updateVietQrBalanceStmt);

      const result = await executeDualRailBatch(mockD1 as unknown as D1Database, batch);

      expect(executeMultiPayoutSpy).toHaveBeenCalledTimes(1);
      expect(result.usdtResult?.successCount).toBe(1);
      expect(result.vietQrItemCount).toBe(1);
      expect(result.usdtItemCount).toBe(1);
      expect(result.vietQrCsv).toBeDefined();
      expect(result.exportedCount).toBe(2);

      // Verify D1 balance deductions were triggered for both partners
      expect(updateUsdtBalanceStmt.bind).toHaveBeenCalledWith(10000, expect.any(Number), 'p_usdt');
      expect(updateVietQrBalanceStmt.bind).toHaveBeenCalledWith(10000, expect.any(Number), 'p_vietqr');

      executeMultiPayoutSpy.mockRestore();
    });
  });
});
