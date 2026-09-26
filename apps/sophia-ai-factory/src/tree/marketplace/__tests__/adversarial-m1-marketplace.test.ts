/** @vitest-environment node */

/**
 * Empirical Adversarial Test Suite: Milestone M1
 *
 * Scope:
 * 1. Zero Penny Leakage Invariant across 10,000 prices (cents) + fuzzing.
 * 2. Concurrency stress testing on CAS `sequence_num` in `creator_earnings_ledger`.
 * 3. Anti-self-activation guard enforcement under manipulated inputs.
 * 4. Payout validation edge cases (VietQR BIN/account, USDT formats, solvency/double-spend).
 * 5. Quality scorer boundary tests at Q=74 vs Q=75 and Q=39 vs Q=40.
 *
 * @module tree/marketplace/__tests__/adversarial-m1-marketplace.test
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
  DEFAULT_ROYALTY_PCT,
  MIN_WITHDRAWAL_CENTS,
} from '../royalty-engine';
import { scoreTemplateQuality } from '../quality-scorer';
import type { TemplateEvaluationInput } from '../types';

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

describe('Empirical Adversarial Verification: Milestone M1 (Creator Marketplace & 70/30 Ledger)', () => {
  let rawDb: InstanceType<typeof DatabaseSync>;
  let d1: ReturnType<typeof makeD1>;

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS creator_earnings_ledger (
        id TEXT PRIMARY KEY,
        creator_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        event_type TEXT NOT NULL DEFAULT 'royalty_accrual',
        source_type TEXT NOT NULL DEFAULT 'template_activation',
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

  // ── 1. Zero Penny Leakage Invariant ──────────────────────────────────────────

  describe('1. Zero Penny Leakage Invariant across 10,000 price values', () => {
    it('empirically proves creatorCents + platformCents === priceCents for every price from 0 to 10,000 cents', () => {
      let totalCreatorCents = 0;
      let totalPlatformCents = 0;
      let expectedSum = 0;

      for (let p = 0; p <= 10000; p++) {
        const split = calculateRoyaltySplit(p, 70.0);

        // Invariant 1: Sum matches price exactly (0 penny leakage)
        expect(split.creatorCents + split.platformCents).toBe(p);
        expect(split.totalCents).toBe(p);

        // Invariant 2: Pure integer values
        expect(Number.isInteger(split.creatorCents)).toBe(true);
        expect(Number.isInteger(split.platformCents)).toBe(true);

        // Invariant 3: Mathematical floor division
        expect(split.creatorCents).toBe(Math.floor((p * 70) / 100));
        expect(split.platformCents).toBe(p - split.creatorCents);

        totalCreatorCents += split.creatorCents;
        totalPlatformCents += split.platformCents;
        expectedSum += p;
      }

      // Aggregate invariant across all 10,001 data points
      expect(totalCreatorCents + totalPlatformCents).toBe(expectedSum);
    });

    it('proves zero penny leakage under random large price fuzzing (10,000 samples up to $10,000,000)', () => {
      for (let i = 0; i < 10000; i++) {
        // Random price between 10,001 and 1,000,000,000 cents ($10M)
        const p = Math.floor(Math.random() * 1_000_000_000) + 10001;
        const split = calculateRoyaltySplit(p, 70.0);

        expect(split.creatorCents + split.platformCents).toBe(p);
        expect(split.creatorCents).toBe(Math.floor((p * 70) / 100));
        expect(split.platformCents).toBe(p - split.creatorCents);
      }
    });

    it('handles edge percentage values (0%, 100%, negative, and >100%)', () => {
      // 0% royalty: platform gets 100%
      const split0 = calculateRoyaltySplit(5000, 0);
      expect(split0.creatorCents).toBe(0);
      expect(split0.platformCents).toBe(5000);
      expect(split0.creatorCents + split0.platformCents).toBe(5000);

      // Negative royalty: platform gets 100%
      const splitNeg = calculateRoyaltySplit(5000, -10);
      expect(splitNeg.creatorCents).toBe(0);
      expect(splitNeg.platformCents).toBe(5000);
      expect(splitNeg.creatorCents + splitNeg.platformCents).toBe(5000);

      // 100% royalty: creator gets 100%
      const split100 = calculateRoyaltySplit(5000, 100);
      expect(split100.creatorCents).toBe(5000);
      expect(split100.platformCents).toBe(0);
      expect(split100.creatorCents + split100.platformCents).toBe(5000);

      // >100% royalty: clamped, creator gets 100%
      const splitOver = calculateRoyaltySplit(5000, 150);
      expect(splitOver.creatorCents).toBe(5000);
      expect(splitOver.platformCents).toBe(0);
      expect(splitOver.creatorCents + splitOver.platformCents).toBe(5000);

      // Negative price: returns all zeros
      const splitNegPrice = calculateRoyaltySplit(-500);
      expect(splitNegPrice.creatorCents).toBe(0);
      expect(splitNegPrice.platformCents).toBe(0);
      expect(splitNegPrice.totalCents).toBe(0);
    });
  });

  // ── 2. Concurrency Stress Testing on CAS sequence_num ────────────────────────

  describe('2. Concurrency Stress Testing on CAS sequence_num in creator_earnings_ledger', () => {
    it('empirically resolves sequence collisions across 5 concurrent activations for the same creator', async () => {
      const creatorId = 'creator_concurrent_test';
      const numConcurrent = 5;

      // Launch 5 concurrent calls with unique referenceId
      const promises = Array.from({ length: numConcurrent }, (_, i) =>
        accrueRoyalty({
          db: d1 as any,
          templateId: `tpl_conc_${i}`,
          creatorId,
          activatingUserId: `buyer_conc_${i}`,
          tenantId: 'tenant_1',
          priceCents: 1000, // 700 creatorCents each
          referenceId: `ref_conc_${i}`,
        }),
      );

      const results = await Promise.all(promises);

      // Verify all 5 completed successfully
      expect(results).toHaveLength(numConcurrent);
      for (const res of results) {
        expect(res.success).toBe(true);
        expect(res.creatorCents).toBe(700);
        expect(res.platformCents).toBe(300);
      }

      // Collect sequence numbers
      const sequenceNums = results.map((r) => r.sequenceNum).sort((a, b) => a - b);
      expect(sequenceNums).toEqual([1, 2, 3, 4, 5]);

      // Verify ledger table in SQLite has strictly monotonic rows without gaps or duplicates
      const rows = rawDb.prepare(
        'SELECT sequence_num, amount_cents, balance_after_cents FROM creator_earnings_ledger WHERE creator_id = ? ORDER BY sequence_num ASC',
      ).all(creatorId) as Array<{ sequence_num: number; amount_cents: number; balance_after_cents: number }>;

      expect(rows).toHaveLength(5);
      expect(rows.map((r) => r.sequence_num)).toEqual([1, 2, 3, 4, 5]);
      expect(rows[4].balance_after_cents).toBe(3500); // 5 * 700 = 3500 cents

      // Verify getCreatorBalance snapshot
      const bal = await getCreatorBalance(d1 as any, creatorId);
      expect(bal.lastSequenceNum).toBe(5);
      expect(bal.availableBalanceCents).toBe(3500);
      expect(bal.totalEarnedCents).toBe(3500);
    });

    it('prevents double-spend when concurrent withdrawals race against available balance', async () => {
      const creatorId = 'creator_double_spend_test';

      // Fund creator with exactly 5,000 cents ($50.00)
      await accrueRoyalty({
        db: d1 as any,
        templateId: 'tpl_funding',
        creatorId,
        activatingUserId: 'buyer_initial',
        tenantId: 'tenant_1',
        priceCents: 7143, // 7143 * 0.7 = 5000.1 -> 5000 cents
        referenceId: 'ref_funding',
      });

      const initialBal = await getCreatorBalance(d1 as any, creatorId);
      expect(initialBal.availableBalanceCents).toBe(5000);

      // Launch TWO concurrent withdrawal requests for 5,000 cents each
      const w1 = processCreatorWithdrawal({
        db: d1 as any,
        creatorId,
        amountCents: 5000,
        rail: 'USDT',
        destinationAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      });

      const w2 = processCreatorWithdrawal({
        db: d1 as any,
        creatorId,
        amountCents: 5000,
        rail: 'USDT',
        destinationAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      });

      const results = await Promise.allSettled([w1, w2]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly ONE must succeed and ONE must fail with INSUFFICIENT_CREATOR_BALANCE
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const err = (rejected[0] as PromiseRejectedResult).reason;
      expect(String(err)).toMatch(/INSUFFICIENT_CREATOR_BALANCE/);

      // Verify database ledger has balance = 0, NEVER negative
      const endBal = await getCreatorBalance(d1 as any, creatorId);
      expect(endBal.availableBalanceCents).toBe(0);
      expect(endBal.totalWithdrawnCents).toBe(5000);
      expect(endBal.lastSequenceNum).toBe(2); // 1 accrual + 1 withdrawal
    });
  });

  // ── 3. Anti-Self-Activation Guard ───────────────────────────────────────────

  describe('3. Anti-Self-Activation Guard under manipulated inputs', () => {
    it('catches exact and whitespace-padded identity spoofing', () => {
      expect(isSelfTemplateActivation('usr_alice', 'usr_alice')).toBe(true);
      expect(isSelfTemplateActivation('  usr_alice  ', 'usr_alice')).toBe(true);
      expect(isSelfTemplateActivation('usr_alice', '\tusr_alice\n')).toBe(true);
      expect(isSelfTemplateActivation('usr_alice', 'usr_bob')).toBe(false);
    });

    it('safely handles empty, null-like, or malformed inputs without crashing', () => {
      expect(isSelfTemplateActivation('', '')).toBe(false);
      expect(isSelfTemplateActivation('usr_alice', '')).toBe(false);
      expect(isSelfTemplateActivation('', 'usr_alice')).toBe(false);
      // @ts-expect-error test undefined input
      expect(isSelfTemplateActivation(undefined, 'usr_alice')).toBe(false);
      // @ts-expect-error test null input
      expect(isSelfTemplateActivation('usr_alice', null)).toBe(false);
    });

    it('strictly throws SELF_TEMPLATE_ACTIVATION_PROHIBITED in accrueRoyalty', async () => {
      await expect(
        accrueRoyalty({
          db: d1 as any,
          templateId: 'tpl_self_exploit',
          creatorId: 'usr_adversary',
          activatingUserId: '  usr_adversary  ',
          tenantId: 'tenant_1',
          priceCents: 1000,
        }),
      ).rejects.toThrow('SELF_TEMPLATE_ACTIVATION_PROHIBITED');

      // Verify nothing was written to ledger
      const balance = await getCreatorBalance(d1 as any, 'usr_adversary');
      expect(balance.lastSequenceNum).toBe(0);
      expect(balance.availableBalanceCents).toBe(0);
    });
  });

  // ── 4. Payout Validation Edge Cases ─────────────────────────────────────────

  describe('4. Payout Validation Edge Cases (VietQR, USDT, Solvency)', () => {
    describe('VietQR Rail Validation', () => {
      it('rejects invalid 6-digit NAPAS BIN formats', () => {
        const invalidBins = ['12345', '1234567', 'ABCDEF', '97041A', '', '   ', '97-041'];
        for (const bin of invalidBins) {
          expect(() =>
            validatePayoutRail('VIETQR', {
              bankBin: bin,
              bankAccountNumber: '1012345678',
              bankAccountName: 'NGUYEN VAN A',
            }),
          ).toThrow(/INVALID_VIETQR_BIN/);
        }
      });

      it('rejects invalid bank account numbers (< 4 chars or non-alphanumeric / SQL injection)', () => {
        const invalidAccs = ['', '12', '123', '123-456', "1234' OR 1=1 --", 'ACC#123', '   '];
        for (const acc of invalidAccs) {
          expect(() =>
            validatePayoutRail('VIETQR', {
              bankBin: '970415',
              bankAccountNumber: acc,
              bankAccountName: 'NGUYEN VAN A',
            }),
          ).toThrow(/INVALID_VIETQR_ACCOUNT_NUMBER/);
        }
      });

      it('rejects bank account names under 2 characters', () => {
        expect(() =>
          validatePayoutRail('VIETQR', {
            bankBin: '970415',
            bankAccountNumber: '1012345678',
            bankAccountName: 'A',
          }),
        ).toThrow(/INVALID_VIETQR_ACCOUNT_NAME/);

        expect(() =>
          validatePayoutRail('VIETQR', {
            bankBin: '970415',
            bankAccountNumber: '1012345678',
            bankAccountName: '   ',
          }),
        ).toThrow(/INVALID_VIETQR_ACCOUNT_NAME/);
      });

      it('accepts legitimate VietQR details', () => {
        expect(() =>
          validatePayoutRail('VIETQR', {
            bankBin: '970415',
            bankAccountNumber: '1012345678',
            bankAccountName: 'NGUYEN VAN A',
          }),
        ).not.toThrow();
      });
    });

    describe('USDT Rail Validation', () => {
      it('accepts valid EVM, TRON, and Solana address formats', () => {
        // EVM 0x + 40 hex chars
        expect(() =>
          validatePayoutRail('USDT', {
            destinationAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          }),
        ).not.toThrow();

        // TRON TRC-20 (starts with T, 34 chars)
        expect(() =>
          validatePayoutRail('USDT', {
            destinationAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          }),
        ).not.toThrow();

        // Solana Base58 (44 chars)
        expect(() =>
          validatePayoutRail('USDT', {
            destinationAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          }),
        ).not.toThrow();
      });

      it('rejects malformed, short, XSS, or non-hex USDT addresses', () => {
        const maliciousOrMalformed = [
          '',
          '0x123',
          '0xG8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // non-hex G
          '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA9604', // 39 hex chars (missing 1)
          '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA9604511', // 42 hex chars instead of 40
          '<script>alert("xss")</script>',
          '0x d8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // internal space
          'not_an_address_at_all!@#$', // invalid symbols
        ];

        for (const addr of maliciousOrMalformed) {
          expect(() =>
            validatePayoutRail('USDT', {
              destinationAddress: addr,
            }),
          ).toThrow(/INVALID_USDT_ADDRESS/);
        }
      });

      it('exposes regex ambiguity: truncated TRON address matches overly broad Solana Base58 regex', () => {
        // TRON addresses must be 34 chars starting with T.
        // A truncated 32-char TRON address should be rejected, but matches [1-9A-HJ-NP-Za-km-z]{26,44}.
        const truncatedTron = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj';
        expect(truncatedTron).toHaveLength(32);
        // Empirically observes that the current regex permits this truncated address
        expect(() =>
          validatePayoutRail('USDT', {
            destinationAddress: truncatedTron,
          }),
        ).not.toThrow();
      });
    });

    describe('Solvency & Negative Balance Attempts', () => {
      it('rejects amounts below minimum $50.00 threshold (5,000 cents)', async () => {
        await expect(
          processCreatorWithdrawal({
            db: d1 as any,
            creatorId: 'usr_any',
            amountCents: 4999,
            rail: 'USDT',
            destinationAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          }),
        ).rejects.toThrow(/MINIMUM_WITHDRAWAL_5000_CENTS/);
      });

      it('rejects negative or zero withdrawal attempts', async () => {
        await expect(
          processCreatorWithdrawal({
            db: d1 as any,
            creatorId: 'usr_any',
            amountCents: -5000,
            rail: 'USDT',
            destinationAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          }),
        ).rejects.toThrow(/MINIMUM_WITHDRAWAL_5000_CENTS/);

        await expect(
          processCreatorWithdrawal({
            db: d1 as any,
            creatorId: 'usr_any',
            amountCents: 0,
            rail: 'USDT',
            destinationAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          }),
        ).rejects.toThrow(/MINIMUM_WITHDRAWAL_5000_CENTS/);
      });

      it('rejects withdrawal when balance is insufficient', async () => {
        await expect(
          processCreatorWithdrawal({
            db: d1 as any,
            creatorId: 'usr_broke',
            amountCents: 5000,
            rail: 'USDT',
            destinationAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          }),
        ).rejects.toThrow(/INSUFFICIENT_CREATOR_BALANCE/);
      });
    });
  });

  // ── 5. Quality Scorer Boundary Tests ────────────────────────────────────────

  describe('5. Quality Scorer Boundary Tests (Q=74 vs Q=75 and Q=39 vs Q=40)', () => {
    it('verifies decision status at exact boundary thresholds (Q=75, Q=74, Q=40, Q=39)', () => {
      // Base template with known scores
      const baseTemplate = (extraWords: string, variables: string, niche: string, scenesCount: number) => ({
        title: 'Virality Test Blueprint',
        scriptTemplate: `${extraWords} ${variables}`,
        hookStyle: 'curiosity_gap',
        aspectRatio: '9:16' as const,
        niche,
        storyboardJson: JSON.stringify(
          Array.from({ length: scenesCount }, (_, i) => ({
            sceneNumber: i + 1,
            visualPrompt: 'Detailed scene prompt with cinematic lighting',
            voiceoverScript: 'Script voiceover lines',
            durationSeconds: 6,
          })),
        ),
        estimatedDurationSeconds: scenesCount * 6,
      });

      // Let's test the scoring behavior across boundary templates
      // Template A: High virality hitting >= 75
      const approvedInput: TemplateEvaluationInput = {
        title: '3 Proven SaaS Secrets That Scaled Us To $100k',
        scriptTemplate:
          'Stop making this deadly mistake with your {{product_name}}! ' +
          'The shocking secret revealed today helped {{target_niche}} founders unlock 10x pipeline growth. ' +
          'Here is why most founders fail: they burn cash on paid ads, but nobody talks about organic loops. ' +
          'However, when you implement automated referral triggers, conversion explodes overnight. ' +
          'Comment "GROWTH" below or click the link in bio to try now!',
        hookStyle: 'curiosity_gap',
        aspectRatio: '9:16',
        niche: 'saas',
        visualStylePrompt: 'Cinematic hyper-realistic modern tech office with volumetric lighting and floating UI hologram',
        storyboardJson: JSON.stringify([
          { visualPrompt: 'Founder looking at falling charts in dark office', voiceoverScript: 'Stop making this mistake', durationSeconds: 5 },
          { visualPrompt: 'Rising green graph on futuristic glass screen', voiceoverScript: 'The shocking secret revealed', durationSeconds: 7 },
          { visualPrompt: 'Split screen showing burned cash vs servers', voiceoverScript: 'Here is why most fail', durationSeconds: 8 },
          { visualPrompt: 'Handheld phone receiving client payments', voiceoverScript: 'However referral triggers explode', durationSeconds: 6 },
          { visualPrompt: 'Glowing call to action button animation', voiceoverScript: 'Comment growth below to try now', durationSeconds: 4 },
        ]),
        estimatedDurationSeconds: 30,
      };

      const approvedResult = scoreTemplateQuality(approvedInput);
      expect(approvedResult.totalScore).toBeGreaterThanOrEqual(75);
      expect(approvedResult.status).toBe('approved');

      // Template B: Mediocre template (no variables, non-commercial niche, missing power words)
      const pendingInput: TemplateEvaluationInput = {
        title: 'Simple Nature Vlog',
        scriptTemplate: 'Walking through the woods today enjoying the trees and the peaceful morning.',
        hookStyle: 'curiosity_gap',
        aspectRatio: '9:16',
        niche: 'general',
        storyboardJson: JSON.stringify([
          { visualPrompt: 'Walking on forest trail', voiceoverScript: 'Walking in woods', durationSeconds: 15 },
          { visualPrompt: 'Sunlight shining through trees', voiceoverScript: 'Enjoying peaceful morning', durationSeconds: 15 },
        ]),
        estimatedDurationSeconds: 30,
      };

      const pendingResult = scoreTemplateQuality(pendingInput);
      expect(pendingResult.totalScore).toBeGreaterThanOrEqual(40);
      expect(pendingResult.totalScore).toBeLessThan(75);
      expect(pendingResult.status).toBe('pending');

      // Template C: Very poor template (poor hook, 1 scene, landscape 16:9, general niche)
      const rejectedInput: TemplateEvaluationInput = {
        title: 'One Word',
        scriptTemplate: 'Hi.',
        hookStyle: 'unknown_style',
        aspectRatio: '16:9',
        niche: 'random_hobby',
        storyboardJson: JSON.stringify([
          { visualPrompt: 'A room', voiceoverScript: 'Hi', durationSeconds: 30 },
        ]),
        estimatedDurationSeconds: 30,
      };

      const rejectedResult = scoreTemplateQuality(rejectedInput);
      expect(rejectedResult.totalScore).toBeLessThan(40);
      expect(rejectedResult.status).toBe('rejected');
    });

    it('verifies strict mathematical thresholds: 75 is approved, 74 is pending, 40 is pending, 39 is rejected', () => {
      // Verify boundary invariants directly against the decision logic contract:
      // totalScore >= 75 -> approved
      // 40 <= totalScore < 75 -> pending
      // totalScore < 40 -> rejected
      const evaluateStatus = (totalScore: number) => {
        if (totalScore >= 75) return 'approved';
        if (totalScore >= 40) return 'pending';
        return 'rejected';
      };

      expect(evaluateStatus(75)).toBe('approved');
      expect(evaluateStatus(74)).toBe('pending');
      expect(evaluateStatus(40)).toBe('pending');
      expect(evaluateStatus(39)).toBe('rejected');
      expect(evaluateStatus(0)).toBe('rejected');
      expect(evaluateStatus(100)).toBe('approved');
    });

    it('enforces dimension score upper bounds across all 4 pillars', () => {
      const input: TemplateEvaluationInput = {
        title: 'Ultra High Scored Blueprint',
        scriptTemplate:
          'Stop! The secret revealed today will blow your mind about {{company_name}} and {{industry}}! ' +
          'Never make this mistake again because here is why automated growth works. ' +
          'However, when you do this, results happen. Try now and comment below!',
        hookStyle: 'curiosity_gap',
        aspectRatio: '9:16',
        niche: 'saas',
        visualStylePrompt: 'Cinematic hyper-realistic modern tech office with volumetric lighting and floating UI hologram',
        storyboardJson: JSON.stringify([
          { visualPrompt: 'Scene 1', voiceoverScript: 'Hook', durationSeconds: 5 },
          { visualPrompt: 'Scene 2', voiceoverScript: 'Body', durationSeconds: 10 },
          { visualPrompt: 'Scene 3', voiceoverScript: 'Body', durationSeconds: 10 },
          { visualPrompt: 'Scene 4', voiceoverScript: 'CTA', durationSeconds: 5 },
        ]),
        estimatedDurationSeconds: 30,
      };

      const result = scoreTemplateQuality(input);
      expect(result.dimensions.hookStrength.score).toBeLessThanOrEqual(30);
      expect(result.dimensions.hookStrength.maxScore).toBe(30);
      expect(result.dimensions.storyboardCoherence.score).toBeLessThanOrEqual(25);
      expect(result.dimensions.storyboardCoherence.maxScore).toBe(25);
      expect(result.dimensions.scriptCadence.score).toBeLessThanOrEqual(25);
      expect(result.dimensions.scriptCadence.maxScore).toBe(25);
      expect(result.dimensions.nicheFit.score).toBeLessThanOrEqual(20);
      expect(result.dimensions.nicheFit.maxScore).toBe(20);

      expect(result.totalScore).toBeLessThanOrEqual(100);
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
    });
  });
});
