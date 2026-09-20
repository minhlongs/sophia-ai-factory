/**
 * Tier 1: Feature Coverage E2E Test Suite
 * Autonomous Growth & Revenue Engine ($1M MRR Path)
 *
 * Requirements: >=5 tests per feature for all 12 core features (60 tests total).
 * 1. Hermes trend scouting (TikTok, Shorts, X)
 * 2. Mathematical hook scoring & SES forecast
 * 3. Autonomous daily campaign generator
 * 4. Closed-loop viral feedback OCC CAS
 * 5. Marketplace discovery (/marketplace, /vi/marketplace)
 * 6. Studio clone & cost preflight
 * 7. Creator royalties attribution & ledger lineage
 * 8. 5 affiliate webhooks HMAC ingestion
 * 9. 14-day hold & dual-entry ledger
 * 10. NOWPayments USDT batch & reconciliation
 * 11. Mekong tunnel routing & hybrid execution
 * 12. 15s edge health detection & cloud fallback
 *
 * @module tests/e2e/growth-engine/tier1-feature-coverage.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGrowthEngineD1,
  scoutTrendingSignals,
  calculateHookScore,
  calculateSESForecast,
  generateDailyCampaignBlueprints,
  ingestEngagementFeedback,
  listMarketplaceBlueprints,
  estimateBlueprintStudioCost,
  cloneBlueprintForMission,
  recordBlueprintRemixAndAccrueRoyalty,
  verifyAffiliateHmac,
  processAffiliateWebhook,
  flipPendingToPayable,
  recordClawbackAdjustment,
  getNetAffiliateBalance,
  processPayoutBatch,
  reconcileDailyFinancials,
  routeInferenceTask,
  probeEdgeNode,
  checkClusterHealth,
  type MockD1Database,
} from './growth-engine-harness';

describe('Tier 1: Feature Coverage (12 Core Features)', () => {
  let db: MockD1Database;

  beforeEach(() => {
    db = createGrowthEngineD1();
  });

  // ─── Feature 1: Hermes V2 Cross-Channel Trend Scouting ───────────────────────
  describe('F1: Hermes V2 Cross-Channel Trend Scouting', () => {
    it('1.1 scouts trends across TikTok with high velocity and momentum', async () => {
      const signals = await scoutTrendingSignals('tiktok', 'ai_tools', db);
      expect(signals).toHaveLength(5);
      expect(signals[0].platform).toBe('tiktok');
      expect(signals[0].topic).toBe('ai_tools');
      expect(signals[0].velocity).toBeGreaterThan(0);
      expect(signals[0].momentum).toBeGreaterThan(0);
    });

    it('1.2 scouts trends across YouTube Shorts with platform-specific multipliers', async () => {
      const signals = await scoutTrendingSignals('youtube_shorts', 'productivity', db);
      expect(signals.length).toBeGreaterThanOrEqual(5);
      expect(signals[0].platform).toBe('youtube_shorts');
      expect(signals[0].hashtag).toContain('#productivity');
      expect(signals[0].volume).toBeGreaterThan(1000);
    });

    it('1.3 scouts trends across X (Twitter) with hashtag formatting', async () => {
      const signals = await scoutTrendingSignals('x', 'finance', db);
      expect(signals).toHaveLength(5);
      expect(signals[0].platform).toBe('x');
      expect(signals[0].hashtag).toBe('#finance');
    });

    it('1.4 normalizes input queries and trims whitespace', async () => {
      const signals = await scoutTrendingSignals('tiktok', '  ECommerce Tips  ', db);
      expect(signals.length).toBe(5);
      expect(signals[0].topic).toBe('ecommerce tips');
      expect(signals[0].hashtag).toBe('#ecommerce tips');
    });

    it('1.5 returns empty signals array for empty/whitespace-only queries', async () => {
      const emptySignals = await scoutTrendingSignals('tiktok', '   ', db);
      expect(emptySignals).toEqual([]);
    });
  });

  // ─── Feature 2: Mathematical Hook Scoring & SES Forecasting ─────────────────
  describe('F2: Mathematical Hook Scoring & SES Forecasting', () => {
    it('2.1 calculates viral score according to exact formula (0.40 hook + 0.25 pacing + 0.20 retention + 0.15 cta)', () => {
      const result = calculateHookScore({
        hookText: 'Stop making this mistake in 2026!',
        style: 'negative_warning',
        hookStyleScore: 90,
        pacingScore: 80,
        retentionScore: 85,
        ctaScore: 70,
      });

      // 0.40*90 (36) + 0.25*80 (20) + 0.20*85 (17) + 0.15*70 (10.5) = 83.5
      expect(result.viralScore).toBe(83.5);
      expect(result.breakdown.hook).toBe(36);
      expect(result.breakdown.pacing).toBe(20);
      expect(result.breakdown.retention).toBe(17);
      expect(result.breakdown.cta).toBe(10.5);
    });

    it('2.2 assigns correct viral/strong/moderate/weak verdicts based on threshold', () => {
      const viralResult = calculateHookScore({
        hookText: 'Unbelievable secret revealed',
        style: 'curiosity_gap',
        hookStyleScore: 95,
        pacingScore: 90,
        retentionScore: 90,
        ctaScore: 85,
      });
      expect(viralResult.viralScore).toBeGreaterThanOrEqual(85);
      expect(viralResult.verdict).toBe('viral');

      const weakResult = calculateHookScore({
        hookText: 'Just another video',
        style: 'question',
        hookStyleScore: 40,
        pacingScore: 40,
        retentionScore: 40,
        ctaScore: 30,
      });
      expect(weakResult.viralScore).toBeLessThan(50);
      expect(weakResult.verdict).toBe('weak');
    });

    it('2.3 scores all 6 canonical hook styles properly', () => {
      const styles = [
        'question',
        'curiosity_gap',
        'bold_claim',
        'negative_warning',
        'story_opener',
        'before_after',
      ] as const;

      for (const style of styles) {
        const res = calculateHookScore({
          hookText: `Testing style ${style}`,
          style,
          pacingScore: 75,
          retentionScore: 75,
          ctaScore: 75,
        });
        expect(res.style).toBe(style);
        expect(res.viralScore).toBeGreaterThan(0);
        expect(res.viralScore).toBeLessThanOrEqual(100);
      }
    });

    it('2.4 computes Single Exponential Smoothing (SES) level recursion with alpha=0.40', () => {
      const series = [100, 120, 110, 140, 150];
      const forecast = calculateSESForecast(series, 0.4);

      // l_0 = 100
      // l_1 = 0.4*120 + 0.6*100 = 108
      // l_2 = 0.4*110 + 0.6*108 = 108.8
      // l_3 = 0.4*140 + 0.6*108.8 = 121.28
      // l_4 = 0.4*150 + 0.6*121.28 = 132.768 -> 132.77
      expect(forecast.alpha).toBe(0.4);
      expect(forecast.level).toBeCloseTo(132.77, 1);
      expect(forecast.residualStdDev).toBeGreaterThan(0);
    });

    it('2.5 generates 7-step forecast horizon with widening 95% confidence intervals', () => {
      const series = [50, 60, 55, 70, 80, 85, 95];
      const forecast = calculateSESForecast(series, 0.4, 7);

      expect(forecast.points).toHaveLength(7);
      for (let i = 0; i < forecast.points.length; i++) {
        const pt = forecast.points[i];
        expect(pt.step).toBe(i + 1);
        expect(pt.lower).toBeLessThanOrEqual(pt.projected);
        expect(pt.upper).toBeGreaterThanOrEqual(pt.projected);
        if (i > 0) {
          const prevSpread = forecast.points[i - 1].upper - forecast.points[i - 1].lower;
          const curSpread = pt.upper - pt.lower;
          expect(curSpread).toBeGreaterThanOrEqual(prevSpread);
        }
      }
    });
  });

  // ─── Feature 3: Autonomous Daily Campaign Generator ─────────────────────────
  describe('F3: Autonomous Daily Campaign Generator', () => {
    it('3.1 translates high-confidence winning patterns into campaign blueprints', async () => {
      await db
        .prepare(
          `INSERT INTO playbook_patterns (
            id, workspace_id, feature_key, feature_value, metric, avg_metric,
            sample_size, confidence, detected_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          'pat_1',
          'ws_test',
          'hook_style',
          'bold_claim',
          'ctr',
          0.082,
          50,
          0.85,
          Date.now(),
          Date.now(),
        )
        .run();

      const blueprints = await generateDailyCampaignBlueprints(db, 'ws_test', 0.7);
      expect(blueprints).toHaveLength(1);
      expect(blueprints[0].hookStyle).toBe('bold_claim');
      expect(blueprints[0].status).toBe('generated');
      expect(blueprints[0].confidence).toBe(0.85);
    });

    it('3.2 sets vertical 9:16 aspect ratio for TikTok and YouTube Shorts', async () => {
      await db
        .prepare(
          `INSERT INTO playbook_patterns (
            id, workspace_id, feature_key, feature_value, metric, avg_metric,
            sample_size, confidence, detected_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('pat_2', 'ws_test', 'platform', 'tiktok', 'shares', 120, 30, 0.9, Date.now(), Date.now())
        .run();

      const blueprints = await generateDailyCampaignBlueprints(db, 'ws_test');
      expect(blueprints[0].aspectRatios).toContain('9:16');
      expect(blueprints[0].targetPlatform).toBe('tiktok');
    });

    it('3.3 sets 16:9 and 1:1 aspect ratios for X (Twitter) blueprints', async () => {
      await db
        .prepare(
          `INSERT INTO playbook_patterns (
            id, workspace_id, feature_key, feature_value, metric, avg_metric,
            sample_size, confidence, detected_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('pat_x', 'ws_test', 'platform', 'x', 'retweets', 500, 25, 0.88, Date.now(), Date.now())
        .run();

      const blueprints = await generateDailyCampaignBlueprints(db, 'ws_test');
      expect(blueprints[0].targetPlatform).toBe('x');
      expect(blueprints[0].aspectRatios).toContain('16:9');
    });

    it('3.4 filters out patterns below minConfidence threshold', async () => {
      await db
        .prepare(
          `INSERT INTO playbook_patterns (
            id, workspace_id, feature_key, feature_value, metric, avg_metric,
            sample_size, confidence, detected_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('pat_low', 'ws_test', 'style', 'question', 'views', 10, 5, 0.4, Date.now(), Date.now())
        .run();

      const blueprints = await generateDailyCampaignBlueprints(db, 'ws_test', 0.75);
      expect(blueprints).toHaveLength(0);
    });

    it('3.5 persists generated blueprints to campaign_blueprints table with draft/generated status', async () => {
      await db
        .prepare(
          `INSERT INTO playbook_patterns (
            id, workspace_id, feature_key, feature_value, metric, avg_metric,
            sample_size, confidence, detected_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('pat_persist', 'ws_persist', 'hook_style', 'curiosity_gap', 'ctr', 0.09, 40, 0.8, Date.now(), Date.now())
        .run();

      const blueprints = await generateDailyCampaignBlueprints(db, 'ws_persist');
      const saved = await db
        .prepare('SELECT * FROM campaign_blueprints WHERE id = ?')
        .bind(blueprints[0].id)
        .first<{ id: string; status: string }>();

      expect(saved?.id).toBe(blueprints[0].id);
      expect(saved?.status).toBe('generated');
    });
  });

  // ─── Feature 4: Closed-Loop Viral Feedback Ingestion & OCC CAS ───────────────
  describe('F4: Closed-Loop Viral Feedback Ingestion & OCC CAS', () => {
    const timestamp = 1700000000000;

    beforeEach(async () => {
      await db
        .prepare(
          `INSERT INTO playbook_patterns (
            id, workspace_id, feature_key, feature_value, metric, avg_metric,
            sample_size, confidence, detected_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('pat_cas', 'ws_cas', 'hook_style', 'bold_claim', 'ces', 70.0, 10, 0.75, timestamp, timestamp)
        .run();
    });

    it('4.1 updates pattern score atomically when detected_at matches expected timestamp', async () => {
      const result = await ingestEngagementFeedback(db, {
        patternId: 'pat_cas',
        views: 10000,
        shares: 500,
        watchTimeSeconds: 250000,
        durationSeconds: 30,
        conversions: 100,
        spendCents: 500,
        expectedDetectedAt: timestamp,
      });

      expect(result.success).toBe(true);
      expect(result.patternId).toBe('pat_cas');
      expect(result.newSampleSize).toBe(11);
      expect(result.newDetectedAt).toBeGreaterThan(timestamp);

      const row = await db.prepare('SELECT detected_at FROM playbook_patterns WHERE id = ?').bind('pat_cas').first<{ detected_at: number }>();
      expect(row?.detected_at).toBe(result.newDetectedAt);
    });

    it('4.2 computes Creative Effectiveness Score (CES) combining CTR, retention, conversion, efficiency', async () => {
      const result = await ingestEngagementFeedback(db, {
        patternId: 'pat_cas',
        views: 20000,
        shares: 1000,
        watchTimeSeconds: 500000,
        durationSeconds: 30,
        conversions: 200,
        spendCents: 400,
        expectedDetectedAt: timestamp,
      });

      expect(result.newScore).toBeGreaterThan(0);
      expect(result.newScore).toBeLessThanOrEqual(100);
    });

    it('4.3 aborts update with collision error when detected_at has changed concurrently', async () => {
      const staleTimestamp = timestamp - 5000;
      const result = await ingestEngagementFeedback(db, {
        patternId: 'pat_cas',
        views: 5000,
        shares: 200,
        watchTimeSeconds: 100000,
        durationSeconds: 30,
        conversions: 50,
        spendCents: 200,
        expectedDetectedAt: staleTimestamp,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('CONCURRENT_MODIFICATION_COLLISION');
    });

    it('4.4 increments sample_size and increases pattern confidence on successful ingestion', async () => {
      const result = await ingestEngagementFeedback(db, {
        patternId: 'pat_cas',
        views: 1000,
        shares: 50,
        watchTimeSeconds: 25000,
        durationSeconds: 30,
        conversions: 10,
        spendCents: 100,
        expectedDetectedAt: timestamp,
      });

      expect(result.success).toBe(true);
      const row = await db.prepare('SELECT sample_size, confidence FROM playbook_patterns WHERE id = ?').bind('pat_cas').first<{ sample_size: number; confidence: number }>();
      expect(row?.sample_size).toBe(11);
      expect(row?.confidence).toBe(0.77);
    });

    it('4.5 guards against negative view or engagement metrics', async () => {
      const result = await ingestEngagementFeedback(db, {
        patternId: 'pat_cas',
        views: -100,
        shares: 50,
        watchTimeSeconds: 25000,
        durationSeconds: 30,
        conversions: 10,
        spendCents: 100,
        expectedDetectedAt: timestamp,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_METRICS_NEGATIVE');
    });
  });

  // ─── Feature 5: Marketplace Discovery Interface ──────────────────────────────
  describe('F5: Marketplace Discovery Interface', () => {
    beforeEach(async () => {
      const bps = [
        ['bp_m1', 'TikTok Viral Ecom', 'curiosity_gap', 'tiktok', 0.08, 'ecommerce'],
        ['bp_m2', 'Shorts Finance Formula', 'bold_claim', 'youtube_shorts', 0.06, 'finance'],
        ['bp_m3', 'X Tech Breakdown', 'question', 'x', 0.04, 'technology'],
        ['bp_m4', 'TikTok Fitness Transformation', 'before_after', 'tiktok', 0.09, 'fitness'],
      ] as const;

      for (const [id, title, style, platform, conv, niche] of bps) {
        await db
          .prepare(
            `INSERT INTO campaign_blueprints (
              id, workspace_id, title, hook_style, target_platform, aspect_ratios,
              estimated_scenes, estimated_duration_seconds, estimated_cost_cents,
              marketplace_listed, niche, conversion_rate, remix_count, creator_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            id,
            'ws_market',
            title,
            style,
            platform,
            '["9:16"]',
            5,
            30,
            50,
            1,
            niche,
            conv,
            10,
            'creator_123',
            Date.now(),
          )
          .run();
      }
    });

    it('5.1 lists publicly listed marketplace blueprints with pagination', async () => {
      const res = await listMarketplaceBlueprints(db, { page: 1, pageSize: 2 });
      expect(res.items).toHaveLength(2);
      expect(res.total).toBe(4);
      expect(res.totalPages).toBe(2);
      expect(res.page).toBe(1);
    });

    it('5.2 filters marketplace blueprints by niche', async () => {
      const res = await listMarketplaceBlueprints(db, { niche: 'finance' });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].niche).toBe('finance');
      expect(res.items[0].title).toBe('Shorts Finance Formula');
    });

    it('5.3 filters marketplace blueprints by target platform', async () => {
      const res = await listMarketplaceBlueprints(db, { platform: 'tiktok' });
      expect(res.items).toHaveLength(2);
      expect(res.items.every((i) => i.targetPlatform === 'tiktok')).toBe(true);
    });

    it('5.4 filters marketplace blueprints by minimum conversion rate threshold', async () => {
      const res = await listMarketplaceBlueprints(db, { minConversionRate: 0.07 });
      expect(res.items).toHaveLength(2);
      expect(res.items.every((i) => i.conversionRate >= 0.07)).toBe(true);
    });

    it('5.5 performs text search query matching blueprint titles', async () => {
      const res = await listMarketplaceBlueprints(db, { search: 'Fitness' });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].title).toContain('Fitness');
    });
  });

  // ─── Feature 6: Studio Blueprint Cloning & Pre-Flight Cost Estimator ─────────
  describe('F6: Studio Blueprint Cloning & Pre-Flight Cost Estimator', () => {
    beforeEach(async () => {
      await db
        .prepare(
          `INSERT INTO campaign_blueprints (
            id, workspace_id, title, hook_style, target_platform,
            estimated_scenes, estimated_duration_seconds, estimated_cost_cents, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('bp_clone', 'ws_bp', 'Viral Blueprint', 'curiosity_gap', 'tiktok', 6, 30, 47, Date.now())
        .run();
    });

    it('6.1 estimates preflight studio cost in MCU and USD cents based on scenes and duration', () => {
      // 6 scenes, 30s, 3 tracks
      const estimate = estimateBlueprintStudioCost(6, 30, 3);
      expect(estimate.llmMCU).toBe(50);
      expect(estimate.audioMCU).toBe(60);
      expect(estimate.visualMCU).toBe(240);
      expect(estimate.totalMCU).toBeGreaterThan(300);
      expect(estimate.totalCostCents).toBeGreaterThan(0);
      expect(estimate.isCeilingExceeded).toBe(false);
    });

    it('6.2 successfully clones blueprint into creative_missions table in draft status', async () => {
      const clone = await cloneBlueprintForMission(db, 'bp_clone', 'user_u1', 'ws_studio');
      expect(clone.success).toBe(true);
      expect(clone.missionId).toBeDefined();

      const mission = await db
        .prepare('SELECT * FROM creative_missions WHERE id = ?')
        .bind(clone.missionId)
        .first<{ id: string; status: string; blueprint_id: string }>();

      expect(mission?.status).toBe('draft');
      expect(mission?.blueprint_id).toBe('bp_clone');
    });

    it('6.3 increments remix_count on the original campaign blueprint', async () => {
      await cloneBlueprintForMission(db, 'bp_clone', 'user_u1', 'ws_studio');
      const bp = await db
        .prepare('SELECT remix_count FROM campaign_blueprints WHERE id = ?')
        .bind('bp_clone')
        .first<{ remix_count: number }>();

      expect(bp?.remix_count).toBe(1);
    });

    it('6.4 flags when estimated cost exceeds $5.00 (500 cents) spike ceiling', () => {
      // Extreme video: 100 scenes, 600s
      const spike = estimateBlueprintStudioCost(100, 600, 4);
      expect(spike.totalCostCents).toBeGreaterThan(500);
      expect(spike.isCeilingExceeded).toBe(true);
    });

    it('6.5 rejects cloning when blueprintId is not found', async () => {
      const result = await cloneBlueprintForMission(db, 'non_existent_bp', 'user_u1', 'ws_studio');
      expect(result.success).toBe(false);
      expect(result.error).toBe('BLUEPRINT_NOT_FOUND');
    });
  });

  // ─── Feature 7: Creator Royalty Attribution & Lineage ─────────────────────────
  describe('F7: Creator Royalty Attribution & Lineage', () => {
    it('7.1 records remix derivative relationship in blueprint_remixes table', async () => {
      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_root',
        parentCreatorId: 'creator_alice',
        remixerUserId: 'user_bob',
        missionId: 'mis_100',
        revenueCents: 5000,
        royaltyPercent: 10,
      });

      expect(res.success).toBe(true);
      const remixRow = await db
        .prepare('SELECT * FROM blueprint_remixes WHERE id = ?')
        .bind(res.remixId)
        .first<{ blueprint_id: string; creator_id: string; remixer_id: string }>();

      expect(remixRow?.blueprint_id).toBe('bp_root');
      expect(remixRow?.creator_id).toBe('creator_alice');
      expect(remixRow?.remixer_id).toBe('user_bob');
    });

    it('7.2 accrues creator revenue split in creator_earnings_ledger table', async () => {
      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_root',
        parentCreatorId: 'creator_alice',
        remixerUserId: 'user_bob',
        missionId: 'mis_100',
        revenueCents: 10000,
        royaltyPercent: 15,
      });

      expect(res.royaltyCents).toBe(1500); // 15% of $100.00
      const ledgerRow = await db
        .prepare('SELECT * FROM creator_earnings_ledger WHERE id = ?')
        .bind(res.ledgerId)
        .first<{ amount_cents: number; status: string }>();

      expect(ledgerRow?.amount_cents).toBe(1500);
      expect(ledgerRow?.status).toBe('pending');
    });

    it('7.3 calculates correct royalty share cents based on royaltyPercent', async () => {
      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_root',
        parentCreatorId: 'creator_alice',
        remixerUserId: 'user_carol',
        missionId: 'mis_200',
        revenueCents: 2550,
        royaltyPercent: 20,
      });

      expect(res.royaltyCents).toBe(510);
    });

    it('7.4 blocks self-remix royalty attribution fraud (creator == remixer)', async () => {
      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_root',
        parentCreatorId: 'creator_alice',
        remixerUserId: 'creator_alice', // Attempting to remix own blueprint for artificial earnings
        missionId: 'mis_self',
        revenueCents: 5000,
        royaltyPercent: 10,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
    });

    it('7.5 rejects invalid royalty percentage (<0 or >100)', async () => {
      const invalidNegative = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_root',
        parentCreatorId: 'creator_alice',
        remixerUserId: 'user_bob',
        missionId: 'mis_neg',
        revenueCents: 5000,
        royaltyPercent: -5,
      });
      expect(invalidNegative.success).toBe(false);
      expect(invalidNegative.error).toBe('INVALID_ROYALTY_PERCENT');

      const invalidOver100 = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_root',
        parentCreatorId: 'creator_alice',
        remixerUserId: 'user_bob',
        missionId: 'mis_over',
        revenueCents: 5000,
        royaltyPercent: 110,
      });
      expect(invalidOver100.success).toBe(false);
    });
  });

  // ─── Feature 8: 5-Network Affiliate Webhook Ingestion & Timing-Safe HMAC ─────
  describe('F8: 5-Network Affiliate Webhook Ingestion & Timing-Safe HMAC', () => {
    const secret = 'super_secret_webhook_key_2026';

    async function generateSignature(body: string): Promise<string> {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
      return Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }

    it('8.1 verifies TikTok Shop webhook with valid SHA-256 HMAC signature', async () => {
      const body = JSON.stringify({
        conversionId: 'tt_order_998',
        affiliateId: 'aff_tiktok_1',
        orderValueCents: 4500,
        commissionCents: 450,
      });
      const sig = await generateSignature(body);

      const res = await processAffiliateWebhook(db, 'tiktok_shop', body, sig, secret);
      expect(res.success).toBe(true);
      expect(res.network).toBe('tiktok_shop');
      expect(res.commissionCents).toBe(450);
    });

    it('8.2 verifies Amazon Associates webhook and records conversion in commission ledger', async () => {
      const body = JSON.stringify({
        conversionId: 'amz_order_123',
        affiliateId: 'aff_amz_2',
        orderValueCents: 10000,
        commissionCents: 400,
      });
      const sig = await generateSignature(body);

      const res = await processAffiliateWebhook(db, 'amazon_associates', body, sig, secret);
      expect(res.success).toBe(true);

      const row = await db
        .prepare('SELECT * FROM commission_ledger WHERE external_conversion_id = ?')
        .bind('amz_order_123')
        .first<{ commission_cents: number; network: string }>();

      expect(row?.commission_cents).toBe(400);
      expect(row?.network).toBe('amazon_associates');
    });

    it('8.3 verifies ClickBank webhook and assigns 14-day hold period', async () => {
      const now = Date.now();
      const body = JSON.stringify({
        conversionId: 'cb_receipt_456',
        affiliateId: 'aff_cb_3',
        commissionCents: 2500,
      });
      const sig = await generateSignature(body);

      const res = await processAffiliateWebhook(db, 'clickbank', body, sig, secret, now);
      expect(res.success).toBe(true);
      expect(res.payableAt).toBe(now + 14 * 86400 * 1000);
    });

    it('8.4 verifies AccessTrade webhook and tracks sub-ID attribution', async () => {
      const body = JSON.stringify({
        conversionId: 'at_click_789',
        affiliateId: 'aff_at_4',
        subId: 'campaign_tiktok_viral_01',
        commissionCents: 1500,
      });
      const sig = await generateSignature(body);

      const res = await processAffiliateWebhook(db, 'accesstrade', body, sig, secret);
      expect(res.success).toBe(true);

      const row = await db
        .prepare('SELECT sub_id FROM commission_ledger WHERE external_conversion_id = ?')
        .bind('at_click_789')
        .first<{ sub_id: string }>();

      expect(row?.sub_id).toBe('campaign_tiktok_viral_01');
    });

    it('8.5 verifies Awin webhook and rejects requests with invalid HMAC signatures', async () => {
      const body = JSON.stringify({
        conversionId: 'awin_trans_001',
        affiliateId: 'aff_awin_5',
        commissionCents: 800,
      });

      const res = await processAffiliateWebhook(
        db,
        'awin',
        body,
        'invalid_hex_signature_deadbeef',
        secret,
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe('INVALID_HMAC_SIGNATURE');
    });
  });

  // ─── Feature 9: 14-Day Anti-Fraud Clawback Hold & Dual-Entry Ledger ──────────
  describe('F9: 14-Day Anti-Fraud Clawback Hold & Dual-Entry Ledger', () => {
    const baseTime = 1700000000000;
    const holdMs = 14 * 86400 * 1000;

    beforeEach(async () => {
      await db
        .prepare(
          `INSERT INTO commission_ledger (
            id, affiliate_id, network, external_conversion_id, order_value_cents,
            commission_cents, status, hold_days, attributed_at, payable_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          'com_1',
          'aff_hold',
          'tiktok_shop',
          'conv_hold_1',
          5000,
          1000,
          'pending',
          14,
          baseTime,
          baseTime + holdMs,
          baseTime,
        )
        .run();
    });

    it('9.1 enforces 14-day hold period (payable_at = attributed_at + 14 * 86400s)', async () => {
      const row = await db
        .prepare('SELECT attributed_at, payable_at FROM commission_ledger WHERE id = ?')
        .bind('com_1')
        .first<{ attributed_at: number; payable_at: number }>();

      expect(row?.payable_at).toBe(row!.attributed_at + 14 * 86400 * 1000);
    });

    it('9.2 flips pending rows to payable when timestamp reaches payable_at', async () => {
      const changes = await flipPendingToPayable(db, baseTime + holdMs + 1000);
      expect(changes).toBe(1);

      const row = await db
        .prepare('SELECT status FROM commission_ledger WHERE id = ?')
        .bind('com_1')
        .first<{ status: string }>();

      expect(row?.status).toBe('payable');
    });

    it('9.3 does not flip pending rows before 14-day hold expiration', async () => {
      const prematureTime = baseTime + holdMs - 1000;
      const changes = await flipPendingToPayable(db, prematureTime);
      expect(changes).toBe(0);

      const row = await db
        .prepare('SELECT status FROM commission_ledger WHERE id = ?')
        .bind('com_1')
        .first<{ status: string }>();

      expect(row?.status).toBe('pending');
    });

    it('9.4 records negative adjustment row for clawback refunds without mutating original record', async () => {
      const clawback = await recordClawbackAdjustment(db, 'conv_hold_1', 1000, baseTime + 10000);
      expect(clawback.success).toBe(true);
      expect(clawback.amountCents).toBe(-1000);

      // Verify original row is preserved unchanged
      const original = await db
        .prepare('SELECT commission_cents, status FROM commission_ledger WHERE id = ?')
        .bind('com_1')
        .first<{ commission_cents: number; status: string }>();

      expect(original?.commission_cents).toBe(1000);
      expect(original?.status).toBe('pending');

      // Verify new adjustment row
      const adjustment = await db
        .prepare('SELECT commission_cents, status, parent_id FROM commission_ledger WHERE id = ?')
        .bind(clawback.adjustmentId)
        .first<{ commission_cents: number; status: string; parent_id: string }>();

      expect(adjustment?.commission_cents).toBe(-1000);
      expect(adjustment?.status).toBe('clawback');
      expect(adjustment?.parent_id).toBe('com_1');
    });

    it('9.5 accurately calculates dual-entry net creator earnings balance', async () => {
      // Original commission = 1000
      // Refund clawback = -400
      await recordClawbackAdjustment(db, 'conv_hold_1', 400);

      const netBalance = await getNetAffiliateBalance(db, 'aff_hold');
      expect(netBalance).toBe(600); // 1000 - 400 = 600 cents
    });
  });

  // ─── Feature 10: NOWPayments USDT Mass Payouts & Daily Financial Reconciliation
  describe('F10: NOWPayments USDT Mass Payouts & Daily Financial Reconciliation', () => {
    beforeEach(async () => {
      await db
        .prepare(
          `INSERT INTO commission_ledger (
            id, affiliate_id, network, external_conversion_id, commission_cents,
            status, hold_days, attributed_at, payable_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('com_pay_1', 'aff_usdt_1', 'tiktok_shop', 'conv_p1', 5000, 'payable', 14, 1000, 2000, 1000)
        .run();

      await db
        .prepare(
          `INSERT INTO commission_ledger (
            id, affiliate_id, network, external_conversion_id, commission_cents,
            status, hold_days, attributed_at, payable_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('com_pay_2', 'aff_usdt_2', 'clickbank', 'conv_p2', 8000, 'payable', 14, 1000, 2000, 1000)
        .run();
    });

    it('10.1 claims payable rows atomically via CAS preventing double-payouts', async () => {
      const batch = await processPayoutBatch(db, 'nowpayments_usdt');
      expect(batch.success).toBe(true);
      expect(batch.claimedRowIds).toHaveLength(2);

      const row = await db
        .prepare('SELECT status, payout_batch_id FROM commission_ledger WHERE id = ?')
        .bind('com_pay_1')
        .first<{ status: string; payout_batch_id: string }>();

      expect(row?.status).toBe('paying');
      expect(row?.payout_batch_id).toBe(batch.batchId);
    });

    it('10.2 generates payout batch with aggregate USDT cents and recipient count', async () => {
      const batch = await processPayoutBatch(db, 'nowpayments_usdt');
      expect(batch.totalAmountCents).toBe(13000); // 5000 + 8000
      expect(batch.recipientCount).toBe(2);
    });

    it('10.3 enforces minimum payout threshold ($1.00 = 100 cents)', async () => {
      // Insert sub-threshold row (50 cents)
      await db
        .prepare(
          `INSERT INTO commission_ledger (
            id, affiliate_id, network, external_conversion_id, commission_cents,
            status, hold_days, attributed_at, payable_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('com_small', 'aff_small', 'awin', 'conv_small', 50, 'payable', 14, 1000, 2000, 1000)
        .run();

      const batch = await processPayoutBatch(db, 'nowpayments_usdt');
      expect(batch.claimedRowIds).not.toContain('com_small');
    });

    it('10.4 reconciles confirmed payout batch when difference is within $1.00 tolerance', async () => {
      const batch = await processPayoutBatch(db, 'nowpayments_usdt');
      const recon = await reconcileDailyFinancials(db, batch.batchId!, 13050); // diff = 50 cents <= $1.00

      expect(recon.isReconciled).toBe(true);
      expect(recon.alertRequired).toBe(false);
      expect(recon.diffCents).toBe(50);
    });

    it('10.5 flags alert and fails reconciliation when external difference exceeds $1.00', async () => {
      const batch = await processPayoutBatch(db, 'nowpayments_usdt');
      const recon = await reconcileDailyFinancials(db, batch.batchId!, 11000); // diff = 2000 cents ($20)

      expect(recon.isReconciled).toBe(false);
      expect(recon.alertRequired).toBe(true);
      expect(recon.diffCents).toBe(2000);
    });
  });

  // ─── Feature 11: Mekong Cloudflare Tunnel & Hybrid Edge Router ───────────────
  describe('F11: Mekong Cloudflare Tunnel & Hybrid Edge Router', () => {
    beforeEach(async () => {
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          'node_m1',
          'Mac Studio M1 Max (Local 0-Cost)',
          'https://edge-m1.cashclaw.cc/api/v1/inference',
          'bearer_secret_123',
          'ONLINE',
          'apple_m1_max',
          'unmetered',
          Date.now(),
          Date.now(),
        )
        .run();
    });

    it('11.1 routes inference task to local Apple Silicon node when ONLINE (unmetered cost)', async () => {
      const result = await routeInferenceTask(
        {
          taskId: 'task_llm_1',
          type: 'llm',
          prompt: 'Generate viral hooks for TikTok',
          model: 'qwen2.5:7b',
        },
        db,
      );

      expect(result.provider).toBe('mekong_m1_max');
      expect(result.costKind).toBe('unmetered');
      expect(result.latencyMs).toBeLessThan(200);
    });

    it('11.2 encrypts inference payloads over Cloudflare Tunnel connection', async () => {
      const result = await routeInferenceTask(
        {
          taskId: 'task_enc',
          type: 'tts',
          prompt: 'Voice synthesis sample text',
          model: 'kokoro',
        },
        db,
      );

      expect(result.encrypted).toBe(true);
    });

    it('11.3 routes LLM generation tasks with low local latency', async () => {
      const result = await routeInferenceTask(
        {
          taskId: 'task_latency',
          type: 'llm',
          prompt: 'Fast script generation',
          model: 'qwen2.5:7b',
        },
        db,
        'node_m1',
      );

      expect(result.latencyMs).toBe(120);
    });

    it('11.4 transparently falls back to cloud BYOK provider when preferred node is OFFLINE', async () => {
      // Mark node OFFLINE
      await db.prepare("UPDATE edge_nodes SET status = 'OFFLINE' WHERE id = 'node_m1'").run();

      const result = await routeInferenceTask(
        {
          taskId: 'task_fallback',
          type: 'llm',
          prompt: 'Failover test prompt',
          model: 'anthropic/claude-3-5-sonnet',
        },
        db,
      );

      expect(result.provider).toBe('cloud_byok');
      expect(result.costKind).toBe('metered');
    });

    it('11.5 marks cloud BYOK fallback executions as metered cost', async () => {
      await db.prepare("UPDATE edge_nodes SET status = 'OFFLINE' WHERE id = 'node_m1'").run();

      const result = await routeInferenceTask(
        {
          taskId: 'task_cost',
          type: 'image',
          prompt: 'Scene thumbnail prompt',
          model: 'fal-ai/flux-schnell',
        },
        db,
      );

      expect(result.costKind).toBe('metered');
    });
  });

  // ─── Feature 12: 15-Second Edge Node Health & Failover ─────────────────────────
  describe('F12: 15-Second Edge Node Health & Failover', () => {
    it('12.1 probes edge node status within 2500ms timeout', async () => {
      const probe = await probeEdgeNode(
        'https://edge-m1.cashclaw.cc/api/v1/inference',
        'bearer_token',
        2500,
      );
      expect(probe.status).toBe('ONLINE');
      expect(probe.reachable).toBe(true);
      expect(probe.latencyMs).toBeLessThan(2500);
    });

    it('12.2 detects offline node transition when heartbeat exceeds 15 seconds', async () => {
      const now = Date.now();
      const staleHeartbeat = now - 16000; // 16 seconds ago (> 15s)

      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_stale', 'Stale M1', 'https://stale.cashclaw.cc', 'token', 'ONLINE', 'm1', 'unmetered', staleHeartbeat, now)
        .run();

      const report = await checkClusterHealth(db, now, 15);
      expect(report.transitionsToOffline).toContain('node_stale');
      expect(report.offlineCount).toBe(1);

      const row = await db.prepare('SELECT status FROM edge_nodes WHERE id = ?').bind('node_stale').first<{ status: string }>();
      expect(row?.status).toBe('OFFLINE');
    });

    it('12.3 preserves ONLINE state when heartbeat is within 15 seconds', async () => {
      const now = Date.now();
      const freshHeartbeat = now - 8000; // 8 seconds ago (< 15s)

      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_fresh', 'Fresh M1', 'https://fresh.cashclaw.cc', 'token', 'ONLINE', 'm1', 'unmetered', freshHeartbeat, now)
        .run();

      const report = await checkClusterHealth(db, now, 15);
      expect(report.transitionsToOffline).not.toContain('node_fresh');
      expect(report.onlineCount).toBe(1);
    });

    it('12.4 transitions multiple stale nodes in cluster health check', async () => {
      const now = Date.now();
      const staleTime = now - 20000;

      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_a', 'Node A', 'https://a.cashclaw.cc', 'token', 'ONLINE', 'm1', 'unmetered', staleTime, now)
        .run();

      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_b', 'Node B', 'https://b.cashclaw.cc', 'token', 'ONLINE', 'm1', 'unmetered', staleTime, now)
        .run();

      const report = await checkClusterHealth(db, now, 15);
      expect(report.transitionsToOffline).toEqual(expect.arrayContaining(['node_a', 'node_b']));
    });

    it('12.5 marks unreachable node endpoints as OFFLINE during preflight probe', async () => {
      const probe = await probeEdgeNode(
        'https://unreachable-edge.cashclaw.cc/api/v1/inference',
        'bearer_token',
      );
      expect(probe.status).toBe('OFFLINE');
      expect(probe.reachable).toBe(false);
    });
  });
});
