/** @vitest-environment node */

/**
 * Unit Test Suite: Marketplace Discovery, Review Accrual & Template Activation
 *
 * Validates:
 * 1. Trending rank decay formula:
 *    (useCount * 3.0 + rating * reviewCount * 2.0) / Math.pow(hoursSinceCreated + 2.0, 1.3)
 * 2. Template creation with AI Quality Scorer auto-approval
 * 3. Search and faceted filtering (niche, platform, price, status, pagination)
 * 4. Submit review with incremental rating accrual:
 *    R_new = (R_old * C_old + R_user) / (C_old + 1)
 * 5. UNIQUE(template_id, user_id) duplicate review prevention
 * 6. End-to-end template activation with 70/30 royalty distribution
 *
 * @module tree/marketplace/__tests__/marketplace-service.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import {
  calculateTrendingRank,
  listMarketplaceTemplates,
  getMarketplaceTemplateById,
  createMarketplaceTemplate,
  submitTemplateReview,
  activateMarketplaceTemplate,
} from '../marketplace-service';
import { getCreatorBalance } from '../royalty-engine';

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

describe('Marketplace Service — Unit Tests', () => {
  let rawDb: InstanceType<typeof DatabaseSync>;
  let d1: ReturnType<typeof makeD1>;

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
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
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS creator_reviews (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        rating REAL NOT NULL CHECK(rating >= 1.0 AND rating <= 5.0),
        review_text TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(template_id, user_id)
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
        created_at INTEGER NOT NULL,
        UNIQUE(creator_id, reference_id, event_type),
        UNIQUE(creator_id, sequence_num)
      );
    `);
    d1 = makeD1(rawDb);
  });

  describe('Trending Rank Decay Algorithm', () => {
    it('calculates expected score with engagement velocity and zero-time floor', () => {
      const now = Date.now();
      // At t = 0 hours: hoursSinceCreated = 0 -> denominator = 2.0^1.3 = 2.4622888
      // useCount = 10, rating = 4.5, reviewCount = 4
      // numerator = 10 * 3.0 + 4.5 * 4 * 2.0 = 30 + 36 = 66
      // expected = 66 / 2.4622888 = 26.804
      const score = calculateTrendingRank(10, 4.5, 4, now, now);
      expect(score).toBeCloseTo(26.804, 2);
    });

    it('decays score as template ages', () => {
      const now = Date.now();
      const freshScore = calculateTrendingRank(50, 4.8, 10, now, now);
      // 24 hours later
      const dayOldCreatedAt = now - 24 * 3600 * 1000;
      const dayOldScore = calculateTrendingRank(50, 4.8, 10, dayOldCreatedAt, now);
      // 72 hours later
      const threeDaysOldCreatedAt = now - 72 * 3600 * 1000;
      const threeDaysOldScore = calculateTrendingRank(50, 4.8, 10, threeDaysOldCreatedAt, now);

      expect(freshScore).toBeGreaterThan(dayOldScore);
      expect(dayOldScore).toBeGreaterThan(threeDaysOldScore);
    });

    it('awards higher trending score for high use count and positive reviews', () => {
      const now = Date.now();
      const viralScore = calculateTrendingRank(100, 4.9, 20, now, now);
      const lowTrafficScore = calculateTrendingRank(2, 4.0, 1, now, now);

      expect(viralScore).toBeGreaterThan(lowTrafficScore);
    });
  });

  describe('Template Creation & Quality Auto-Approval', () => {
    it('creates and auto-approves high-quality template into creator_templates table', async () => {
      const result = await createMarketplaceTemplate(d1 as any, {
        creatorId: 'creator_007',
        tenantId: 'tenant_main',
        title: 'B2B Cold Outreach Hook That Converted 42%',
        description: 'High conversion TikTok / Shorts blueprint for B2B founders',
        niche: 'saas',
        targetPlatform: 'tiktok',
        aspectRatio: '9:16',
        hookStyle: 'curiosity_gap',
        scriptTemplate:
          'Stop making this mistake with your {{product_name}}! ' +
          'The secret revealed today unlocked 42% reply rates for {{target_industry}} founders. ' +
          'Most SDRs pitch features, but nobody talks about empathy triggers. ' +
          'However, when you flip the script, leads reply within minutes. ' +
          'Comment below to try now or click link in bio!',
        visualStylePrompt: 'Moody dark mode studio with cinematic volumetric lighting and crisp typography',
        storyboardJson: JSON.stringify([
          { sceneNumber: 1, visualPrompt: 'Founder looking stressed at empty inbox with dark neon blue glow', durationSeconds: 5 },
          { sceneNumber: 2, visualPrompt: 'Close up of high converting message script glowing on modern glass laptop screen', durationSeconds: 6 },
          { sceneNumber: 3, visualPrompt: 'Split screen showing cold template versus psychological empathy trigger framework', durationSeconds: 7 },
          { sceneNumber: 4, visualPrompt: 'Rapid notifications popping up with eager customer responses', durationSeconds: 8 },
          { sceneNumber: 5, visualPrompt: 'Pulsing call to action banner inviting viewer to comment below', durationSeconds: 4 },
        ]),
        priceCents: 1500,
      });

      expect(result.template.status).toBe('approved');
      expect(result.template.quality_score).toBeGreaterThanOrEqual(75);
      expect(result.template.price_cents).toBe(1500);

      // Verify row exists in database
      const row = await d1
        .prepare('SELECT * FROM creator_templates WHERE id = ?')
        .bind(result.template.id)
        .first();
      expect(row).toBeDefined();
    });
  });

  describe('Search & Filter Catalog', () => {
    beforeEach(async () => {
      const now = Date.now();
      // Insert sample templates
      await d1
        .prepare(
          `INSERT INTO creator_templates (
            id, creator_id, tenant_id, title, description, niche, target_platform,
            aspect_ratio, hook_style, script_template, visual_style_prompt,
            price_cents, royalty_pct, status, quality_score, use_count, rating, review_count, created_at, updated_at
          ) VALUES 
          ('tpl_1', 'cr_1', 't_1', 'SaaS Growth Secret', 'Desc 1', 'saas', 'tiktok', '9:16', 'curiosity_gap', 'Script', 'Visual', 1000, 70.0, 'approved', 88.0, 50, 4.8, 10, ?, ?),
          ('tpl_2', 'cr_2', 't_1', 'Ecommerce Scale Blueprint', 'Desc 2', 'ecommerce', 'tiktok', '9:16', 'pattern_interrupt', 'Script', 'Visual', 2000, 70.0, 'approved', 82.0, 30, 4.2, 5, ?, ?),
          ('tpl_3', 'cr_1', 't_1', 'Fitness Transformation Routine', 'Desc 3', 'fitness', 'youtube_shorts', '9:16', 'bold_claim', 'Script', 'Visual', 500, 70.0, 'approved', 76.0, 10, 5.0, 2, ?, ?),
          ('tpl_4', 'cr_3', 't_1', 'Pending Tech Review', 'Desc 4', 'tech', 'tiktok', '9:16', 'curiosity_gap', 'Script', 'Visual', 1500, 70.0, 'pending', 60.0, 0, 0.0, 0, ?, ?)`
        )
        .bind(now - 10000, now - 10000, now - 20000, now - 20000, now - 30000, now - 30000, now - 40000, now - 40000)
        .run();
    });

    it('lists only approved templates by default', async () => {
      const res = await listMarketplaceTemplates(d1 as any);
      expect(res.total).toBe(3);
      expect(res.items.every((i) => i.status === 'approved')).toBe(true);
    });

    it('filters by niche', async () => {
      const res = await listMarketplaceTemplates(d1 as any, { niche: 'saas' });
      expect(res.total).toBe(1);
      expect(res.items[0].id).toBe('tpl_1');
    });

    it('filters by platform', async () => {
      const res = await listMarketplaceTemplates(d1 as any, { targetPlatform: 'youtube_shorts' });
      expect(res.total).toBe(1);
      expect(res.items[0].id).toBe('tpl_3');
    });

    it('filters by price range', async () => {
      const res = await listMarketplaceTemplates(d1 as any, {
        minPriceCents: 1000,
        maxPriceCents: 2000,
      });
      expect(res.total).toBe(2);
      expect(res.items.map((i) => i.id)).toContain('tpl_1');
      expect(res.items.map((i) => i.id)).toContain('tpl_2');
    });

    it('searches text across title and description', async () => {
      const res = await listMarketplaceTemplates(d1 as any, { search: 'Ecommerce' });
      expect(res.total).toBe(1);
      expect(res.items[0].id).toBe('tpl_2');
    });

    it('sorts by trending rank properly', async () => {
      const res = await listMarketplaceTemplates(d1 as any, { sortBy: 'trending' });
      expect(res.items[0].id).toBe('tpl_1'); // 50 uses + 4.8 rating has highest trending velocity
    });

    it('sorts by price ascending and descending', async () => {
      const asc = await listMarketplaceTemplates(d1 as any, { sortBy: 'price_asc' });
      expect(asc.items[0].price_cents).toBe(500);

      const desc = await listMarketplaceTemplates(d1 as any, { sortBy: 'price_desc' });
      expect(desc.items[0].price_cents).toBe(2000);
    });

    it('fetches single template by ID with its reviews', async () => {
      const res = await getMarketplaceTemplateById(d1 as any, 'tpl_1');
      expect(res.template).not.toBeNull();
      expect(res.template?.id).toBe('tpl_1');
      expect(res.template?.trendingScore).toBeGreaterThan(0);
      expect(Array.isArray(res.reviews)).toBe(true);
    });
  });

  describe('Community Reviews & Incremental Rating Accrual', () => {
    beforeEach(async () => {
      const now = Date.now();
      await d1
        .prepare(
          `INSERT INTO creator_templates (
            id, creator_id, tenant_id, title, niche, target_platform, aspect_ratio,
            hook_style, script_template, visual_style_prompt, price_cents, royalty_pct,
            status, quality_score, use_count, rating, review_count, created_at, updated_at
          ) VALUES ('tpl_rev_test', 'cr_1', 't_1', 'Review Target', 'saas', 'tiktok', '9:16', 'curiosity_gap', 'S', 'V', 1000, 70.0, 'approved', 85.0, 10, 0.0, 0, ?, ?)`
        )
        .bind(now, now)
        .run();
    });

    it('validates rating is between 1.0 and 5.0', async () => {
      await expect(
        submitTemplateReview(d1 as any, {
          templateId: 'tpl_rev_test',
          userId: 'usr_1',
          tenantId: 't_1',
          rating: 0.5,
        }),
      ).rejects.toThrow('INVALID_RATING');

      await expect(
        submitTemplateReview(d1 as any, {
          templateId: 'tpl_rev_test',
          userId: 'usr_1',
          tenantId: 't_1',
          rating: 5.5,
        }),
      ).rejects.toThrow('INVALID_RATING');
    });

    it('accurately updates incremental ratings across multiple reviews', async () => {
      // Review 1: 5.0 stars
      const r1 = await submitTemplateReview(d1 as any, {
        templateId: 'tpl_rev_test',
        userId: 'reviewer_1',
        tenantId: 't_1',
        rating: 5.0,
        reviewText: 'Incredible hook! Gained 10k views in 24 hours.',
      });
      expect(r1.newRating).toBe(5.0);
      expect(r1.newReviewCount).toBe(1);

      // Review 2: 4.0 stars -> (5.0 * 1 + 4.0) / 2 = 4.5
      const r2 = await submitTemplateReview(d1 as any, {
        templateId: 'tpl_rev_test',
        userId: 'reviewer_2',
        tenantId: 't_1',
        rating: 4.0,
        reviewText: 'Good structure, needed some pacing tweaks.',
      });
      expect(r2.newRating).toBe(4.5);
      expect(r2.newReviewCount).toBe(2);

      // Review 3: 3.0 stars -> (4.5 * 2 + 3.0) / 3 = 4.0
      const r3 = await submitTemplateReview(d1 as any, {
        templateId: 'tpl_rev_test',
        userId: 'reviewer_3',
        tenantId: 't_1',
        rating: 3.0,
      });
      expect(r3.newRating).toBe(4.0);
      expect(r3.newReviewCount).toBe(3);

      // Verify template row has updated rating and reviews list
      const details = await getMarketplaceTemplateById(d1 as any, 'tpl_rev_test');
      expect(details.template?.rating).toBe(4.0);
      expect(details.template?.review_count).toBe(3);
      expect(details.reviews.length).toBe(3);
    });

    it('enforces UNIQUE(template_id, user_id) duplicate review prevention', async () => {
      // User 1 submits first review
      await submitTemplateReview(d1 as any, {
        templateId: 'tpl_rev_test',
        userId: 'repeat_user',
        tenantId: 't_1',
        rating: 5.0,
      });

      // User 1 tries to submit duplicate review
      await expect(
        submitTemplateReview(d1 as any, {
          templateId: 'tpl_rev_test',
          userId: 'repeat_user',
          tenantId: 't_1',
          rating: 4.0,
        }),
      ).rejects.toThrow('DUPLICATE_REVIEW_PROHIBITED');
    });
  });

  describe('End-to-End Template Activation Lifecycle', () => {
    beforeEach(async () => {
      const now = Date.now();
      await d1
        .prepare(
          `INSERT INTO creator_templates (
            id, creator_id, tenant_id, title, niche, target_platform, aspect_ratio,
            hook_style, script_template, visual_style_prompt, price_cents, royalty_pct,
            status, quality_score, use_count, rating, review_count, created_at, updated_at
          ) VALUES 
          ('tpl_active', 'creator_alice', 't_1', 'Active Blueprint', 'saas', 'tiktok', '9:16', 'curiosity_gap', 'S', 'V', 1000, 70.0, 'approved', 85.0, 0, 0.0, 0, ?, ?),
          ('tpl_pending_status', 'creator_bob', 't_1', 'Pending Blueprint', 'saas', 'tiktok', '9:16', 'curiosity_gap', 'S', 'V', 1000, 70.0, 'pending', 60.0, 0, 0.0, 0, ?, ?)`
        )
        .bind(now, now, now, now)
        .run();
    });

    it('activates template, accrues 70% to creator, and increments use_count', async () => {
      const res = await activateMarketplaceTemplate(d1 as any, {
        templateId: 'tpl_active',
        activatingUserId: 'buyer_charlie',
        tenantId: 't_1',
        videoJobId: 'job_xyz_123',
      });

      expect(res.success).toBe(true);
      expect(res.activationResult.creatorCents).toBe(700);
      expect(res.activationResult.platformCents).toBe(300);
      expect(res.template.use_count).toBe(1);

      // Verify creator balance in ledger
      const balance = await getCreatorBalance(d1 as any, 'creator_alice');
      expect(balance.availableBalanceCents).toBe(700);
      expect(balance.totalEarnedCents).toBe(700);

      // Verify use_count in database
      const row = await d1
        .prepare('SELECT use_count FROM creator_templates WHERE id = ?')
        .bind('tpl_active')
        .first<{ use_count: number }>();
      expect(row?.use_count).toBe(1);
    });

    it('blocks self-activation by template owner', async () => {
      await expect(
        activateMarketplaceTemplate(d1 as any, {
          templateId: 'tpl_active',
          activatingUserId: 'creator_alice', // Same as creator_id
          tenantId: 't_1',
        }),
      ).rejects.toThrow('SELF_TEMPLATE_ACTIVATION_PROHIBITED');
    });

    it('rejects activation of unapproved template', async () => {
      await expect(
        activateMarketplaceTemplate(d1 as any, {
          templateId: 'tpl_pending_status',
          activatingUserId: 'buyer_charlie',
          tenantId: 't_1',
        }),
      ).rejects.toThrow('TEMPLATE_NOT_ACTIVE');
    });
  });
});
