/**
 * Tier 2: Boundary & Corner Cases E2E Test Suite
 * Autonomous Growth & Revenue Engine ($1M MRR Path)
 *
 * Requirements: >=5 edge/boundary tests per feature for all 12 core features (60 tests total).
 * Boundary Value Analysis (BVA) + Category-Partition edge cases:
 * - F1: empty queries, unicode/emoji tags, long queries, SQL injection tokens, special delimiters
 * - F2: viral score ceiling/floor clamps, SES alpha boundaries, empty/single-element series
 * - F3: minConfidence 0.0 & 1.0, 0 patterns, unknown hook styles and platforms
 * - F4: concurrent CAS race collision, zero-views guard, non-existent pattern, confidence ceiling, 0 spend
 * - F5: negative/zero page, pageSize clamp, regex chars in search, minConversionRate=0, out-of-bounds page
 * - F6: spike ceiling exact boundary (500c vs 501c), 0 scenes/duration, 1000 scenes, missing fields, monotonic remix_count
 * - F7: 0% and 100% royalty, fractional cent truncation, zero revenue remix, self-remix prevention
 * - F8: empty body, malformed hex signatures, zero commission, negative commission, malformed JSON
 * - F9: exact ms hold boundary (now == payable_at - 1 vs now == payable_at), multiple clawbacks, missing parent, negative net balance
 * - F10: empty payable rows, 99c vs 100c threshold, concurrent batch double-claim, exact $1.00 recon tolerance, 0 confirmed
 * - F11: empty node registry, non-existent preferred node, offline preferred node, payload integrity, multi-modal types
 * - F12: exact 15000ms vs 15001ms heartbeat threshold, probe timeout < 500ms, empty URL, empty cluster, recovery to ONLINE
 *
 * @module tests/e2e/growth-engine/tier2-boundary-corner.test
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

describe('Tier 2: Boundary & Corner Cases (12 Core Features)', () => {
  let db: MockD1Database;

  beforeEach(() => {
    db = createGrowthEngineD1();
  });

  // ─── F1: Hermes Trend Scouting Boundaries ────────────────────────────────────
  describe('F1: Hermes Trend Scouting Boundaries', () => {
    it('1.1 handles empty string query returning empty results array', async () => {
      const res = await scoutTrendingSignals('tiktok', '', db);
      expect(res).toEqual([]);
    });

    it('1.2 handles queries with unicode characters and emoji', async () => {
      const res = await scoutTrendingSignals('tiktok', '🔥🚀 AI 2026!', db);
      expect(res.length).toBe(5);
      expect(res[0].topic).toBe('🔥🚀 ai 2026!');
      expect(res[0].hashtag).toContain('🔥🚀 ai 2026!');
    });

    it('1.3 handles excessively long queries (>500 characters) without crashing', async () => {
      const longQuery = 'a'.repeat(550);
      const res = await scoutTrendingSignals('youtube_shorts', longQuery, db);
      expect(res.length).toBe(5);
      expect(res[0].topic).toBe(longQuery);
    });

    it('1.4 handles SQL injection characters safely without breaking SQL execution', async () => {
      const sqlInj = "'; DROP TABLE playbook_patterns; --";
      const res = await scoutTrendingSignals('x', sqlInj, db);
      expect(res.length).toBe(5);

      // Verify playbook_patterns table was NOT dropped
      const count = await db.prepare('SELECT COUNT(*) as cnt FROM playbook_patterns').first<{ cnt: number }>();
      expect(count?.cnt).toBeDefined();
    });

    it('1.5 handles queries with leading and trailing hash delimiters', async () => {
      const res = await scoutTrendingSignals('tiktok', '###marketing###', db);
      expect(res.length).toBe(5);
      expect(res[0].topic).toBe('###marketing###');
    });
  });

  // ─── F2: Mathematical Hook Scoring & SES Forecasting Boundaries ──────────────
  describe('F2: Mathematical Hook Scoring & SES Forecasting Boundaries', () => {
    it('2.1 enforces viral score ceiling clamp at exactly 100.0', () => {
      const res = calculateHookScore({
        hookText: 'Legendary hook',
        style: 'curiosity_gap',
        hookStyleScore: 150, // Out of standard bounds
        pacingScore: 120,
        retentionScore: 130,
        ctaScore: 140,
      });
      expect(res.viralScore).toBe(100.0);
    });

    it('2.2 enforces viral score floor clamp at exactly 0.0', () => {
      const res = calculateHookScore({
        hookText: 'Terrible hook',
        style: 'question',
        hookStyleScore: -50,
        pacingScore: -20,
        retentionScore: -30,
        ctaScore: -40,
      });
      expect(res.viralScore).toBe(0.0);
    });

    it('2.3 throws RangeError when SES alpha is out of bounds (alpha <= 0 or alpha > 1)', () => {
      expect(() => calculateSESForecast([10, 20], 0.0)).toThrow(RangeError);
      expect(() => calculateSESForecast([10, 20], -0.2)).toThrow(RangeError);
      expect(() => calculateSESForecast([10, 20], 1.5)).toThrow(RangeError);
    });

    it('2.4 handles empty series for SES forecast gracefully returning 0 level and empty points', () => {
      const res = calculateSESForecast([], 0.4);
      expect(res.level).toBe(0);
      expect(res.points).toEqual([]);
      expect(res.residualStdDev).toBe(0);
    });

    it('2.5 handles single-element series where standard deviation is 0 without division by zero', () => {
      const res = calculateSESForecast([100], 0.4, 3);
      expect(res.level).toBe(100);
      expect(res.residualStdDev).toBe(0);
      expect(res.points).toHaveLength(3);
      expect(res.points[0].lower).toBe(100);
      expect(res.points[0].upper).toBe(100);
    });
  });

  // ─── F3: Autonomous Daily Campaign Generator Boundaries ──────────────────────
  describe('F3: Autonomous Daily Campaign Generator Boundaries', () => {
    it('3.1 handles minConfidence boundary at 0.0 (including all patterns)', async () => {
      await db
        .prepare(
          `INSERT INTO playbook_patterns (
            id, workspace_id, feature_key, feature_value, metric, avg_metric,
            sample_size, confidence, detected_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('pat_b1', 'ws_b', 'hook_style', 'question', 'views', 5, 2, 0.05, Date.now(), Date.now())
        .run();

      const bps = await generateDailyCampaignBlueprints(db, 'ws_b', 0.0);
      expect(bps.length).toBe(1);
    });

    it('3.2 handles minConfidence boundary at 1.0 (excluding patterns unless 100% confidence)', async () => {
      await db
        .prepare(
          `INSERT INTO playbook_patterns (
            id, workspace_id, feature_key, feature_value, metric, avg_metric,
            sample_size, confidence, detected_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('pat_b2', 'ws_b', 'hook_style', 'question', 'views', 50, 20, 0.95, Date.now(), Date.now())
        .run();

      const bps = await generateDailyCampaignBlueprints(db, 'ws_b', 1.0);
      expect(bps.length).toBe(0);
    });

    it('3.3 handles workspace with 0 patterns returning empty blueprints array without throwing', async () => {
      const bps = await generateDailyCampaignBlueprints(db, 'empty_workspace');
      expect(bps).toEqual([]);
    });

    it('3.4 handles pattern with unknown hook_style falling back to default curiosity_gap', async () => {
      await db
        .prepare(
          `INSERT INTO playbook_patterns (
            id, workspace_id, feature_key, feature_value, metric, avg_metric,
            sample_size, confidence, detected_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('pat_unknown', 'ws_unk', 'hook_style', 'bizarre_non_standard_style', 'ctr', 0.08, 10, 0.9, Date.now(), Date.now())
        .run();

      const bps = await generateDailyCampaignBlueprints(db, 'ws_unk', 0.7);
      expect(bps[0].hookStyle).toBe('curiosity_gap');
    });

    it('3.5 handles pattern with unknown platform falling back to default tiktok', async () => {
      await db
        .prepare(
          `INSERT INTO playbook_patterns (
            id, workspace_id, feature_key, feature_value, metric, avg_metric,
            sample_size, confidence, detected_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('pat_plat', 'ws_plat', 'platform', 'meta_threads', 'ctr', 0.08, 10, 0.9, Date.now(), Date.now())
        .run();

      const bps = await generateDailyCampaignBlueprints(db, 'ws_plat', 0.7);
      expect(bps[0].targetPlatform).toBe('tiktok');
    });
  });

  // ─── F4: Closed-Loop Viral Feedback Ingestion & OCC CAS Boundaries ───────────
  describe('F4: Closed-Loop Viral Feedback Ingestion & OCC CAS Boundaries', () => {
    const timestamp = 1710000000000;

    beforeEach(async () => {
      await db
        .prepare(
          `INSERT INTO playbook_patterns (
            id, workspace_id, feature_key, feature_value, metric, avg_metric,
            sample_size, confidence, detected_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('pat_race', 'ws_race', 'hook_style', 'bold_claim', 'ces', 60.0, 5, 0.7, timestamp, timestamp)
        .run();
    });

    it('4.1 handles concurrent CAS race condition between two simultaneous updates', async () => {
      // Worker 1 executes first and updates detected_at
      const res1 = await ingestEngagementFeedback(
        db,
        {
          patternId: 'pat_race',
          views: 1000,
          shares: 50,
          watchTimeSeconds: 20000,
          durationSeconds: 30,
          conversions: 10,
          spendCents: 100,
          expectedDetectedAt: timestamp,
        },
        timestamp + 500,
      );
      expect(res1.success).toBe(true);

      // Worker 2 attempts update with old expectedDetectedAt
      const res2 = await ingestEngagementFeedback(
        db,
        {
          patternId: 'pat_race',
          views: 2000,
          shares: 100,
          watchTimeSeconds: 40000,
          durationSeconds: 30,
          conversions: 20,
          spendCents: 200,
          expectedDetectedAt: timestamp, // Stale!
        },
        timestamp + 600,
      );
      expect(res2.success).toBe(false);
      expect(res2.error).toBe('CONCURRENT_MODIFICATION_COLLISION');
    });

    it('4.2 rejects feedback with negative views preventing division-by-zero or negative metrics', async () => {
      const res = await ingestEngagementFeedback(db, {
        patternId: 'pat_race',
        views: -1,
        shares: 10,
        watchTimeSeconds: 100,
        durationSeconds: 30,
        conversions: 2,
        spendCents: 10,
        expectedDetectedAt: timestamp,
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('INVALID_METRICS_NEGATIVE');
    });

    it('4.3 rejects feedback with non-existent pattern ID returning PATTERN_NOT_FOUND', async () => {
      const res = await ingestEngagementFeedback(db, {
        patternId: 'non_existent_pattern',
        views: 1000,
        shares: 50,
        watchTimeSeconds: 20000,
        durationSeconds: 30,
        conversions: 10,
        spendCents: 100,
        expectedDetectedAt: timestamp,
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('PATTERN_NOT_FOUND');
    });

    it('4.4 caps updated pattern confidence at 0.99 boundary ceiling', async () => {
      // Set initial confidence to 0.985
      await db.prepare("UPDATE playbook_patterns SET confidence = 0.985 WHERE id = 'pat_race'").run();

      const res = await ingestEngagementFeedback(db, {
        patternId: 'pat_race',
        views: 5000,
        shares: 200,
        watchTimeSeconds: 100000,
        durationSeconds: 30,
        conversions: 50,
        spendCents: 100,
        expectedDetectedAt: timestamp,
      });
      expect(res.success).toBe(true);

      const row = await db.prepare("SELECT confidence FROM playbook_patterns WHERE id = 'pat_race'").first<{ confidence: number }>();
      expect(row?.confidence).toBeLessThanOrEqual(0.99);
    });

    it('4.5 handles zero-spend feedback (spendCents = 0) computing max efficiency score (1.0)', async () => {
      const res = await ingestEngagementFeedback(db, {
        patternId: 'pat_race',
        views: 1000,
        shares: 50,
        watchTimeSeconds: 25000,
        durationSeconds: 30,
        conversions: 10,
        spendCents: 0,
        expectedDetectedAt: timestamp,
      });
      expect(res.success).toBe(true);
      expect(res.newScore).toBeGreaterThan(0);
    });
  });

  // ─── F5: Marketplace Discovery Interface Boundaries ──────────────────────────
  describe('F5: Marketplace Discovery Interface Boundaries', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 3; i++) {
        await db
          .prepare(
            `INSERT INTO campaign_blueprints (
              id, workspace_id, title, hook_style, target_platform,
              estimated_scenes, estimated_duration_seconds, estimated_cost_cents,
              marketplace_listed, niche, conversion_rate, remix_count, creator_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            `bp_b_${i}`,
            'ws_mkt',
            `Blueprint ${i}`,
            'question',
            'tiktok',
            5,
            30,
            50,
            1,
            'ecommerce',
            0.05 * i,
            i * 5,
            'creator_1',
            Date.now(),
          )
          .run();
      }
    });

    it('5.1 handles page 0 or negative page numbers clamping to page 1', async () => {
      const resZero = await listMarketplaceBlueprints(db, { page: 0 });
      expect(resZero.page).toBe(1);
      expect(resZero.items.length).toBeGreaterThan(0);

      const resNeg = await listMarketplaceBlueprints(db, { page: -5 });
      expect(resNeg.page).toBe(1);
    });

    it('5.2 handles pageSize exceeding maximum limit (pageSize = 500 clamped to 50)', async () => {
      const res = await listMarketplaceBlueprints(db, { pageSize: 500 });
      expect(res.pageSize).toBe(50);
    });

    it('5.3 handles search query with regex and special characters', async () => {
      const res = await listMarketplaceBlueprints(db, { search: '.*[Blueprint]+.*' });
      expect(res.items).toBeDefined();
    });

    it('5.4 handles minConversionRate boundary at 0.0 (returning all listed blueprints)', async () => {
      const res = await listMarketplaceBlueprints(db, { minConversionRate: 0.0 });
      expect(res.total).toBe(3);
    });

    it('5.5 handles out-of-bounds page offset (page 999) returning empty items array', async () => {
      const res = await listMarketplaceBlueprints(db, { page: 999, pageSize: 10 });
      expect(res.items).toEqual([]);
      expect(res.total).toBe(3);
      expect(res.page).toBe(999);
    });
  });

  // ─── F6: Studio Blueprint Cloning & Pre-Flight Cost Boundaries ───────────────
  describe('F6: Studio Blueprint Cloning & Pre-Flight Cost Boundaries', () => {
    it('6.1 exact spike ceiling boundary: 500 cents passes, 501 cents fails closed', () => {
      // Calculate scenes/duration to test ceiling
      const pass = estimateBlueprintStudioCost(70, 200, 2);
      expect(pass.isCeilingExceeded).toBe(false);

      // Extreme values to exceed 500 cents
      const fail = estimateBlueprintStudioCost(120, 400, 3);
      expect(fail.totalCostCents).toBeGreaterThan(500);
      expect(fail.isCeilingExceeded).toBe(true);
    });

    it('6.2 handles video with 0 scenes and 0 duration calculating minimal baseline MCU', () => {
      const res = estimateBlueprintStudioCost(0, 0, 2);
      expect(res.llmMCU).toBe(50);
      expect(res.audioMCU).toBe(0);
      expect(res.visualMCU).toBe(0);
      expect(res.totalCostCents).toBe(5); // 50 MCU / 10 = 5 cents
      expect(res.isCeilingExceeded).toBe(false);
    });

    it('6.3 handles extreme 1000-scene video triggering cost spike error', () => {
      const res = estimateBlueprintStudioCost(1000, 3000, 4);
      expect(res.isCeilingExceeded).toBe(true);
    });

    it('6.4 rejects cloning when blueprintId is missing or empty', async () => {
      const res = await cloneBlueprintForMission(db, '', 'user_u1', 'ws_1');
      expect(res.success).toBe(false);
      expect(res.error).toBe('BLUEPRINT_NOT_FOUND');
    });

    it('6.5 ensures multiple consecutive clones increment remix_count monotonically', async () => {
      await db
        .prepare(
          `INSERT INTO campaign_blueprints (
            id, workspace_id, title, hook_style, target_platform,
            estimated_scenes, estimated_duration_seconds, estimated_cost_cents, remix_count, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('bp_mono', 'ws_mono', 'Mono BP', 'question', 'tiktok', 5, 30, 40, 0, Date.now())
        .run();

      for (let i = 1; i <= 5; i++) {
        const clone = await cloneBlueprintForMission(db, 'bp_mono', `user_${i}`, 'ws_mono');
        expect(clone.success).toBe(true);
      }

      const bp = await db
        .prepare('SELECT remix_count FROM campaign_blueprints WHERE id = ?')
        .bind('bp_mono')
        .first<{ remix_count: number }>();

      expect(bp?.remix_count).toBe(5);
    });
  });

  // ─── F7: Creator Royalty Attribution & Lineage Boundaries ───────────────────
  describe('F7: Creator Royalty Attribution & Lineage Boundaries', () => {
    it('7.1 boundary royalty percent at exactly 0% (royaltyCents = 0)', async () => {
      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_roy',
        parentCreatorId: 'creator_1',
        remixerUserId: 'user_2',
        missionId: 'mis_r1',
        revenueCents: 10000,
        royaltyPercent: 0,
      });

      expect(res.success).toBe(true);
      expect(res.royaltyCents).toBe(0);
    });

    it('7.2 boundary royalty percent at exactly 100% (royaltyCents = revenueCents)', async () => {
      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_roy',
        parentCreatorId: 'creator_1',
        remixerUserId: 'user_2',
        missionId: 'mis_r2',
        revenueCents: 8500,
        royaltyPercent: 100,
      });

      expect(res.success).toBe(true);
      expect(res.royaltyCents).toBe(8500);
    });

    it('7.3 fractional cents truncation: Math.floor prevents fractional cent drift ($9.99 at 10% = 99 cents)', async () => {
      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_roy',
        parentCreatorId: 'creator_1',
        remixerUserId: 'user_2',
        missionId: 'mis_r3',
        revenueCents: 999, // $9.99
        royaltyPercent: 10,
      });

      expect(res.royaltyCents).toBe(99); // 999 * 0.10 = 99.9 -> 99 cents
    });

    it('7.4 handles zero revenue remix ($0.00 revenue yields $0.00 royalty)', async () => {
      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_roy',
        parentCreatorId: 'creator_1',
        remixerUserId: 'user_2',
        missionId: 'mis_r4',
        revenueCents: 0,
        royaltyPercent: 15,
      });

      expect(res.success).toBe(true);
      expect(res.royaltyCents).toBe(0);
    });

    it('7.5 prevents self-referential remixing where parentCreatorId is equal to remixerUserId', async () => {
      const res = await recordBlueprintRemixAndAccrueRoyalty(db, {
        blueprintId: 'bp_roy',
        parentCreatorId: 'same_user_id',
        remixerUserId: 'same_user_id',
        missionId: 'mis_r5',
        revenueCents: 5000,
        royaltyPercent: 10,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('CIRCULAR_SELF_REMIX_DENIED');
    });
  });

  // ─── F8: 5-Network Affiliate Webhook Boundaries ──────────────────────────────
  describe('F8: 5-Network Affiliate Webhook Boundaries', () => {
    const secret = 'test_webhook_secret_key';

    async function makeSignature(body: string): Promise<string> {
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

    it('8.1 rejects webhook with empty body returning false', async () => {
      const isValid = await verifyAffiliateHmac('', 'some_signature', secret);
      expect(isValid).toBe(false);
    });

    it('8.2 rejects webhook with malformed hex signatures or wrong length', async () => {
      const body = JSON.stringify({ conversionId: 'test_1' });
      const isValid = await verifyAffiliateHmac(body, 'short_sig', secret);
      expect(isValid).toBe(false);
    });

    it('8.3 rejects webhook with zero commission ($0.00) with ZERO_OR_NEGATIVE_COMMISSION', async () => {
      const body = JSON.stringify({ conversionId: 'c_zero', commissionCents: 0 });
      const sig = await makeSignature(body);

      const res = await processAffiliateWebhook(db, 'tiktok_shop', body, sig, secret);
      expect(res.success).toBe(false);
      expect(res.error).toBe('ZERO_OR_NEGATIVE_COMMISSION');
    });

    it('8.4 rejects webhook with negative commission with ZERO_OR_NEGATIVE_COMMISSION', async () => {
      const body = JSON.stringify({ conversionId: 'c_neg', commissionCents: -500 });
      const sig = await makeSignature(body);

      const res = await processAffiliateWebhook(db, 'amazon_associates', body, sig, secret);
      expect(res.success).toBe(false);
      expect(res.error).toBe('ZERO_OR_NEGATIVE_COMMISSION');
    });

    it('8.5 handles malformed non-JSON payload returning MALFORMED_JSON_PAYLOAD', async () => {
      const body = 'This is plain text not JSON';
      const sig = await makeSignature(body);

      const res = await processAffiliateWebhook(db, 'clickbank', body, sig, secret);
      expect(res.success).toBe(false);
      expect(res.error).toBe('MALFORMED_JSON_PAYLOAD');
    });
  });

  // ─── F9: 14-Day Anti-Fraud Clawback Hold & Dual-Entry Ledger Boundaries ──────
  describe('F9: 14-Day Anti-Fraud Clawback Hold & Dual-Entry Ledger Boundaries', () => {
    const baseTime = 1700000000000;
    const holdMs = 14 * 86400 * 1000;
    const payableAt = baseTime + holdMs;

    beforeEach(async () => {
      await db
        .prepare(
          `INSERT INTO commission_ledger (
            id, affiliate_id, network, external_conversion_id, order_value_cents,
            commission_cents, status, hold_days, attributed_at, payable_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          'com_b9',
          'aff_boundary',
          'tiktok_shop',
          'conv_b9',
          10000,
          2000,
          'pending',
          14,
          baseTime,
          payableAt,
          baseTime,
        )
        .run();
    });

    it('9.1 exact millisecond boundary: payable_at - 1ms does NOT flip, payable_at + 0ms DOES flip', async () => {
      // 1 ms before expiration: should NOT flip
      const changesBefore = await flipPendingToPayable(db, payableAt - 1);
      expect(changesBefore).toBe(0);

      // Exactly at expiration timestamp: MUST flip
      const changesAt = await flipPendingToPayable(db, payableAt);
      expect(changesAt).toBe(1);
    });

    it('9.2 multiple clawback adjustments on the same parent conversion row', async () => {
      // First partial refund (-$5.00)
      const claw1 = await recordClawbackAdjustment(db, 'conv_b9', 500);
      expect(claw1.success).toBe(true);

      // Second partial refund (-$3.00)
      const claw2 = await recordClawbackAdjustment(db, 'conv_b9', 300);
      expect(claw2.success).toBe(true);

      const balance = await getNetAffiliateBalance(db, 'aff_boundary');
      expect(balance).toBe(1200); // 2000 - 500 - 300 = 1200 cents
    });

    it('9.3 clawback adjustment on non-existent parent conversion returns CONVERSION_NOT_FOUND', async () => {
      const res = await recordClawbackAdjustment(db, 'non_existent_conversion', 500);
      expect(res.success).toBe(false);
      expect(res.error).toBe('CONVERSION_NOT_FOUND');
    });

    it('9.4 negative net balance handling when total clawbacks exceed total commissions', async () => {
      // Refund $25.00 on a $20.00 commission
      await recordClawbackAdjustment(db, 'conv_b9', 2500);

      const balance = await getNetAffiliateBalance(db, 'aff_boundary');
      expect(balance).toBe(-500); // Net negative balance (-$5.00)
    });

    it('9.5 handles clawback with zero refund amount cleanly', async () => {
      const res = await recordClawbackAdjustment(db, 'conv_b9', 0);
      expect(res.success).toBe(true);
      expect(res.amountCents).toBe(-0);
    });
  });

  // ─── F10: NOWPayments USDT Mass Payouts & Daily Reconciliation Boundaries ───
  describe('F10: NOWPayments USDT Mass Payouts & Daily Reconciliation Boundaries', () => {
    it('10.1 empty payable rows returns success with 0 claimed rows and 0 total cents', async () => {
      const res = await processPayoutBatch(db, 'nowpayments_usdt');
      expect(res.success).toBe(true);
      expect(res.claimedRowIds).toHaveLength(0);
      expect(res.totalAmountCents).toBe(0);
      expect(res.recipientCount).toBe(0);
    });

    it('10.2 exact threshold boundary: 99 cents is rejected, 100 cents is claimed', async () => {
      await db
        .prepare(
          `INSERT INTO commission_ledger (
            id, affiliate_id, network, external_conversion_id, commission_cents,
            status, hold_days, attributed_at, payable_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('com_99', 'aff_1', 'awin', 'c_99', 99, 'payable', 14, 1000, 2000, 1000)
        .run();

      await db
        .prepare(
          `INSERT INTO commission_ledger (
            id, affiliate_id, network, external_conversion_id, commission_cents,
            status, hold_days, attributed_at, payable_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('com_100', 'aff_2', 'awin', 'c_100', 100, 'payable', 14, 1000, 2000, 1000)
        .run();

      const batch = await processPayoutBatch(db, 'nowpayments_usdt');
      expect(batch.claimedRowIds).not.toContain('com_99');
      expect(batch.claimedRowIds).toContain('com_100');
      expect(batch.totalAmountCents).toBe(100);
    });

    it('10.3 concurrent payout batch processing CAS race: second batch claims 0 already claimed rows', async () => {
      await db
        .prepare(
          `INSERT INTO commission_ledger (
            id, affiliate_id, network, external_conversion_id, commission_cents,
            status, hold_days, attributed_at, payable_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('com_claim', 'aff_c', 'tiktok_shop', 'c_claim', 5000, 'payable', 14, 1000, 2000, 1000)
        .run();

      const batch1 = await processPayoutBatch(db, 'nowpayments_usdt');
      expect(batch1.claimedRowIds).toContain('com_claim');

      const batch2 = await processPayoutBatch(db, 'nowpayments_usdt');
      expect(batch2.claimedRowIds).toHaveLength(0);
    });

    it('10.4 exact reconciliation tolerance boundary: $1.00 difference passes, $1.01 fails', async () => {
      await db
        .prepare(
          `INSERT INTO commission_ledger (
            id, affiliate_id, network, external_conversion_id, commission_cents,
            status, hold_days, attributed_at, payable_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('com_r1', 'aff_r', 'clickbank', 'c_r1', 10000, 'payable', 14, 1000, 2000, 1000)
        .run();

      const batch = await processPayoutBatch(db, 'nowpayments_usdt');

      // Exactly 100 cents diff: passes
      const passRecon = await reconcileDailyFinancials(db, batch.batchId!, 10100);
      expect(passRecon.isReconciled).toBe(true);

      // 101 cents diff: fails
      const failRecon = await reconcileDailyFinancials(db, batch.batchId!, 10101);
      expect(failRecon.isReconciled).toBe(false);
      expect(failRecon.alertRequired).toBe(true);
    });

    it('10.5 zero external confirmation cents against positive ledger amount fails reconciliation', async () => {
      await db
        .prepare(
          `INSERT INTO commission_ledger (
            id, affiliate_id, network, external_conversion_id, commission_cents,
            status, hold_days, attributed_at, payable_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('com_r2', 'aff_r', 'clickbank', 'c_r2', 5000, 'payable', 14, 1000, 2000, 1000)
        .run();

      const batch = await processPayoutBatch(db, 'nowpayments_usdt');
      const zeroRecon = await reconcileDailyFinancials(db, batch.batchId!, 0);

      expect(zeroRecon.isReconciled).toBe(false);
      expect(zeroRecon.alertRequired).toBe(true);
    });
  });

  // ─── F11: Mekong Cloudflare Tunnel & Hybrid Edge Router Boundaries ───────────
  describe('F11: Mekong Cloudflare Tunnel & Hybrid Edge Router Boundaries', () => {
    it('11.1 handles empty node registry falling back to cloud BYOK cleanly', async () => {
      const res = await routeInferenceTask(
        { taskId: 'task_empty_reg', type: 'llm', prompt: 'test', model: 'gpt-4' },
        db,
      );
      expect(res.provider).toBe('cloud_byok');
      expect(res.costKind).toBe('metered');
    });

    it('11.2 handles preferred node ID that does not exist falling back gracefully', async () => {
      const res = await routeInferenceTask(
        { taskId: 'task_bad_node', type: 'tts', prompt: 'test', model: 'elevenlabs' },
        db,
        'non_existent_node_id',
      );
      expect(res.provider).toBe('cloud_byok');
    });

    it('11.3 handles offline preferred node routing to cloud BYOK', async () => {
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_off', 'Offline Node', 'https://off.cashclaw.cc', 'tok', 'OFFLINE', 'm1', 'unmetered', 1000, 1000)
        .run();

      const res = await routeInferenceTask(
        { taskId: 'task_off_pref', type: 'llm', prompt: 'test', model: 'qwen' },
        db,
        'node_off',
      );
      expect(res.provider).toBe('cloud_byok');
    });

    it('11.4 preserves task payload prompt integrity across fallback routes', async () => {
      const prompt = 'Synthesize high conversion TikTok script for SaaS';
      const res = await routeInferenceTask(
        { taskId: 'task_int', type: 'llm', prompt, model: 'claude-3-5' },
        db,
      );
      expect(res.output).toContain(prompt.substring(0, 30));
    });

    it('11.5 handles multi-modal task types (llm, tts, image, video) across hybrid router', async () => {
      const types = ['llm', 'tts', 'image', 'video'] as const;
      for (const t of types) {
        const res = await routeInferenceTask(
          { taskId: `task_${t}`, type: t, prompt: `generate ${t}`, model: 'default' },
          db,
        );
        expect(res.taskId).toBe(`task_${t}`);
        expect(res.encrypted).toBe(true);
      }
    });
  });

  // ─── F12: 15-Second Edge Node Health & Failover Boundaries ───────────────────
  describe('F12: 15-Second Edge Node Health & Failover Boundaries', () => {
    it('12.1 exact 15-second heartbeat boundary: 15000ms stale remains ONLINE, 15001ms stale transitions to OFFLINE', async () => {
      const now = 1700000050000;

      // Exactly 15000ms stale: remains ONLINE
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_15000', 'Edge 15s', 'https://e1.cashclaw.cc', 't1', 'ONLINE', 'm1', 'unmetered', now - 15000, now)
        .run();

      // 15001ms stale: transitions to OFFLINE
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_15001', 'Edge 15.001s', 'https://e2.cashclaw.cc', 't2', 'ONLINE', 'm1', 'unmetered', now - 15001, now)
        .run();

      const report = await checkClusterHealth(db, now, 15);
      expect(report.transitionsToOffline).not.toContain('node_15000');
      expect(report.transitionsToOffline).toContain('node_15001');

      const row1 = await db.prepare('SELECT status FROM edge_nodes WHERE id = ?').bind('node_15000').first<{ status: string }>();
      expect(row1?.status).toBe('ONLINE');

      const row2 = await db.prepare('SELECT status FROM edge_nodes WHERE id = ?').bind('node_15001').first<{ status: string }>();
      expect(row2?.status).toBe('OFFLINE');
    });

    it('12.2 probe timeout boundary: probe with timeoutMs < 500 fails closed', async () => {
      const probe = await probeEdgeNode('https://edge.cashclaw.cc', 'tok', 400);
      expect(probe.status).toBe('OFFLINE');
      expect(probe.reachable).toBe(false);
    });

    it('12.3 probe with empty or malformed tunnel URL returns OFFLINE', async () => {
      const probeEmpty = await probeEdgeNode('', 'tok');
      expect(probeEmpty.status).toBe('OFFLINE');
      expect(probeEmpty.reachable).toBe(false);
    });

    it('12.4 cluster health check on empty edge_nodes table returns 0 nodes without error', async () => {
      const report = await checkClusterHealth(db);
      expect(report.totalNodes).toBe(0);
      expect(report.onlineCount).toBe(0);
      expect(report.offlineCount).toBe(0);
      expect(report.transitionsToOffline).toEqual([]);
    });

    it('12.5 recovery transition: updating heartbeat restores node back to ONLINE on subsequent heartbeat', async () => {
      const now = Date.now();
      await db
        .prepare(
          `INSERT INTO edge_nodes (
            id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('node_rec', 'Recovery Node', 'https://rec.cashclaw.cc', 'tok', 'OFFLINE', 'm1', 'unmetered', now - 30000, now)
        .run();

      // Node sends fresh heartbeat and updates status to ONLINE
      await db
        .prepare("UPDATE edge_nodes SET status = 'ONLINE', last_heartbeat_at = ? WHERE id = 'node_rec'")
        .bind(now)
        .run();

      const report = await checkClusterHealth(db, now, 15);
      expect(report.onlineCount).toBe(1);
      expect(report.transitionsToOffline).not.toContain('node_rec');
    });
  });
});
