/** @vitest-environment node */

/**
 * Unit Test Suite: 70/30 Royalty Engine & Payout Reconciliation
 *
 * Validates:
 * 1. Pure integer cent arithmetic & Zero Penny Leakage Invariant across 1,000 prices
 * 2. Anti-circular self-activation guard (throws 'SELF_TEMPLATE_ACTIVATION_PROHIBITED')
 * 3. OCC CAS monotonic sequence numbering on creator_earnings_ledger in D1 (in-memory SQLite)
 * 4. Idempotent deduplication probe
 * 5. Payout reconciliation:
 *    - Minimum $50.00 (5,000 cents) threshold
 *    - Dual-rail validation (USDT format, VietQR 6-digit NAPAS BIN)
 *    - Solvency verification
 *    - Negative debit ledger entry
 *
 * @module tree/marketplace/__tests__/royalty-engine.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import {
  calculateRoyaltySplit,
  isSelfTemplateActivation,
  validatePayoutRail,
  accrueRoyalty,
  processCreatorWithdrawal,
  getCreatorBalance,
  MIN_WITHDRAWAL_CENTS,
} from '../royalty-engine';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

describe('70/30 Royalty Engine & Smart Ledger — Unit Tests', () => {
  let rawDb: InstanceType<typeof DatabaseSync>;
  let d1: ReturnType<typeof makeD1>;

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    // Bootstrap D1 tables required for royalties and ledger
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS creator_earnings_ledger (
        id TEXT PRIMARY KEY,
        creator_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        event_type TEXT NOT NULL DEFAULT 'royalty_accrual',
        source_type TEXT NOT NULL DEFAULT 'blueprint_remix',
        reference_id TEXT NOT NULL,
        balance_after_cents INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        sequence_num INTEGER NOT NULL DEFAULT 1,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        UNIQUE(creator_id, reference_id, event_type),
        UNIQUE(creator_id, sequence_num)
      );

      CREATE TABLE IF NOT EXISTS creator_withdrawal_requests (
        id TEXT PRIMARY KEY,
        creator_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        rail TEXT NOT NULL CHECK (rail IN ('USDT', 'VIETQR')),
        destination_address TEXT,
        bank_bin TEXT,
        bank_account_number TEXT,
        bank_account_name TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        tx_hash TEXT,
        admin_notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    d1 = makeD1(rawDb);
  });

  describe('Zero Penny Leakage Invariant & 70/30 Split Math', () => {
    it('verifies creatorCents + platformCents === priceCents across 1,000 prices', () => {
      // Test known edge cases
      const edgePrices = [0, 1, 2, 3, 4, 7, 10, 33, 99, 100, 101, 149, 150, 499, 500, 999, 1000, 9999, 100000];
      for (const p of edgePrices) {
        const split = calculateRoyaltySplit(p, 70.0);
        expect(split.creatorCents + split.platformCents).toBe(p);
        expect(split.creatorCents).toBe(Math.floor((p * 70) / 100));
        expect(split.platformCents).toBe(p - split.creatorCents);
      }

      // Test 1,000 random prices
      for (let i = 0; i < 1000; i++) {
        const randomPrice = Math.floor(Math.random() * 50000);
        const split = calculateRoyaltySplit(randomPrice, 70.0);
        expect(split.creatorCents + split.platformCents).toBe(randomPrice);
        expect(split.creatorCents).toBe(Math.floor((randomPrice * 70) / 100));
        expect(split.platformCents).toBe(randomPrice - split.creatorCents);
      }
    });

    it('handles zero and negative prices safely', () => {
      expect(calculateRoyaltySplit(0)).toEqual({ creatorCents: 0, platformCents: 0, totalCents: 0 });
      expect(calculateRoyaltySplit(-500)).toEqual({ creatorCents: 0, platformCents: 0, totalCents: 0 });
    });

    it('handles custom royalty rates (0%, 50%, 100%) without leakage', () => {
      expect(calculateRoyaltySplit(100, 0)).toEqual({ creatorCents: 0, platformCents: 100, totalCents: 100 });
      expect(calculateRoyaltySplit(100, 100)).toEqual({ creatorCents: 100, platformCents: 0, totalCents: 100 });
      expect(calculateRoyaltySplit(101, 50)).toEqual({ creatorCents: 50, platformCents: 51, totalCents: 101 });
    });
  });

  describe('Anti-Circular Self-Activation Guard', () => {
    it('detects circular self-activation correctly', () => {
      expect(isSelfTemplateActivation('usr_creator_123', 'usr_creator_123')).toBe(true);
      expect(isSelfTemplateActivation('usr_creator_123  ', '  usr_creator_123')).toBe(true);
      expect(isSelfTemplateActivation('usr_creator_123', 'usr_buyer_456')).toBe(false);
    });

    it('throws SELF_TEMPLATE_ACTIVATION_PROHIBITED when creator activates their own template', async () => {
      await expect(
        accrueRoyalty({
          db: d1 as any,
          templateId: 'tpl_100',
          creatorId: 'user_same',
          activatingUserId: 'user_same',
          tenantId: 'tenant_1',
          priceCents: 1000,
        }),
      ).rejects.toThrow('SELF_TEMPLATE_ACTIVATION_PROHIBITED');
    });
  });

  describe('OCC CAS Monotonic Sequence & Ledger Accrual', () => {
    it('records first accrual with sequence_num = 1 and accurate balance', async () => {
      const result = await accrueRoyalty({
        db: d1 as any,
        templateId: 'tpl_alpha',
        creatorId: 'creator_test_1',
        activatingUserId: 'buyer_test_1',
        tenantId: 'tenant_1',
        priceCents: 1000, // 700 creator / 300 platform
      });

      expect(result.success).toBe(true);
      expect(result.creatorCents).toBe(700);
      expect(result.platformCents).toBe(300);
      expect(result.sequenceNum).toBe(1);
      expect(result.balanceAfterCents).toBe(700);

      const balance = await getCreatorBalance(d1 as any, 'creator_test_1');
      expect(balance.availableBalanceCents).toBe(700);
      expect(balance.totalEarnedCents).toBe(700);
      expect(balance.lastSequenceNum).toBe(1);
    });

    it('increments sequence_num monotonically on subsequent activations', async () => {
      const creatorId = 'creator_test_2';

      // Accrual 1: $10.00 -> $7.00
      const r1 = await accrueRoyalty({
        db: d1 as any,
        templateId: 'tpl_1',
        creatorId,
        activatingUserId: 'buyer_1',
        tenantId: 'tenant_1',
        priceCents: 1000,
      });
      expect(r1.sequenceNum).toBe(1);
      expect(r1.balanceAfterCents).toBe(700);

      // Accrual 2: $20.00 -> $14.00
      const r2 = await accrueRoyalty({
        db: d1 as any,
        templateId: 'tpl_2',
        creatorId,
        activatingUserId: 'buyer_2',
        tenantId: 'tenant_1',
        priceCents: 2000,
      });
      expect(r2.sequenceNum).toBe(2);
      expect(r2.balanceAfterCents).toBe(2100);

      // Accrual 3: $5.00 -> $3.50 (350 cents)
      const r3 = await accrueRoyalty({
        db: d1 as any,
        templateId: 'tpl_3',
        creatorId,
        activatingUserId: 'buyer_3',
        tenantId: 'tenant_1',
        priceCents: 500,
      });
      expect(r3.sequenceNum).toBe(3);
      expect(r3.balanceAfterCents).toBe(2450);

      const summary = await getCreatorBalance(d1 as any, creatorId);
      expect(summary.availableBalanceCents).toBe(2450);
      expect(summary.totalEarnedCents).toBe(2450);
      expect(summary.lastSequenceNum).toBe(3);
    });

    it('proves idempotency: repeated call with same referenceId returns existing entry', async () => {
      const creatorId = 'creator_idempotent';
      const refId = 'act_fixed_ref_999';

      const first = await accrueRoyalty({
        db: d1 as any,
        templateId: 'tpl_idem',
        creatorId,
        activatingUserId: 'buyer_x',
        tenantId: 'tenant_1',
        priceCents: 1500, // 1050 cents
        referenceId: refId,
      });

      const second = await accrueRoyalty({
        db: d1 as any,
        templateId: 'tpl_idem',
        creatorId,
        activatingUserId: 'buyer_x',
        tenantId: 'tenant_1',
        priceCents: 1500,
        referenceId: refId,
      });

      expect(second.ledgerId).toBe(first.ledgerId);
      expect(second.sequenceNum).toBe(first.sequenceNum);
      expect(second.balanceAfterCents).toBe(first.balanceAfterCents);

      const bal = await getCreatorBalance(d1 as any, creatorId);
      expect(bal.lastSequenceNum).toBe(1); // Not incremented twice
      expect(bal.availableBalanceCents).toBe(1050);
    });
  });

  describe('Dual-Rail Payout Reconciliation (VietQR & USDT)', () => {
    it('enforces minimum withdrawal of $50.00 (5,000 cents)', async () => {
      await expect(
        processCreatorWithdrawal({
          db: d1 as any,
          creatorId: 'cr_1',
          amountCents: 4999,
          rail: 'USDT',
          destinationAddress: '0x1234567890abcdef1234567890abcdef12345678',
        }),
      ).rejects.toThrow('MINIMUM_WITHDRAWAL_5000_CENTS');
    });

    it('validates USDT address format', () => {
      // Valid ERC20
      expect(() =>
        validatePayoutRail('USDT', {
          destinationAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
        }),
      ).not.toThrow();

      // Valid TRC20
      expect(() =>
        validatePayoutRail('USDT', {
          destinationAddress: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd3MmGVja',
        }),
      ).not.toThrow();

      // Too short
      expect(() =>
        validatePayoutRail('USDT', {
          destinationAddress: '0x123',
        }),
      ).toThrow('INVALID_USDT_ADDRESS');

      // Malformed characters
      expect(() =>
        validatePayoutRail('USDT', {
          destinationAddress: 'invalid wallet with spaces!!',
        }),
      ).toThrow('INVALID_USDT_ADDRESS');
    });

    it('validates VietQR NAPAS banking details', () => {
      // Valid VietQR
      expect(() =>
        validatePayoutRail('VIETQR', {
          bankBin: '970422', // MB Bank
          bankAccountNumber: '0987654321',
          bankAccountName: 'NGUYEN VAN A',
        }),
      ).not.toThrow();

      // Invalid BIN (not 6 digits)
      expect(() =>
        validatePayoutRail('VIETQR', {
          bankBin: '97042',
          bankAccountNumber: '0987654321',
          bankAccountName: 'NGUYEN VAN A',
        }),
      ).toThrow('INVALID_VIETQR_BIN');

      // Missing account number
      expect(() =>
        validatePayoutRail('VIETQR', {
          bankBin: '970422',
          bankAccountNumber: '',
          bankAccountName: 'NGUYEN VAN A',
        }),
      ).toThrow('INVALID_VIETQR_ACCOUNT_NUMBER');

      // Missing account name
      expect(() =>
        validatePayoutRail('VIETQR', {
          bankBin: '970422',
          bankAccountNumber: '0987654321',
          bankAccountName: 'N',
        }),
      ).toThrow('INVALID_VIETQR_ACCOUNT_NAME');
    });

    it('throws INSUFFICIENT_CREATOR_BALANCE when creator attempts overdraft', async () => {
      const creatorId = 'creator_poor';

      // Accrue only $20.00
      await accrueRoyalty({
        db: d1 as any,
        templateId: 'tpl_sm',
        creatorId,
        activatingUserId: 'buyer_z',
        tenantId: 'tenant_1',
        priceCents: 2000, // creator gets $14.00 (1400 cents)
      });

      // Try to withdraw $50.00 (5000 cents)
      await expect(
        processCreatorWithdrawal({
          db: d1 as any,
          creatorId,
          amountCents: 5000,
          rail: 'USDT',
          destinationAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
        }),
      ).rejects.toThrow('INSUFFICIENT_CREATOR_BALANCE');
    });

    it('executes successful withdrawal with negative debit ledger entry and updates balance', async () => {
      const creatorId = 'creator_rich';

      // Accrue $100.00 -> $70.00 (7,000 cents)
      await accrueRoyalty({
        db: d1 as any,
        templateId: 'tpl_big',
        creatorId,
        activatingUserId: 'buyer_rich',
        tenantId: 'tenant_1',
        priceCents: 10000,
      });

      // Withdraw $50.00 (5,000 cents) via VietQR
      const payoutResult = await processCreatorWithdrawal({
        db: d1 as any,
        creatorId,
        amountCents: 5000,
        rail: 'VIETQR',
        bankBin: '970436', // Vietcombank
        bankAccountNumber: '1234567890',
        bankAccountName: 'TRAN THI B',
        txHash: 'VNPAY_TRACE_987654',
      });

      expect(payoutResult.success).toBe(true);
      expect(payoutResult.amountCents).toBe(5000);
      expect(payoutResult.rail).toBe('VIETQR');
      expect(payoutResult.status).toBe('completed');
      expect(payoutResult.sequenceNum).toBe(2);
      expect(payoutResult.remainingBalanceCents).toBe(2000); // 7000 - 5000 = 2000

      // Verify balance summary
      const summary = await getCreatorBalance(d1 as any, creatorId);
      expect(summary.totalEarnedCents).toBe(7000);
      expect(summary.totalWithdrawnCents).toBe(5000);
      expect(summary.availableBalanceCents).toBe(2000);
      expect(summary.lastSequenceNum).toBe(2);
    });
  });
});
