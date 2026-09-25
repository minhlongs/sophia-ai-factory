/**
 * Unit Tests for Creator Studio & Dual-Rail Withdrawal Service
 *
 * @vitest-environment node
 * @module land/creator/__tests__/creator-studio.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  getCreatorStudioStats,
  createCreatorTemplate,
  listCreatorTemplates,
  archiveCreatorTemplate,
  getCreatorProfile,
  updateCreatorPayoutSettings,
} from '../creator-studio-service';
import {
  createCreatorWithdrawalRequest,
  listCreatorWithdrawals,
  getVietQrPaymentInfo,
  processWithdrawalRequest,
  getCreatorUnencumberedBalance,
} from '../creator-withdrawal-service';

function createMockD1() {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS creator_templates (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      niche TEXT NOT NULL DEFAULT 'general',
      target_platform TEXT NOT NULL DEFAULT 'tiktok',
      aspect_ratio TEXT NOT NULL DEFAULT '9:16',
      hook_style TEXT NOT NULL DEFAULT 'curiosity_gap',
      script_template TEXT NOT NULL,
      storyboard_json TEXT NOT NULL DEFAULT '[]',
      visual_style_prompt TEXT NOT NULL,
      music_prompt TEXT,
      voice_profile TEXT,
      price_cents INTEGER NOT NULL DEFAULT 0,
      royalty_pct REAL NOT NULL DEFAULT 70.0,
      status TEXT NOT NULL DEFAULT 'pending',
      quality_score REAL DEFAULT 0.0,
      review_feedback TEXT,
      use_count INTEGER NOT NULL DEFAULT 0,
      rating REAL DEFAULT 0.0,
      review_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS creator_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      payout_rail TEXT DEFAULT 'USDT',
      payout_address TEXT,
      bank_bin TEXT,
      bank_account_number TEXT,
      bank_account_name TEXT,
      total_earnings_cents INTEGER DEFAULT 0,
      total_paid_cents INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS creator_withdrawal_requests (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      rail TEXT NOT NULL,
      destination_address TEXT,
      bank_bin TEXT,
      bank_account_number TEXT,
      bank_account_name TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      tx_hash TEXT,
      admin_notes TEXT,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

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
      created_at INTEGER NOT NULL DEFAULT 0
    );
  `);

  const d1Wrapper = {
    raw: db,
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>(): Promise<T | null> {
              const res = stmt.get(...args);
              return (res ?? null) as T;
            },
            async all<T>(): Promise<{ results: T[] }> {
              const res = stmt.all(...args);
              return { results: res as T[] };
            },
            async run(): Promise<{ success: boolean; meta: { changes: number } }> {
              const info = stmt.run(...args);
              return { success: true, meta: { changes: Number(info.changes) } };
            },
          };
        },
      };
    },
  };

  return d1Wrapper as unknown as D1Database & { raw: DatabaseSync };
}

describe('Creator Studio & Dual-Rail Withdrawal Service', () => {
  let mockD1: ReturnType<typeof createMockD1>;

  beforeEach(() => {
    mockD1 = createMockD1();

    // Seed creator profile
    mockD1.raw.exec(`
      INSERT INTO creator_profiles (
        id, user_id, display_name, payout_rail, payout_address,
        bank_bin, bank_account_number, bank_account_name,
        total_earnings_cents, total_paid_cents, status, created_at, updated_at
      ) VALUES (
        'cr_studio_1', 'usr_studio_1', 'Master Video Creator', 'USDT', '0x1234567890abcdef',
        '970422', '0123456789', 'NGUYEN VAN A',
        70000, 10000, 'active', 1000, 1000
      );
    `);

    // Seed 2 templates
    mockD1.raw.exec(`
      INSERT INTO creator_templates (
        id, creator_id, tenant_id, title, niche, target_platform, aspect_ratio,
        hook_style, script_template, visual_style_prompt, price_cents, royalty_pct,
        status, use_count, rating, review_count, created_at, updated_at
      ) VALUES 
      ('tmpl_1', 'cr_studio_1', 'tenant_a', 'E-com Flash Hook', 'ecommerce', 'tiktok', '9:16', 'shock_stat', 'Stop scrolling!', 'Neon glow', 1500, 70.0, 'approved', 25, 4.8, 10, 1000, 1000),
      ('tmpl_2', 'cr_studio_1', 'tenant_a', 'SaaS Growth Teaser', 'saas', 'youtube_shorts', '9:16', 'curiosity_gap', 'Want 10k MRR?', 'Clean minimalism', 2000, 70.0, 'approved', 15, 4.6, 5, 2000, 2000);
    `);
  });

  describe('Creator Studio Service', () => {
    it('aggregates studio stats accurately according to 70/30 protocol', async () => {
      const stats = await getCreatorStudioStats(mockD1, 'cr_studio_1');

      expect(stats.totalTemplates).toBe(2);
      expect(stats.totalUses).toBe(40); // 25 + 15
      expect(stats.totalReviews).toBe(15); // 10 + 5
      expect(stats.averageRating).toBe(4.7); // (4.8*10 + 4.6*5) / 15 = (48 + 23) / 15 = 71 / 15 = 4.733 -> 4.7
      expect(stats.creatorRoyaltyCents).toBe(70000); // $700.00
      expect(stats.grossEarningsCents).toBe(100000); // 70000 / 0.70 = 100000
      expect(stats.platformFeesCents).toBe(30000); // 100000 - 70000 = 30000
      expect(stats.availableBalanceCents).toBe(60000); // 70000 - 10000 = 60000 ($600.00)
    });

    it('creates a new creator template with pending review status', async () => {
      const res = await createCreatorTemplate(mockD1, 'cr_studio_1', 'tenant_a', {
        title: 'New AI Avatar Pitch',
        niche: 'tech',
        targetPlatform: 'tiktok',
        aspectRatio: '9:16',
        hookStyle: 'curiosity_gap',
        scriptTemplate: 'Here is how AI changes video creation forever.',
        visualStylePrompt: 'Futuristic holographic studio',
        priceCents: 2500,
      });

      expect(res.success).toBe(true);
      expect(res.template).toBeDefined();
      expect(res.template?.status).toBe('pending');
      expect(res.template?.royaltyPct).toBe(70.0);
      expect(res.template?.useCount).toBe(0);

      // Verify in DB
      const list = await listCreatorTemplates(mockD1, 'cr_studio_1');
      expect(list.total).toBe(3);
    });

    it('rejects invalid template input missing required fields', async () => {
      const res = await createCreatorTemplate(mockD1, 'cr_studio_1', 'tenant_a', {
        title: '',
        niche: 'general',
        targetPlatform: 'tiktok',
        aspectRatio: '9:16',
        hookStyle: 'curiosity_gap',
        scriptTemplate: '',
        visualStylePrompt: '',
        priceCents: 1000,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('archives a template successfully', async () => {
      const res = await archiveCreatorTemplate(mockD1, 'tmpl_1', 'cr_studio_1');
      expect(res.success).toBe(true);

      const list = await listCreatorTemplates(mockD1, 'cr_studio_1');
      expect(list.total).toBe(1); // tmpl_1 archived, only tmpl_2 returned
    });

    it('fetches profile and updates payout settings', async () => {
      const profile = await getCreatorProfile(mockD1, 'cr_studio_1');
      expect(profile).not.toBeNull();
      expect(profile?.displayName).toBe('Master Video Creator');
      expect(profile?.payoutRail).toBe('USDT');

      const updateRes = await updateCreatorPayoutSettings(mockD1, 'cr_studio_1', {
        payoutRail: 'VIETQR',
        bankBin: '970415', // VietinBank
        bankAccountNumber: '10987654321',
        bankAccountName: 'NGUYEN VAN A',
      });
      expect(updateRes.success).toBe(true);

      const updated = await getCreatorProfile(mockD1, 'cr_studio_1');
      expect(updated?.payoutRail).toBe('VIETQR');
      expect(updated?.bankBin).toBe('970415');
    });
  });

  describe('Creator Dual-Rail Withdrawal Service', () => {
    it('calculates unencumbered balance accurately', async () => {
      const bal = await getCreatorUnencumberedBalance(mockD1, 'cr_studio_1');
      expect(bal.availableCents).toBe(60000); // 70000 - 10000
      expect(bal.lockedCents).toBe(0);
      expect(bal.unencumberedCents).toBe(60000);
    });

    it('rejects withdrawal requests below minimum threshold of $50 (5,000 cents)', async () => {
      const res = await createCreatorWithdrawalRequest(mockD1, 'cr_studio_1', {
        amountCents: 4999, // $49.99
        rail: 'USDT',
        destinationAddress: '0x1234567890abcdef',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('5,000 cents');
    });

    it('rejects withdrawal requests exceeding unencumbered balance', async () => {
      const res = await createCreatorWithdrawalRequest(mockD1, 'cr_studio_1', {
        amountCents: 70000, // $700.00 > $600.00 available
        rail: 'USDT',
        destinationAddress: '0x1234567890abcdef',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('INSUFFICIENT_UNENCUMBERED_BALANCE');
    });

    it('validates VietQR rail inputs: requires 6-digit BIN and account details', async () => {
      const resInvalidBin = await createCreatorWithdrawalRequest(mockD1, 'cr_studio_1', {
        amountCents: 10000, // $100.00
        rail: 'VIETQR',
        bankBin: '123', // invalid BIN length
        bankAccountNumber: '0123456789',
        bankAccountName: 'NGUYEN VAN A',
      });

      expect(resInvalidBin.success).toBe(false);
      expect(resInvalidBin.error).toContain('6-digit NAPAS bank BIN');
    });

    it('creates a valid USDT withdrawal request and locks balance', async () => {
      const res = await createCreatorWithdrawalRequest(mockD1, 'cr_studio_1', {
        amountCents: 20000, // $200.00
        rail: 'USDT',
        destinationAddress: '0x9999888877776666555544443333222211110000',
      });

      expect(res.success).toBe(true);
      expect(res.request?.status).toBe('pending');
      expect(res.request?.amountCents).toBe(20000);

      // Verify unencumbered balance is now reduced by locked pending amount
      const bal = await getCreatorUnencumberedBalance(mockD1, 'cr_studio_1');
      expect(bal.availableCents).toBe(60000);
      expect(bal.lockedCents).toBe(20000);
      expect(bal.unencumberedCents).toBe(40000); // 60000 - 20000 = 40000
    });

    it('generates VietQR payment info and URL with live VND conversion', () => {
      const withdrawal = {
        id: 'with_test_12345678',
        creatorId: 'cr_studio_1',
        amountCents: 10000, // $100.00
        currency: 'USD',
        rail: 'VIETQR' as const,
        destinationAddress: null,
        bankBin: '970422', // MBBank
        bankAccountNumber: '0987654321',
        bankAccountName: 'NGUYEN VAN A',
        status: 'pending' as const,
        txHash: null,
        adminNotes: null,
        createdAt: 1000,
      };

      const qrInfo = getVietQrPaymentInfo(withdrawal, 25450);
      expect(qrInfo).not.toBeNull();
      expect(qrInfo?.amountUsd).toBe(100);
      expect(qrInfo?.amountVnd).toBe(2545000); // 100 * 25,450
      expect(qrInfo?.qrUrl).toContain('https://img.vietqr.io/image/970422-0987654321-compact2.png');
      expect(qrInfo?.qrUrl).toContain('amount=2545000');
    });

    it('completes a withdrawal request, updates total_paid_cents, and records ledger payout', async () => {
      const created = await createCreatorWithdrawalRequest(mockD1, 'cr_studio_1', {
        amountCents: 15000, // $150.00
        rail: 'USDT',
        destinationAddress: '0x1111222233334444555566667777888899990000',
      });

      const withdrawalId = created.request?.id!;
      const processRes = await processWithdrawalRequest(
        mockD1,
        withdrawalId,
        'complete',
        'Batch disbursement #104',
        '0xhash_completed_123',
      );

      expect(processRes.success).toBe(true);

      // Verify withdrawal status updated
      const list = await listCreatorWithdrawals(mockD1, 'cr_studio_1');
      const item = list.items.find((w) => w.id === withdrawalId);
      expect(item?.status).toBe('completed');
      expect(item?.txHash).toBe('0xhash_completed_123');

      // Verify profile total_paid_cents incremented: 10000 + 15000 = 25000
      const profile = await getCreatorProfile(mockD1, 'cr_studio_1');
      expect(profile?.totalPaidCents).toBe(25000);

      // Verify unencumbered balance reflects completed payout
      const bal = await getCreatorUnencumberedBalance(mockD1, 'cr_studio_1');
      expect(bal.availableCents).toBe(45000); // 70000 - 25000
      expect(bal.lockedCents).toBe(0);
      expect(bal.unencumberedCents).toBe(45000);
    });
  });
});
