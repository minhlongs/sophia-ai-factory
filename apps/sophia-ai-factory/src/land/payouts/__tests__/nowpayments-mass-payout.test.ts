import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeMultiPayoutBatch,
  exportBankReconciliationCsv,
  queueBatch,
  type BankReconciliationRecord,
} from '../nowpayments-mass-payout';
import * as dbClient from '@/seed/db/client';

describe('NOWPayments Mass Payout & Bank Reconciliation Fallback', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn(),
    };
    vi.spyOn(dbClient, 'getD1').mockResolvedValue(mockDb);
  });

  describe('executeMultiPayoutBatch', () => {
    it('executes mass payout batch across multiple partners in mock mode', async () => {
      const originalKey = process.env.NOWPAYMENTS_API_KEY;
      delete process.env.NOWPAYMENTS_API_KEY;

      // Mock payout_batches status checks and updates
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null), // not existing yet
        run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      });

      const batchInput = {
        batchId: 'batch_20260922_01',
        items: [
          {
            partnerId: 'partner_alice',
            partnerCode: 'ALICE88',
            totalCents: 5000, // $50.00
            recipientAddrEncrypted: 'mock_enc_addr_1',
            network: 'TRC20',
          },
          {
            partnerId: 'partner_bob',
            partnerCode: 'BOB99',
            totalCents: 12000, // $120.00
            recipientAddrEncrypted: 'mock_enc_addr_2',
            network: 'TRC20',
          },
        ],
      };

      const result = await executeMultiPayoutBatch(batchInput);
      expect(result.batchId).toBe('batch_20260922_01');
      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.failures).toHaveLength(0);
      expect(result.externalPaymentIds['partner_alice']).toMatch(/^mock_batch_20260922_01_partner_alice_/);
      expect(result.externalPaymentIds['partner_bob']).toMatch(/^mock_batch_20260922_01_partner_bob_/);

      if (originalKey) process.env.NOWPAYMENTS_API_KEY = originalKey;
    });

    it('handles individual partner failure without crashing whole batch', async () => {
      const originalKey = process.env.NOWPAYMENTS_API_KEY;
      delete process.env.NOWPAYMENTS_API_KEY;

      mockDb.prepare.mockImplementation((sql: string) => {
        return {
          bind: vi.fn().mockImplementation((...args: any[]) => {
            if (args.some((a) => typeof a === 'string' && a.includes('partner_2'))) {
              throw new Error('D1 simulated failure on partner 2');
            }
            return {
              first: vi.fn().mockResolvedValue(null),
              run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
            };
          }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        };
      });

      const batchInput = {
        batchId: 'batch_error_test',
        items: [
          {
            partnerId: 'partner_1',
            totalCents: 5000,
            recipientAddrEncrypted: 'mock_enc_1',
          },
          {
            partnerId: 'partner_2',
            totalCents: 8000,
            recipientAddrEncrypted: 'mock_enc_2',
          },
        ],
      };

      const result = await executeMultiPayoutBatch(batchInput);
      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].partnerId).toBe('partner_2');
      expect(result.failures[0].error).toContain('simulated failure on partner 2');

      if (originalKey) process.env.NOWPAYMENTS_API_KEY = originalKey;
    });
  });

  describe('exportBankReconciliationCsv', () => {
    it('generates standard RFC-4180 CSV with headers and formatted values', () => {
      const records: BankReconciliationRecord[] = [
        {
          batchId: 'batch_rec_01',
          affiliateId: 'aff_vn_01',
          partnerCode: 'CREATOR_VN',
          payoutMethod: 'payos_vietqr',
          recipientAddressOrAccount: 'VCB, 1029384756',
          amountCents: 10000, // $100.00
          status: 'settled',
          createdAt: 1710000000000,
          vndRate: 25450,
        },
        {
          batchId: 'batch_rec_01',
          affiliateId: 'aff_us_02',
          partnerCode: 'US_AUTOMATION',
          payoutMethod: 'usdt_trc20',
          recipientAddressOrAccount: 'TY5M4fH328djs9982kdjsa9018',
          amountCents: 5000, // $50.00
          status: 'confirmed',
          createdAt: '2026-09-22T15:00:00.000Z',
          vndRate: 25450,
        },
      ];

      const csv = exportBankReconciliationCsv(records);
      const lines = csv.split('\n');

      expect(lines.length).toBe(3); // header + 2 records
      expect(lines[0]).toBe(
        'batch_id,affiliate_id,partner_code,payout_method,recipient_account_or_address,amount_cents,amount_usd,amount_vnd,status,created_at'
      );

      // Record 1 check
      expect(lines[1]).toContain('"batch_rec_01"');
      expect(lines[1]).toContain('"aff_vn_01"');
      expect(lines[1]).toContain('"CREATOR_VN"');
      expect(lines[1]).toContain('"VCB, 1029384756"'); // correctly quoted with comma
      expect(lines[1]).toContain('"10000"');
      expect(lines[1]).toContain('"100.00"'); // amount_usd
      expect(lines[1]).toContain('"2545000"'); // 100 * 25450 = 2,545,000 VND
      expect(lines[1]).toContain('"settled"');

      // Record 2 check
      expect(lines[2]).toContain('"US_AUTOMATION"');
      expect(lines[2]).toContain('"usdt_trc20"');
      expect(lines[2]).toContain('"50.00"');
      expect(lines[2]).toContain('"1272500"'); // 50 * 25450 = 1,272,500 VND
    });

    it('escapes fields containing double quotes or line breaks', () => {
      const records: BankReconciliationRecord[] = [
        {
          batchId: 'batch_escape',
          affiliateId: 'aff_quotes',
          partnerCode: 'PARTNER_"VIP"',
          payoutMethod: 'bank_account',
          recipientAddressOrAccount: 'Account with "special" chars',
          amountCents: 2000,
          status: 'pending',
        },
      ];

      const csv = exportBankReconciliationCsv(records);
      expect(csv).toContain('PARTNER_""VIP""');
      expect(csv).toContain('Account with ""special"" chars');
    });
  });
});
