/**
 * Unit Tests for Template Activation & 70/30 Royalty Protocol
 *
 * @vitest-environment node
 * @module tree/creator-royalties/__tests__/template-activation.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  calculateTemplateRoyalty,
  isSelfTemplateActivation,
  activateTemplateWithRoyaltyCAS,
  DEFAULT_TEMPLATE_ROYALTY_PCT,
} from '../template-activation';

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
      status TEXT NOT NULL DEFAULT 'approved',
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
      bank_bin TEXT,
      bank_account_number TEXT,
      bank_account_name TEXT,
      total_earnings_cents INTEGER DEFAULT 0,
      total_paid_cents INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
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
      created_at INTEGER NOT NULL DEFAULT 0,
      UNIQUE(creator_id, reference_id, event_type),
      UNIQUE(creator_id, sequence_num)
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

describe('Template Activation & 70/30 Royalty Protocol', () => {
  describe('calculateTemplateRoyalty', () => {
    it('allocates 70% to creator and 30% to platform with zero cent leakage', () => {
      const split = calculateTemplateRoyalty(1000); // $10.00
      expect(split.creatorCents).toBe(700);
      expect(split.platformCents).toBe(300);
      expect(split.creatorCents + split.platformCents).toBe(1000);
    });

    it('handles fractional cent rounding with Math.floor for creator share', () => {
      // 1999 cents * 0.70 = 1399.3 -> floor is 1399, platform gets 600
      const split = calculateTemplateRoyalty(1999);
      expect(split.creatorCents).toBe(1399);
      expect(split.platformCents).toBe(600);
      expect(split.creatorCents + split.platformCents).toBe(1999);
    });

    it('handles boundary cases: 0 cents and negative prices', () => {
      expect(calculateTemplateRoyalty(0)).toEqual({ creatorCents: 0, platformCents: 0 });
      expect(calculateTemplateRoyalty(-500)).toEqual({ creatorCents: 0, platformCents: 0 });
    });

    it('handles boundary royalty rates: 0% and 100%', () => {
      const zeroPct = calculateTemplateRoyalty(1000, 0);
      expect(zeroPct.creatorCents).toBe(0);
      expect(zeroPct.platformCents).toBe(1000);

      const hundredPct = calculateTemplateRoyalty(1000, 100);
      expect(hundredPct.creatorCents).toBe(1000);
      expect(hundredPct.platformCents).toBe(0);
    });

    it('satisfies zero leakage invariant across 1000 random prices', () => {
      for (let i = 1; i <= 1000; i++) {
        const price = Math.floor(Math.random() * 50000) + 1; // 1 cent to $500
        const split = calculateTemplateRoyalty(price, 70.0);
        expect(split.creatorCents + split.platformCents).toBe(price);
        expect(Number.isInteger(split.creatorCents)).toBe(true);
        expect(Number.isInteger(split.platformCents)).toBe(true);
      }
    });
  });

  describe('isSelfTemplateActivation', () => {
    it('returns true when activating user is the template creator', () => {
      expect(isSelfTemplateActivation('creator_123', 'creator_123')).toBe(true);
      expect(isSelfTemplateActivation('  user_abc  ', 'user_abc')).toBe(true);
    });

    it('returns false when activating user is different', () => {
      expect(isSelfTemplateActivation('creator_123', 'customer_456')).toBe(false);
      expect(isSelfTemplateActivation('', 'customer_456')).toBe(false);
    });
  });

  describe('activateTemplateWithRoyaltyCAS', () => {
    let mockD1: ReturnType<typeof createMockD1>;

    beforeEach(() => {
      mockD1 = createMockD1();

      // Seed creator profile
      mockD1.raw.exec(`
        INSERT INTO creator_profiles (id, user_id, display_name, payout_rail, total_earnings_cents, status, created_at, updated_at)
        VALUES ('cr_top_1', 'usr_top_1', 'Top Creator', 'USDT', 0, 'active', 1000, 1000);
      `);

      // Seed approved template
      mockD1.raw.exec(`
        INSERT INTO creator_templates (
          id, creator_id, tenant_id, title, niche, target_platform, aspect_ratio,
          hook_style, script_template, storyboard_json, visual_style_prompt,
          price_cents, royalty_pct, status, use_count, rating, review_count, created_at, updated_at
        ) VALUES (
          'tmpl_viral_saas', 'cr_top_1', 'tenant_demo', 'Viral SaaS Hook', 'saas', 'tiktok', '9:16',
          'curiosity_gap', 'Did you know that 90% of SaaS startups fail?', '[]', 'Cinematic 3D render',
          2000, 70.0, 'approved', 0, 5.0, 1, 1000, 1000
        );
      `);
    });

    it('prevents self-activation by template creator', async () => {
      const res = await activateTemplateWithRoyaltyCAS(mockD1, {
        templateId: 'tmpl_viral_saas',
        creatorId: 'cr_top_1',
        activatingUserId: 'cr_top_1',
        tenantId: 'tenant_demo',
        videoJobId: 'job_001',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('SELF_TEMPLATE_ACTIVATION_PROHIBITED');
    });

    it('rejects activation if template is not approved', async () => {
      mockD1.raw.exec(`
        UPDATE creator_templates SET status = 'pending' WHERE id = 'tmpl_viral_saas';
      `);

      const res = await activateTemplateWithRoyaltyCAS(mockD1, {
        templateId: 'tmpl_viral_saas',
        creatorId: 'cr_top_1',
        activatingUserId: 'usr_buyer_99',
        tenantId: 'tenant_demo',
        videoJobId: 'job_002',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('TEMPLATE_NOT_APPROVED');
    });

    it('successfully activates template with 70/30 split and advances OCC CAS ledger', async () => {
      const res1 = await activateTemplateWithRoyaltyCAS(mockD1, {
        templateId: 'tmpl_viral_saas',
        creatorId: 'cr_top_1',
        activatingUserId: 'usr_buyer_1',
        tenantId: 'tenant_demo',
        videoJobId: 'job_101',
      });

      expect(res1.success).toBe(true);
      expect(res1.creatorCents).toBe(1400); // 70% of 2000 cents
      expect(res1.platformCents).toBe(600); // 30% of 2000 cents
      expect(res1.sequenceNum).toBe(1);
      expect(res1.newBalanceCents).toBe(1400);

      // Verify use_count incremented
      const tmpl = mockD1.raw.prepare('SELECT use_count FROM creator_templates WHERE id = ?').get('tmpl_viral_saas') as { use_count: number };
      expect(tmpl.use_count).toBe(1);

      // Verify total_earnings_cents updated
      const profile = mockD1.raw.prepare('SELECT total_earnings_cents FROM creator_profiles WHERE id = ?').get('cr_top_1') as { total_earnings_cents: number };
      expect(profile.total_earnings_cents).toBe(1400);

      // Second activation advances monotonic sequence to 2
      const res2 = await activateTemplateWithRoyaltyCAS(mockD1, {
        templateId: 'tmpl_viral_saas',
        creatorId: 'cr_top_1',
        activatingUserId: 'usr_buyer_2',
        tenantId: 'tenant_demo',
        videoJobId: 'job_102',
      });

      expect(res2.success).toBe(true);
      expect(res2.sequenceNum).toBe(2);
      expect(res2.newBalanceCents).toBe(2800);

      const tmplAfter2 = mockD1.raw.prepare('SELECT use_count FROM creator_templates WHERE id = ?').get('tmpl_viral_saas') as { use_count: number };
      expect(tmplAfter2.use_count).toBe(2);
    });
  });
});
