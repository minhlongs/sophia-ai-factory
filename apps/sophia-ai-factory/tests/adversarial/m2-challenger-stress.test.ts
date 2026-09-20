/**
 * Adversarial Empirical Stress Test Suite — Milestone M2: Creator Marketplace & Video Blueprint Ecosystem
 *
 * Scope:
 * 1. Pre-Flight Cost Formula Bounds ($10 MCU = 1¢ USD):
 *    - Boundary inputs (0 duration, 0 scenes, extreme 100 scenes / 600s duration).
 *    - Strict enforcement of $5.00 spike ceiling (COST_SPIKE_CEILING_EXCEEDED).
 *    - Model multipliers, resolution multipliers, and exact ceiling transition.
 * 2. MCU Balance and Subscription Tier Gating:
 *    - Zero balance, exact balance, partial balance (missingMcu calculation).
 *    - MASTER tier bypass and MASTER tier ceiling immunity check.
 *    - Database failure resilience.
 * 3. Monotonic Clone Concurrency:
 *    - 10 concurrent calls to cloneBlueprintForMission on actual SQLite relational engine.
 *    - Verification of monotonic remix_count increment without duplicate collisions or race conditions.
 *    - Verification of unique mission IDs and draft status.
 * 4. Marketplace Faceted Search Resilience:
 *    - SQL injection attempts in search queries, niche, platform, and sort keys.
 *    - Out-of-range and negative pagination clamping.
 *    - Extreme conversion rate filters.
 *
 * Layer: tests (adversarial stress suite)
 * Note: ZERO :any types used.
 *
 * @module tests/adversarial/m2-challenger-stress.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import {
  estimateBlueprintStudioCost,
  calculateVideoMcuAndUsd,
  MAX_SINGLE_MISSION_COST_CENTS,
  MCU_PER_CENT,
} from '@/tree/marketplace/preflight-cost-engine';
import { verifyUserPreflightMcu } from '@/forest/marketplace/preflight-check';
import {
  listMarketplaceBlueprints,
  cloneBlueprintForMission,
  getBlueprintById,
} from '@/forest/marketplace/blueprint-service';
import * as tierModule from '@/seed/db/get-user-tier';
import * as creditsModule from '@/tree/mcu/credits-repo';
import type {
  MarketplaceFilters,
  BlueprintSortOrder,
  Tier,
} from '@/seed/types';

// Load Node 22 native SQLite for true relational execution and SQL injection testing
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

type StatementSync = ReturnType<InstanceType<typeof DatabaseSync>['prepare']>;

interface SqliteD1Adapter {
  prepare(sql: string): {
    bind(...params: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
      run(): Promise<{ success: boolean; meta: { changes: number } }>;
    };
  };
  rawDb: InstanceType<typeof DatabaseSync>;
}

function createRealSqliteD1(): SqliteD1Adapter {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_blueprints (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT,
      name_en TEXT,
      name_vi TEXT,
      hook_style TEXT NOT NULL,
      target_platform TEXT NOT NULL,
      aspect_ratios TEXT NOT NULL DEFAULT '["9:16"]',
      estimated_scenes INTEGER NOT NULL DEFAULT 5,
      estimated_duration_seconds INTEGER NOT NULL DEFAULT 30,
      duration_seconds INTEGER,
      estimated_cost_cents INTEGER NOT NULL DEFAULT 50,
      confidence REAL NOT NULL DEFAULT 0.8,
      status TEXT NOT NULL DEFAULT 'generated',
      marketplace_listed INTEGER NOT NULL DEFAULT 0,
      niche TEXT DEFAULT 'general',
      conversion_rate REAL DEFAULT 0.05,
      remix_count INTEGER NOT NULL DEFAULT 0,
      royalty_pct REAL NOT NULL DEFAULT 10.0,
      creator_id TEXT,
      parent_blueprint_id TEXT,
      video_recipe_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS creative_missions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      budget_cents INTEGER NOT NULL DEFAULT 0,
      blueprint_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER
    );
  `);

  return {
    rawDb: db,
    prepare(sql: string) {
      const stmt: StatementSync = db.prepare(sql);
      return {
        bind(...params: unknown[]) {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            async first<T = Record<string, unknown>>(): Promise<T | null> {
              const row = stmt.get(...sanitized);
              return (row as T) ?? null;
            },
            async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
              const rows = stmt.all(...sanitized);
              return { results: rows as T[] };
            },
            async run(): Promise<{ success: boolean; meta: { changes: number } }> {
              const res = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(res.changes ?? 0) } };
            },
          };
        },
      };
    },
  };
}

describe('M2 Adversarial Stress Suite: Creator Marketplace & Video Blueprint Ecosystem', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AREA 1: Pre-Flight Cost Formula Bounds ($10 MCU = 1¢ USD)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Area 1: Pre-Flight Cost Formula Bounds ($10 MCU = 1¢ USD)', () => {
    it('verifies cost conversion rate strictly matches $10 MCU = 1¢ USD ($1.00 = 1,000 MCU)', () => {
      expect(MCU_PER_CENT).toBe(10);
      expect(MAX_SINGLE_MISSION_COST_CENTS).toBe(500); // $5.00 ceiling

      // 1000 MCU should equal exactly 100 cents ($1.00)
      const res = calculateVideoMcuAndUsd({
        scenes: 15,
        durationSeconds: 175,
        trackCount: 2,
        resolution: '1080p',
      });
      // (50 + 175*2 + 15*40) * 1.0 = (50 + 350 + 600) = 1,000 MCU
      expect(res.totalMCU).toBe(1000);
      expect(res.totalCostCents).toBe(100);
      expect(res.estimatedUsd).toBe(1.0);
      expect(res.isCeilingExceeded).toBe(false);
    });

    it('handles lower boundary corner: zero duration and zero scenes without zero-division or crash', () => {
      // (50 + 0 + 0) * max(1, 1/2) * 1.0 = 50 MCU = 5 cents ($0.05)
      const estimate = estimateBlueprintStudioCost(0, 0, 1, '1080p');
      expect(estimate.llmMCU).toBe(50);
      expect(estimate.audioMCU).toBe(0);
      expect(estimate.visualMCU).toBe(0);
      expect(estimate.totalMCU).toBe(50);
      expect(estimate.totalCostCents).toBe(5);
      expect(estimate.estimatedUsd).toBe(0.05);
      expect(estimate.isCeilingExceeded).toBe(false);
    });

    it('sanitizes adversarial negative inputs (negative scenes, negative duration, negative tracks)', () => {
      // safeScenes = max(0, -10) = 0, safeDuration = max(0, -120) = 0, safeTracks = max(1, -5) = 1
      const estimate = estimateBlueprintStudioCost(-10, -120, -5, '1080p');
      expect(estimate.visualMCU).toBe(0);
      expect(estimate.audioMCU).toBe(0);
      expect(estimate.llmMCU).toBe(50);
      expect(estimate.totalMCU).toBe(50);
      expect(estimate.totalCostCents).toBe(5);
      expect(estimate.isCeilingExceeded).toBe(false);
    });

    it('handles extreme upper boundary: 100 scenes, 600s duration, 4 tracks with strict ceiling violation', () => {
      // (50 + 600*2 + 100*40) * max(1, 4/2) * 1.0 = (50 + 1200 + 4000) * 2.0 = 5250 * 2 = 10,500 MCU
      // 10,500 MCU / 10 = 1050 cents ($10.50)
      const estimate = estimateBlueprintStudioCost(100, 600, 4, '1080p');
      expect(estimate.llmMCU).toBe(50);
      expect(estimate.audioMCU).toBe(1200);
      expect(estimate.visualMCU).toBe(4000);
      expect(estimate.totalMCU).toBe(10500);
      expect(estimate.totalCostCents).toBe(1050);
      expect(estimate.estimatedUsd).toBe(10.5);
      expect(estimate.isCeilingExceeded).toBe(true);
    });

    it('verifies exact threshold transition at the $5.00 (500 cents) spike ceiling boundary', () => {
      // Configuration for exactly 5,000 MCU (500 cents / $5.00):
      // trackCount = 2 (multiplier 1.0), resolution = 1080p (multiplier 1.0)
      // llm = 50, scenes = 120 (4800 MCU), duration = 75s (150 MCU)
      // total = 50 + 150 + 4800 = 5000 MCU -> 500 cents
      const atCeiling = estimateBlueprintStudioCost(120, 75, 2, '1080p');
      expect(atCeiling.totalMCU).toBe(5000);
      expect(atCeiling.totalCostCents).toBe(500);
      expect(atCeiling.estimatedUsd).toBe(5.0);
      expect(atCeiling.isCeilingExceeded).toBe(false); // <= $5.00 is permitted

      // Configuration for 501 cents ($5.01) exceeding ceiling:
      // duration = 78s (156 MCU) -> total = 50 + 156 + 4800 = 5006 MCU
      // Math.round(5006 / 10) = 501 cents -> 501 > 500 -> isCeilingExceeded = true
      const justOverCeiling = estimateBlueprintStudioCost(120, 78, 2, '1080p');
      expect(justOverCeiling.totalMCU).toBe(5006);
      expect(justOverCeiling.totalCostCents).toBe(501);
      expect(justOverCeiling.estimatedUsd).toBe(5.01);
      expect(justOverCeiling.isCeilingExceeded).toBe(true);
    });

    it('correctly applies 2.0x 4k multiplier and premium model selection surcharges', () => {
      const baseEstimate = estimateBlueprintStudioCost(5, 30, 2, '1080p');
      const fourKEstimate = estimateBlueprintStudioCost(5, 30, 2, '4k');
      expect(fourKEstimate.totalMCU).toBe(baseEstimate.totalMCU * 2);

      const premiumEstimate = estimateBlueprintStudioCost(5, 30, 2, '1080p', {
        llmModel: 'gpt-4o', // 100 MCU
        voiceModel: 'elevenlabs_clone', // 3 MCU/sec -> 30*3 = 90
        visualModel: 'flux_dev', // 50 MCU/scene -> 5*50 = 250
      });
      expect(premiumEstimate.llmMCU).toBe(100);
      expect(premiumEstimate.audioMCU).toBe(90);
      expect(premiumEstimate.visualMCU).toBe(250);
      expect(premiumEstimate.totalMCU).toBe(440);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AREA 2: MCU Balance and Subscription Tier Gating
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Area 2: MCU Balance and Subscription Tier Gating', () => {
    it('blocks user with zero balance and calculates exact missingMcu', async () => {
      vi.spyOn(tierModule, 'getUserTier').mockResolvedValue('BASIC' as Tier);
      vi.spyOn(creditsModule, 'getBalance').mockResolvedValue({
        credits_remaining: 0,
        credits_total_purchased: 0,
        credits_total_used: 0,
      });

      // 6 scenes, 30s, 3 tracks = 525 MCU
      const res = await verifyUserPreflightMcu('user_zero', {
        scenes: 6,
        durationSeconds: 30,
        trackCount: 3,
      });

      expect(res.allowed).toBe(false);
      expect(res.currentMcu).toBe(0);
      expect(res.requiredMcu).toBe(525);
      expect(res.missingMcu).toBe(525);
      expect(res.error).toBe('INSUFFICIENT_MCU_BALANCE');
      expect(res.isCeilingExceeded).toBe(false);
    });

    it('permits launch when user balance exactly matches required MCU', async () => {
      vi.spyOn(tierModule, 'getUserTier').mockResolvedValue('PREMIUM' as Tier);
      vi.spyOn(creditsModule, 'getBalance').mockResolvedValue({
        credits_remaining: 525,
        credits_total_purchased: 1000,
        credits_total_used: 475,
      });

      const res = await verifyUserPreflightMcu('user_exact', {
        scenes: 6,
        durationSeconds: 30,
        trackCount: 3,
      });

      expect(res.allowed).toBe(true);
      expect(res.currentMcu).toBe(525);
      expect(res.requiredMcu).toBe(525);
      expect(res.missingMcu).toBeUndefined();
      expect(res.error).toBeUndefined();
    });

    it('blocks user when current balance has 1 MCU deficit and accurately calculates missingMcu = 1', async () => {
      vi.spyOn(tierModule, 'getUserTier').mockResolvedValue('PREMIUM' as Tier);
      vi.spyOn(creditsModule, 'getBalance').mockResolvedValue({
        credits_remaining: 524,
        credits_total_purchased: 1000,
        credits_total_used: 476,
      });

      const res = await verifyUserPreflightMcu('user_deficit_1', {
        scenes: 6,
        durationSeconds: 30,
        trackCount: 3,
      });

      expect(res.allowed).toBe(false);
      expect(res.currentMcu).toBe(524);
      expect(res.requiredMcu).toBe(525);
      expect(res.missingMcu).toBe(1);
      expect(res.error).toBe('INSUFFICIENT_MCU_BALANCE');
    });

    it('calculates exact partial deficit when user has partial MCU credits', async () => {
      vi.spyOn(tierModule, 'getUserTier').mockResolvedValue('BASIC' as Tier);
      vi.spyOn(creditsModule, 'getBalance').mockResolvedValue({
        credits_remaining: 200,
        credits_total_purchased: 500,
        credits_total_used: 300,
      });

      const res = await verifyUserPreflightMcu('user_partial', {
        scenes: 6,
        durationSeconds: 30,
        trackCount: 3,
      });

      expect(res.allowed).toBe(false);
      expect(res.currentMcu).toBe(200);
      expect(res.requiredMcu).toBe(525);
      expect(res.missingMcu).toBe(325); // 525 - 200
      expect(res.error).toBe('INSUFFICIENT_MCU_BALANCE');
    });

    it('allows MASTER tier users unlimited allowance bypassing zero balance limits', async () => {
      vi.spyOn(tierModule, 'getUserTier').mockResolvedValue('MASTER' as Tier);
      vi.spyOn(creditsModule, 'getBalance').mockResolvedValue({
        credits_remaining: 0,
        credits_total_purchased: 0,
        credits_total_used: 0,
      });

      const res = await verifyUserPreflightMcu('user_master', {
        scenes: 6,
        durationSeconds: 30,
        trackCount: 3,
      });

      expect(res.allowed).toBe(true);
      expect(res.userTier).toBe('MASTER');
      expect(res.currentMcu).toBe(100000); // virtual allowance
      expect(res.missingMcu).toBeUndefined();
      expect(res.error).toBeUndefined();
    });

    it('strictly enforces $5.00 ceiling even on MASTER tier users (no spike runaway bypass)', async () => {
      vi.spyOn(tierModule, 'getUserTier').mockResolvedValue('MASTER' as Tier);

      // Extreme mission: 100 scenes, 600s = 10,500 MCU ($10.50)
      const res = await verifyUserPreflightMcu('user_master_runaway', {
        scenes: 100,
        durationSeconds: 600,
        trackCount: 4,
      });

      expect(res.allowed).toBe(false);
      expect(res.isCeilingExceeded).toBe(true);
      expect(res.error).toBe('COST_SPIKE_CEILING_EXCEEDED');
    });

    it('gracefully degrades to 0 balance if credit repository throws database exception', async () => {
      vi.spyOn(tierModule, 'getUserTier').mockResolvedValue('BASIC' as Tier);
      vi.spyOn(creditsModule, 'getBalance').mockRejectedValue(new Error('D1_CONNECTION_RESET'));

      const res = await verifyUserPreflightMcu('user_db_error', {
        scenes: 5,
        durationSeconds: 30,
        trackCount: 2,
      });

      expect(res.allowed).toBe(false);
      expect(res.currentMcu).toBe(0);
      expect(res.error).toBe('INSUFFICIENT_MCU_BALANCE');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AREA 3: Monotonic Clone Concurrency
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Area 3: Monotonic Clone Concurrency', () => {
    it('executes 10 concurrent clones without duplicate mission row collisions and with strict monotonic remix_count increment', async () => {
      const adapter = createRealSqliteD1();
      const db = adapter as unknown as D1Database;

      // Seed initial blueprint
      const blueprintId = 'bp_concurrency_stress_001';
      const initialRemixCount = 0;
      const initialTimestamp = 1715000000000;

      adapter.rawDb.prepare(`
        INSERT INTO campaign_blueprints (
          id, workspace_id, title, hook_style, target_platform,
          estimated_scenes, estimated_duration_seconds, estimated_cost_cents,
          marketplace_listed, niche, conversion_rate, remix_count, royalty_pct,
          creator_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        blueprintId,
        'ws_template_owner',
        'Viral SaaS Funnel Blueprint',
        'curiosity_gap',
        'tiktok',
        5,
        30,
        50,
        1,
        'saas',
        0.08,
        initialRemixCount,
        15.0,
        'creator_master_001',
        initialTimestamp,
      );

      // Execute 10 concurrent clones
      const CONCURRENCY_LEVEL = 10;
      const clonePromises = Array.from({ length: CONCURRENCY_LEVEL }, (_, idx) => {
        const userId = `remixer_user_${idx + 1}`;
        const workspaceId = `ws_remixer_${idx + 1}`;
        return cloneBlueprintForMission(db, blueprintId, userId, workspaceId, initialTimestamp + idx * 10);
      });

      const results = await Promise.all(clonePromises);

      // Verify all 10 clones reported success
      for (const res of results) {
        expect(res.success).toBe(true);
        expect(res.blueprintId).toBe(blueprintId);
        expect(res.missionId).toBeDefined();
        expect(res.error).toBeUndefined();
      }

      // Verify all 10 generated mission IDs are unique (zero collisions)
      const missionIds = results.map((r) => r.missionId as string);
      const uniqueMissionIds = new Set(missionIds);
      expect(uniqueMissionIds.size).toBe(CONCURRENCY_LEVEL);

      // Verify exact row count in creative_missions table
      const missionRows = adapter.rawDb.prepare(
        'SELECT * FROM creative_missions WHERE blueprint_id = ?'
      ).all(blueprintId) as Array<{
        id: string;
        workspace_id: string;
        creator_id: string;
        title: string;
        status: string;
        budget_cents: number;
        blueprint_id: string;
      }>;

      expect(missionRows.length).toBe(CONCURRENCY_LEVEL);
      for (const row of missionRows) {
        expect(row.status).toBe('draft');
        expect(row.blueprint_id).toBe(blueprintId);
        expect(row.budget_cents).toBeGreaterThan(0);
        expect(row.title).toContain('Viral SaaS Funnel Blueprint');
      }

      // Verify campaign_blueprints remix_count strictly incremented by exactly 10
      const finalBpRow = adapter.rawDb.prepare(
        'SELECT remix_count FROM campaign_blueprints WHERE id = ?'
      ).get(blueprintId) as { remix_count: number };

      expect(finalBpRow.remix_count).toBe(initialRemixCount + CONCURRENCY_LEVEL);
    });

    it('rejects cloning when blueprint parameters violate $5.00 ceiling without mutating remix_count', async () => {
      const adapter = createRealSqliteD1();
      const db = adapter as unknown as D1Database;

      const expensiveBpId = 'bp_too_expensive_001';
      adapter.rawDb.prepare(`
        INSERT INTO campaign_blueprints (
          id, workspace_id, title, hook_style, target_platform,
          estimated_scenes, estimated_duration_seconds, estimated_cost_cents,
          marketplace_listed, niche, conversion_rate, remix_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        expensiveBpId,
        'ws_spike',
        'Extreme 100 Scene Video',
        'documentary',
        'youtube_shorts',
        100,
        600,
        1050,
        1,
        'education',
        0.02,
        5,
        1715000000000,
      );

      const res = await cloneBlueprintForMission(db, expensiveBpId, 'user_test', 'ws_test');

      expect(res.success).toBe(false);
      expect(res.error).toBe('COST_SPIKE_CEILING_EXCEEDED');
      expect(res.preflightCostCents).toBeGreaterThan(500);

      // Verify remix_count was NOT incremented
      const bpRow = adapter.rawDb.prepare(
        'SELECT remix_count FROM campaign_blueprints WHERE id = ?'
      ).get(expensiveBpId) as { remix_count: number };
      expect(bpRow.remix_count).toBe(5);

      // Verify no mission row created
      const missionRows = adapter.rawDb.prepare(
        'SELECT count(*) as count FROM creative_missions WHERE blueprint_id = ?'
      ).get(expensiveBpId) as { count: number };
      expect(missionRows.count).toBe(0);
    });

    it('returns BLUEPRINT_NOT_FOUND for non-existent and empty blueprint IDs', async () => {
      const adapter = createRealSqliteD1();
      const db = adapter as unknown as D1Database;

      const res1 = await cloneBlueprintForMission(db, 'non_existent_id', 'user_1', 'ws_1');
      expect(res1.success).toBe(false);
      expect(res1.error).toBe('BLUEPRINT_NOT_FOUND');

      const res2 = await cloneBlueprintForMission(db, '   ', 'user_1', 'ws_1');
      expect(res2.success).toBe(false);
      expect(res2.error).toBe('BLUEPRINT_NOT_FOUND');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AREA 4: Marketplace Faceted Search Resilience
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Area 4: Marketplace Faceted Search Resilience', () => {
    let adapter: SqliteD1Adapter;
    let db: D1Database;

    beforeEach(() => {
      adapter = createRealSqliteD1();
      db = adapter as unknown as D1Database;

      // Seed catalog of test blueprints
      const insertBp = adapter.rawDb.prepare(`
        INSERT INTO campaign_blueprints (
          id, workspace_id, title, hook_style, target_platform,
          estimated_scenes, estimated_duration_seconds, estimated_cost_cents,
          marketplace_listed, niche, conversion_rate, remix_count, royalty_pct,
          creator_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertBp.run('bp_seed_1', 'ws_1', 'TikTok Viral E-Com', 'curiosity_gap', 'tiktok', 5, 30, 50, 1, 'ecommerce', 0.08, 100, 10.0, 'alice', 1000);
      insertBp.run('bp_seed_2', 'ws_1', 'YouTube Shorts SaaS Demo', 'bold_claim', 'youtube_shorts', 6, 45, 65, 1, 'saas', 0.06, 50, 15.0, 'bob', 2000);
      insertBp.run('bp_seed_3', 'ws_1', 'Fitness Transformation', 'before_after', 'tiktok', 5, 30, 50, 1, 'fitness', 0.09, 120, 10.0, 'alice', 3000);
      insertBp.run('bp_seed_4', 'ws_1', 'Unlisted Blueprint Secret', 'question', 'x', 5, 30, 50, 0, 'growth_hacking', 0.12, 10, 10.0, 'charlie', 4000);
    });

    it('neutralizes classic SQL injection attempts in search queries without syntax errors or data exposure', async () => {
      const sqliPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE campaign_blueprints; --",
        "' UNION SELECT id, workspace_id, title, name_en, name_vi, hook_style, target_platform, aspect_ratios, estimated_scenes, estimated_duration_seconds, duration_seconds, estimated_cost_cents, confidence, status, marketplace_listed, niche, conversion_rate, remix_count, royalty_pct, creator_id, parent_blueprint_id, video_recipe_json, created_at, updated_at FROM campaign_blueprints --",
        "admin'--",
        "x' OR 1=1 ORDER BY 1--",
      ];

      for (const payload of sqliPayloads) {
        const res = await listMarketplaceBlueprints(db, { search: payload });
        // Because search is parameterized with ?, the payload is treated as a literal search string
        expect(res.items).toHaveLength(0); // None of the titles contain the literal injection string
        expect(res.total).toBe(0);
      }

      // Verify table campaign_blueprints was NOT dropped and still intact
      const countCheck = adapter.rawDb.prepare('SELECT count(*) as count FROM campaign_blueprints').get() as { count: number };
      expect(countCheck.count).toBe(4);
    });

    it('safely falls back to default ordering when invalid or malicious sort keys are supplied', async () => {
      const adversarialSortKeys = [
        'invalid_column_name',
        'conversion_rate; DROP TABLE campaign_blueprints;',
        '1; SELECT * FROM creative_missions;',
        '',
        '--',
      ];

      for (const badSort of adversarialSortKeys) {
        // Casting as unknown as BlueprintSortOrder to simulate untrusted client HTTP query param
        const res = await listMarketplaceBlueprints(db, {
          sort: badSort as unknown as BlueprintSortOrder,
        });

        // Default sort is conversion_rate DESC, remix_count DESC
        expect(res.items.length).toBeGreaterThan(0);
        expect(res.items[0].conversionRate).toBeGreaterThanOrEqual(res.items[1].conversionRate);
      }
    });

    it('clamps out-of-range, negative, and extreme pagination parameters to safe boundaries', async () => {
      // Page 0 and negative pages must clamp to page 1
      const resPageZero = await listMarketplaceBlueprints(db, { page: 0 });
      expect(resPageZero.page).toBe(1);

      const resPageNeg = await listMarketplaceBlueprints(db, { page: -10 });
      expect(resPageNeg.page).toBe(1);

      // Huge page beyond dataset returns empty items without throwing
      const resPageHuge = await listMarketplaceBlueprints(db, { page: 999999, pageSize: 10 });
      expect(resPageHuge.items).toHaveLength(0);
      expect(resPageHuge.page).toBe(999999);
      expect(resPageHuge.total).toBe(3); // 3 listed blueprints

      // PageSize > 50 must clamp to 50
      const resPageSizeMax = await listMarketplaceBlueprints(db, { pageSize: 500 });
      expect(resPageSizeMax.pageSize).toBe(50);

      // PageSize <= 0 must clamp to 1
      const resPageSizeMin = await listMarketplaceBlueprints(db, { pageSize: 0 });
      expect(resPageSizeMin.pageSize).toBe(1);
    });

    it('handles extreme and boundary conversion rate filters without errors', async () => {
      // Negative conversion rate (-1.0) matches all listed items (since CR >= -1.0)
      const resNegCr = await listMarketplaceBlueprints(db, { minConversionRate: -1.0 });
      expect(resNegCr.items).toHaveLength(3);

      // minConversionRate: 0.08 matches 2 items (0.08, 0.09)
      const resCr08 = await listMarketplaceBlueprints(db, { minConversionRate: 0.08 });
      expect(resCr08.items).toHaveLength(2);
      expect(resCr08.items.every((i) => i.conversionRate >= 0.08)).toBe(true);

      // minConversionRate: 1.0 (100% conversion) matches 0 items
      const resCr100 = await listMarketplaceBlueprints(db, { minConversionRate: 1.0 });
      expect(resCr100.items).toHaveLength(0);

      // minConversionRate: 999.0 (absurd filter) matches 0 items without error
      const resCrAbsurd = await listMarketplaceBlueprints(db, { minConversionRate: 999.0 });
      expect(resCrAbsurd.items).toHaveLength(0);
      expect(resCrAbsurd.total).toBe(0);
    });

    it('safely handles adversarial SQL injection in niche and platform filters', async () => {
      const resNicheSqli = await listMarketplaceBlueprints(db, {
        niche: "saas' OR '1'='1",
      });
      expect(resNicheSqli.items).toHaveLength(0);

      const resPlatformSqli = await listMarketplaceBlueprints(db, {
        platform: "tiktok'; DROP TABLE campaign_blueprints; --" as unknown as Parameters<typeof listMarketplaceBlueprints>[1]['platform'],
      });
      expect(resPlatformSqli.items).toHaveLength(0);

      // 'all' sentinel value bypasses filter
      const resNicheAll = await listMarketplaceBlueprints(db, { niche: 'all' });
      expect(resNicheAll.items).toHaveLength(3);

      const resPlatformAll = await listMarketplaceBlueprints(db, { platform: 'all' as unknown as Parameters<typeof listMarketplaceBlueprints>[1]['platform'] });
      expect(resPlatformAll.items).toHaveLength(3);
    });

    it('retrieves blueprint by ID safely and returns null for non-existent IDs', async () => {
      const item = await getBlueprintById(db, 'bp_seed_1');
      expect(item).not.toBeNull();
      expect(item?.title).toBe('TikTok Viral E-Com');
      expect(item?.aspectRatios).toEqual(['9:16']);

      const nonExistent = await getBlueprintById(db, 'non_existent_bp');
      expect(nonExistent).toBeNull();
    });
  });
});
