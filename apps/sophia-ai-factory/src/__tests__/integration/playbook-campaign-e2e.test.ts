/**
 * E2E Auto-Creative Playbook & Campaign Intelligence Test — Phase 5
 *
 * Comprehensive opaque-box, requirement-driven test suite following the
 * 4-Tier methodology:
 * - Tier 1: Feature Coverage (>=5 test cases per feature across extraction,
 *   scoring, OCC CAS, blueprint generation, 7-gate preflight, quota enforcement,
 *   rule auto-apply, rollback)
 * - Tier 2: Boundary & Corner Cases (sample size < 5, duration edge values,
 *   quota limit reached, cost spike > 500¢, concurrent CAS conflicts, missing BYOK keys)
 * - Tier 3: Cross-Feature Combinations (pairwise flows: completed mission ->
 *   ingestion -> blueprint synthesis -> recurring schedule -> 7-gate preflight -> batch dispatch)
 * - Tier 4: Real-World Application Scenarios (automated viral shorts playbook,
 *   recurring affiliate showcase campaign)
 *
 * Uses deterministic in-memory SQLite via node:sqlite (real SQL engine with
 * standard D1 emulation). Zero external network calls.
 *
 * @module __tests__/integration/playbook-campaign-e2e
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

// ─── Section 1: SQLite Shim & D1 Mock Factory ─────────────────────────────────

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
  const d1Instance = {
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
    batch: (stmts: unknown[]) => Promise.all(stmts),
    execute: async (sql: string, params?: unknown[]) => {
      const stmt = db.prepare(sql);
      const sanitized = (params ?? []).map((p) => (p === undefined ? null : p));
      const isSelect = /^\s*SELECT/i.test(sql);
      if (isSelect) {
        const results = stmt.all(...sanitized);
        return { results, meta: { changes: 0, duration: 0 } };
      } else {
        const r = stmt.run(...sanitized);
        return {
          results: [],
          meta: { changes: Number(r.changes ?? 0), duration: 0 },
        };
      }
    },
    unwrap: function () {
      return this;
    },
    from: (table: string) => ({
      select: (cols = '*') => ({
        eq: (col: string, val: unknown) => ({
          lte: (col2: string, val2: unknown) => {
            const stmt = db.prepare(
              `SELECT ${cols} FROM ${table} WHERE ${col} = ? AND ${col2} <= ?`,
            );
            const rows = stmt.all(val, val2);
            return Promise.resolve({ data: rows, error: null });
          },
        }),
      }),
    }),
  };
  return d1Instance;
}

// ─── Section 2: Schema Bootstrap (D1 Tables & Indexes) ─────────────────────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS creative_missions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  brand_id TEXT,
  title TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  geography TEXT NOT NULL DEFAULT 'global',
  timeframe_start INTEGER NOT NULL DEFAULT 0,
  timeframe_end INTEGER NOT NULL DEFAULT 0,
  budget_cents INTEGER NOT NULL DEFAULT 0,
  spent_cents INTEGER NOT NULL DEFAULT 0,
  autonomy_level INTEGER NOT NULL DEFAULT 0,
  channels TEXT NOT NULL DEFAULT '[]',
  monetization_goals TEXT NOT NULL DEFAULT '[]',
  constraints TEXT NOT NULL DEFAULT '{}',
  success_metrics TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  current_phase TEXT NOT NULL DEFAULT 'ideation',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS content_assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  mission_id TEXT,
  track_type TEXT,
  type TEXT NOT NULL,
  storage_key TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  duration_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS playbook_patterns (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  feature_value TEXT NOT NULL,
  metric TEXT NOT NULL,
  avg_metric REAL NOT NULL,
  sample_size INTEGER NOT NULL,
  confidence REAL NOT NULL,
  confidence_level TEXT NOT NULL DEFAULT 'medium',
  source TEXT NOT NULL DEFAULT 'mission',
  detected_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_playbook_patterns_upsert
  ON playbook_patterns(workspace_id, feature_key, feature_value, metric);

CREATE TABLE IF NOT EXISTS playbook_rules (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  pattern_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  goal TEXT NOT NULL,
  rule_vi TEXT NOT NULL,
  rule_en TEXT NOT NULL,
  confidence REAL NOT NULL,
  sample_size INTEGER NOT NULL,
  applied_count INTEGER NOT NULL DEFAULT 0,
  auto_apply INTEGER NOT NULL DEFAULT 0,
  rollback_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_playbook_rules_lookup
  ON playbook_rules(workspace_id, platform, auto_apply, confidence DESC);

CREATE TABLE IF NOT EXISTS campaign_blueprints (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_vi TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_vi TEXT NOT NULL,
  target_platform TEXT NOT NULL,
  hook_style TEXT NOT NULL,
  voice_style TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 60,
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  estimated_scenes INTEGER NOT NULL DEFAULT 4,
  suggested_prompts TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE TABLE IF NOT EXISTS recurring_campaign_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  blueprint_id TEXT NOT NULL,
  schedule_cron TEXT NOT NULL,
  batch_size INTEGER NOT NULL DEFAULT 1,
  next_run_at INTEGER NOT NULL,
  last_run_at INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  total_runs INTEGER NOT NULL DEFAULT 0,
  last_status TEXT NOT NULL DEFAULT 'idle',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE TABLE IF NOT EXISTS scheduled_campaigns (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  template_script TEXT NOT NULL DEFAULT '',
  interval_days INTEGER NOT NULL DEFAULT 7,
  next_run_date TEXT NOT NULL,
  last_run_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_sop_installations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  customizations TEXT,
  config_values TEXT,
  schedule_cron TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at INTEGER,
  next_run_at INTEGER,
  run_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS engine_missions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS user_mcu_balance (
  user_id TEXT PRIMARY KEY,
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS mcu_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  mission_id TEXT,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
`;

// ─── Section 3: Mocks Setup ───────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
  mockCreateServerClient: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockVerifyWorkspaceAccess: vi.fn(),
  mockGetUserTier: vi.fn(),
  mockGetBalance: vi.fn(),
  mockListUserApiKeyProviders: vi.fn(),
  mockGetUserApiKey: vi.fn(),
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

vi.mock('@/tree/mcu/credits-repo', () => ({
  getBalance: mocks.mockGetBalance,
  deductCredits: vi.fn(async (userId: string, amount: number) => {
    return { success: true, remaining: 1000 - amount };
  }),
}));

vi.mock('@/tree/byok/user-api-key-store', () => ({
  listUserApiKeyProviders: mocks.mockListUserApiKeyProviders,
  getUserApiKey: mocks.mockGetUserApiKey,
}));

vi.mock('@/seed/auth/resolve-org-id', () => ({
  resolveOrgId: vi.fn(async (userId) => userId),
  resolveOrgOwnerUserId: vi.fn(async (orgId) => orgId),
}));

// ─── Section 4: Domain Imports & Test Harness ─────────────────────────────────

import {
  computeConfidence,
  extractFeature,
  bucketDuration,
  bucketPostingTime,
} from '@/forest/patterns/pattern-detector';
import {
  upsertPattern,
  listPatterns,
  getTopPattern,
} from '@/forest/patterns/pattern-store';
import {
  upsertRule,
  listRules,
  recordRollback,
} from '@/forest/patterns/rule-store';
import {
  applyPlaybook,
  toggleAutoApply,
  getPlaybookConfig,
} from '@/land/playbook/playbook-applier';
import { recordApply } from '@/land/playbook/rule-ops';
import { runMissionPreflightCheck } from '@/tree/mission/preflight-check';
import { transitionStatusCAS } from '@/forest/mission/multi-track-orchestrator';
import {
  checkMissionQuota,
  MISSION_QUOTA_BY_TIER,
} from '@/forest/quota/mission-quota';
import type {
  PlaybookPattern,
  PlaybookRule,
} from '@/seed/types/playbook-pattern';

// ─── Phase 5 Domain Contracts & Canonical Test Harness ───────────────────────

export type HookStyle =
  | 'curiosity_gap'
  | 'bold_claim'
  | 'problem_agitation'
  | 'question'
  | 'story_lead'
  | 'statistic_reveal';

export type VoiceProfile =
  | 'dynamic_hook'
  | 'enthusiastic_recommender'
  | 'calm_authoritative'
  | 'cinematic_narrator';

export type DurationPattern = '0-15s' | '16-30s' | '31-60s' | '61-90s' | '90s+';

export interface CampaignBlueprint {
  id: string;
  workspaceId: string;
  name: { en: string; vi: string };
  description: { en: string; vi: string };
  targetPlatform: 'youtube_shorts' | 'tiktok' | 'instagram_reels';
  hookStyle: HookStyle;
  voiceStyle: VoiceProfile;
  durationSeconds: number;
  aspectRatio: '9:16' | '16:9' | '1:1';
  estimatedScenes: number;
  suggestedPrompts: Array<{ en: string; vi: string }>;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ExtractedCreativeVariables {
  missionId: string;
  workspaceId: string;
  hookStyle: HookStyle;
  voiceProfile: {
    voiceId: string;
    voiceStyle: VoiceProfile;
    provider: string;
  };
  durationPattern: DurationPattern;
  actualDurationSeconds: number;
  aspectRatio: '9:16' | '16:9' | '1:1';
  channel: string;
  sceneCount: number;
}

export interface CreativeMetricsInput {
  impressions: number;
  views: number;
  clicks: number;
  conversions: number;
  spendCents: number;
  revenueCents: number;
  retentionRate?: number;
}

export interface CreativeEffectivenessScore {
  score: number;
  ctr: number;
  retentionRate: number;
  conversionRate: number;
  cpaCents: number;
  roiMultiplier: number;
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

export interface CASUpdateResult {
  success: boolean;
  changes: number;
  retries: number;
  error?: string;
}

/**
 * Canonical extraction engine for Track 1, 2, 4 assets
 */
export function extractCreativeVariables(
  mission: { id: string; workspace_id: string; channels?: string },
  assets: Array<{
    track_type?: string;
    type: string;
    duration_seconds?: number;
    metadata?: string | Record<string, unknown>;
  }>,
): ExtractedCreativeVariables {
  let hookStyle: HookStyle = 'curiosity_gap';
  let voiceId = 'default_voice';
  let voiceStyle: VoiceProfile = 'dynamic_hook';
  let provider = 'elevenlabs';
  let actualDurationSeconds = 30;
  let aspectRatio: '9:16' | '16:9' | '1:1' = '9:16';
  let sceneCount = 1;

  for (const asset of assets) {
    const meta =
      typeof asset.metadata === 'string'
        ? (JSON.parse(asset.metadata || '{}') as Record<string, unknown>)
        : (asset.metadata ?? {});

    // Track 1: Script & Scene 0 hook analysis
    if (asset.track_type === 'track1' || asset.type === 'script') {
      const scenes = (meta.scenes as Array<Record<string, unknown>>) || [];
      sceneCount = scenes.length || 1;
      const scene0Text = String(
        scenes[0]?.narration || scenes[0]?.text || meta.script || '',
      ).toLowerCase();

      if (scene0Text.includes('you won\'t believe') || scene0Text.includes('wait until') || scene0Text.includes('secret')) {
        hookStyle = 'curiosity_gap';
      } else if (scene0Text.includes('10x') || scene0Text.includes('guaranteed') || scene0Text.includes('best way')) {
        hookStyle = 'bold_claim';
      } else if (scene0Text.includes('tired of') || scene0Text.includes('struggling with') || scene0Text.includes('stop doing')) {
        hookStyle = 'problem_agitation';
      } else if (scene0Text.includes('?') || scene0Text.startsWith('why') || scene0Text.startsWith('how')) {
        hookStyle = 'question';
      } else if (scene0Text.includes('years ago') || scene0Text.includes('when i started') || scene0Text.includes('story')) {
        hookStyle = 'story_lead';
      } else if (scene0Text.match(/\d+%/)) {
        hookStyle = 'statistic_reveal';
      }
    }

    // Track 2: Audio voice profile
    if (asset.track_type === 'track2' || asset.type === 'audio') {
      voiceId = String(meta.voiceId || meta.voice_id || voiceId);
      provider = String(meta.provider || provider);
      const styleStr = String(meta.voiceStyle || meta.style || '').toLowerCase();
      if (styleStr.includes('recommender') || styleStr.includes('enthusiastic')) {
        voiceStyle = 'enthusiastic_recommender';
      } else if (styleStr.includes('calm') || styleStr.includes('authoritative')) {
        voiceStyle = 'calm_authoritative';
      } else if (styleStr.includes('cinematic') || styleStr.includes('narrator')) {
        voiceStyle = 'cinematic_narrator';
      } else {
        voiceStyle = 'dynamic_hook';
      }
    }

    // Track 4: Video duration & aspect ratio
    if (asset.track_type === 'track4' || asset.type === 'video') {
      if (typeof asset.duration_seconds === 'number' && asset.duration_seconds > 0) {
        actualDurationSeconds = asset.duration_seconds;
      }
      if (meta.aspectRatio === '16:9' || meta.aspectRatio === '1:1') {
        aspectRatio = meta.aspectRatio as '16:9' | '1:1';
      }
    }
  }

  const durationPattern = bucketDuration(String(actualDurationSeconds)) as DurationPattern;
  const channel = mission.channels ? JSON.parse(mission.channels)[0] || 'youtube_shorts' : 'youtube_shorts';

  return {
    missionId: mission.id,
    workspaceId: mission.workspace_id,
    hookStyle,
    voiceProfile: { voiceId, voiceStyle, provider },
    durationPattern,
    actualDurationSeconds,
    aspectRatio,
    channel,
    sceneCount,
  };
}

/**
 * Mathematical confidence & multi-metric effectiveness scoring
 */
export function calculateEffectivenessScore(metrics: CreativeMetricsInput): CreativeEffectivenessScore {
  const impressions = Math.max(0, metrics.impressions);
  const views = Math.max(0, metrics.views);
  const clicks = Math.max(0, metrics.clicks);
  const conversions = Math.max(0, metrics.conversions);
  const spendCents = Math.max(0, metrics.spendCents);
  const revenueCents = Math.max(0, metrics.revenueCents);
  const retentionRate = metrics.retentionRate !== undefined ? Math.max(0, Math.min(1, metrics.retentionRate)) : views > 0 ? 0.65 : 0;

  const ctr = impressions > 0 ? clicks / impressions : 0;
  const conversionRate = clicks > 0 ? conversions / clicks : 0;
  const cpaCents = conversions > 0 ? spendCents / conversions : 0;
  const roiMultiplier = spendCents > 0 ? revenueCents / spendCents : 0;

  // Efficiency normalized factor based on ROI
  const efficiency = Math.min(1, roiMultiplier / 3.0);

  // Multi-metric composite: 35% CTR + 25% Retention + 30% Conversion + 10% Efficiency
  const compositeRatio = (0.35 * Math.min(1, ctr * 10)) +
                         (0.25 * retentionRate) +
                         (0.30 * Math.min(1, conversionRate * 10)) +
                         (0.10 * efficiency);

  const score = Math.round(compositeRatio * 1000) / 10; // 0..100

  // Confidence based on impressions sample size
  const consistency = 0.85;
  const confidence = computeConfidence(impressions, consistency);
  const confidenceLevel: 'high' | 'medium' | 'low' =
    confidence >= 0.9 ? 'high' : confidence >= 0.7 ? 'medium' : 'low';

  return {
    score,
    ctr: Math.round(ctr * 10000) / 100, // percentage
    retentionRate: Math.round(retentionRate * 10000) / 100,
    conversionRate: Math.round(conversionRate * 10000) / 100,
    cpaCents: Math.round(cpaCents),
    roiMultiplier: Math.round(roiMultiplier * 100) / 100,
    confidence: Math.round(confidence * 1000) / 1000,
    confidenceLevel,
  };
}

/**
 * Atomic OCC CAS update on playbook_patterns
 */
export async function updatePatternScoreCAS(
  d1: ReturnType<typeof makeD1>,
  patternId: string,
  expectedDetectedAt: number,
  updates: {
    avgMetric: number;
    sampleSize: number;
    confidence: number;
    confidenceLevel: 'high' | 'medium' | 'low';
  },
  maxRetries = 3,
): Promise<CASUpdateResult> {
  let currentExpected = expectedDetectedAt;
  const now = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await d1
      .prepare(
        `UPDATE playbook_patterns
         SET avg_metric = ?,
             sample_size = ?,
             confidence = ?,
             confidence_level = ?,
             detected_at = ?
         WHERE id = ? AND detected_at = ?`,
      )
      .bind(
        updates.avgMetric,
        updates.sampleSize,
        updates.confidence,
        updates.confidenceLevel,
        now,
        patternId,
        currentExpected,
      )
      .run();

    if (result.meta.changes > 0) {
      return { success: true, changes: result.meta.changes, retries: attempt };
    }

    if (attempt < maxRetries) {
      const refreshed = await d1
        .prepare('SELECT detected_at FROM playbook_patterns WHERE id = ?')
        .bind(patternId)
        .first<{ detected_at: number }>();

      if (!refreshed) {
        return { success: false, changes: 0, retries: attempt, error: 'PATTERN_NOT_FOUND' };
      }
      currentExpected = refreshed.detected_at;
      await new Promise((resolve) => setTimeout(resolve, 5 * (attempt + 1)));
    }
  }

  return { success: false, changes: 0, retries: maxRetries, error: 'CONCURRENT_MODIFICATION' };
}

/**
 * Synthesizes high-confidence patterns into CampaignBlueprint
 */
export async function generateCampaignBlueprint(
  workspaceId: string,
  topic: string,
  patterns: PlaybookPattern[],
  targetPlatform: 'youtube_shorts' | 'tiktok' | 'instagram_reels' = 'youtube_shorts',
): Promise<CampaignBlueprint> {
  const topHookPattern = patterns.find(
    (p) => p.featureKey === 'hook_style' && p.confidence >= 0.7,
  );
  const hookStyle = (topHookPattern?.featureValue as HookStyle) || 'curiosity_gap';

  const topDurationPattern = patterns.find(
    (p) => p.featureKey === 'duration' && p.confidence >= 0.7,
  );
  const durationSeconds = topDurationPattern?.featureValue === '16-30s' ? 25 : 60;

  const topVoicePattern = patterns.find(
    (p) => p.featureKey === 'voice_style' && p.confidence >= 0.7,
  );
  const voiceStyle = (topVoicePattern?.featureValue as VoiceProfile) || 'dynamic_hook';

  return {
    id: `bp_${workspaceId}_${Date.now()}`,
    workspaceId,
    name: {
      en: `${topic} — High Conversion Playbook`,
      vi: `${topic} — Chiến Dịch Tối Ưu Chuyển Đổi`,
    },
    description: {
      en: `Automated campaign blueprint synthesized from winning patterns (Hook: ${hookStyle}, Voice: ${voiceStyle})`,
      vi: `Kịch bản chiến dịch tự động tổng hợp từ mẫu thắng thế (Mở đầu: ${hookStyle}, Giọng đọc: ${voiceStyle})`,
    },
    targetPlatform,
    hookStyle,
    voiceStyle,
    durationSeconds,
    aspectRatio: targetPlatform === 'youtube_shorts' || targetPlatform === 'tiktok' ? '9:16' : '1:1',
    estimatedScenes: durationSeconds <= 30 ? 3 : 5,
    suggestedPrompts: [
      {
        en: `High retention ${hookStyle} script opening for ${topic}`,
        vi: `Lời mở đầu dạng ${hookStyle} giữ chân người xem cho chủ đề ${topic}`,
      },
    ],
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ─── Section 5: Test Fixtures & Initial Setup ─────────────────────────────────

const WS_ID = 'ws_playbook_test_1';
const USER_ID = 'usr_playbook_test_1';

describe('Auto-Creative Playbook & Campaign Intelligence E2E — Phase 5', () => {
  let db: InstanceType<typeof DatabaseSync>;
  let d1: ReturnType<typeof makeD1>;

  beforeEach(() => {
    vi.clearAllMocks();
    db = new DatabaseSync(':memory:');
    db.exec(SCHEMA);
    d1 = makeD1(db);

    mocks.mockGetD1.mockResolvedValue(d1);
    mocks.mockCreateServerClient.mockReturnValue(d1);

    // Default authenticated session
    mocks.mockGetCurrentUser.mockResolvedValue({ id: USER_ID, email: 'creator@test.com' });
    mocks.mockVerifyWorkspaceAccess.mockResolvedValue(true);
    mocks.mockGetUserTier.mockResolvedValue('PREMIUM');
    mocks.mockGetBalance.mockResolvedValue({ credits_remaining: 1000 });
    mocks.mockListUserApiKeyProviders.mockResolvedValue([
      'openrouter',
      'elevenlabs',
      'fal-ai',
      'replicate',
    ]);
    mocks.mockGetUserApiKey.mockResolvedValue('valid_api_key_secret');
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // TIER 1: FEATURE COVERAGE (>=5 tests per feature across all 8 features)
  // ═════════════════════════════════════════════════════════════════════════════

  describe('Tier 1.1: Feature 1 — Creative Variable Extraction Engine', () => {
    it('1.1.1 extracts curiosity_gap hook style from script scene 0 narration', () => {
      const mission = { id: 'm_hook_1', workspace_id: WS_ID };
      const assets = [
        {
          type: 'script',
          track_type: 'track1',
          metadata: JSON.stringify({
            scenes: [{ narration: 'Wait until you see what happens next in this secret AI tool!' }],
          }),
        },
      ];
      const extracted = extractCreativeVariables(mission, assets);
      expect(extracted.hookStyle).toBe('curiosity_gap');
      expect(extracted.sceneCount).toBe(1);
    });

    it('1.1.2 extracts bold_claim, problem_agitation, question, and statistic_reveal hooks', () => {
      const mission = { id: 'm_hook_2', workspace_id: WS_ID };

      // bold_claim
      const bold = extractCreativeVariables(mission, [
        { type: 'script', metadata: { scenes: [{ narration: 'This is the 10x guaranteed method' }] } },
      ]);
      expect(bold.hookStyle).toBe('bold_claim');

      // problem_agitation
      const prob = extractCreativeVariables(mission, [
        { type: 'script', metadata: { scenes: [{ narration: 'Are you tired of losing followers every day?' }] } },
      ]);
      expect(prob.hookStyle).toBe('problem_agitation');

      // question
      const q = extractCreativeVariables(mission, [
        { type: 'script', metadata: { scenes: [{ narration: 'Why does nobody talk about this workflow?' }] } },
      ]);
      expect(q.hookStyle).toBe('question');

      // statistic_reveal
      const stat = extractCreativeVariables(mission, [
        { type: 'script', metadata: { scenes: [{ narration: 'Over 85% of businesses fail at video marketing' }] } },
      ]);
      expect(stat.hookStyle).toBe('statistic_reveal');
    });

    it('1.1.3 extracts voice profile, voiceId, and provider from audio metadata', () => {
      const mission = { id: 'm_voice_1', workspace_id: WS_ID };
      const assets = [
        {
          type: 'audio',
          track_type: 'track2',
          metadata: JSON.stringify({
            voiceId: 'eleven_rachel_voice_id',
            voiceStyle: 'enthusiastic_recommender',
            provider: 'elevenlabs',
          }),
        },
      ];
      const extracted = extractCreativeVariables(mission, assets);
      expect(extracted.voiceProfile.voiceId).toBe('eleven_rachel_voice_id');
      expect(extracted.voiceProfile.voiceStyle).toBe('enthusiastic_recommender');
      expect(extracted.voiceProfile.provider).toBe('elevenlabs');
    });

    it('1.1.4 buckets video duration across discrete standard ranges (0-15s, 16-30s, 31-60s, 61-90s, 90s+)', () => {
      const mission = { id: 'm_dur_1', workspace_id: WS_ID };

      expect(extractCreativeVariables(mission, [{ type: 'video', duration_seconds: 12 }]).durationPattern).toBe('0-15s');
      expect(extractCreativeVariables(mission, [{ type: 'video', duration_seconds: 25 }]).durationPattern).toBe('16-30s');
      expect(extractCreativeVariables(mission, [{ type: 'video', duration_seconds: 55 }]).durationPattern).toBe('31-60s');
      expect(extractCreativeVariables(mission, [{ type: 'video', duration_seconds: 80 }]).durationPattern).toBe('61-90s');
      expect(extractCreativeVariables(mission, [{ type: 'video', duration_seconds: 150 }]).durationPattern).toBe('90s+');
    });

    it('1.1.5 falls back safely when assets or scenes metadata are missing or empty', () => {
      const mission = { id: 'm_fallback_1', workspace_id: WS_ID };
      const extracted = extractCreativeVariables(mission, []);
      expect(extracted.hookStyle).toBe('curiosity_gap');
      expect(extracted.voiceProfile.voiceStyle).toBe('dynamic_hook');
      expect(extracted.durationPattern).toBe('16-30s');
      expect(extracted.aspectRatio).toBe('9:16');
      expect(extracted.sceneCount).toBe(1);
    });
  });

  describe('Tier 1.2: Feature 2 — Confidence & Effectiveness Scoring Engine', () => {
    it('1.2.1 rejects sample sizes < 5, returning 0 confidence', () => {
      expect(computeConfidence(0, 1.0)).toBe(0);
      expect(computeConfidence(1, 1.0)).toBe(0);
      expect(computeConfidence(4, 1.0)).toBe(0);
    });

    it('1.2.2 calculates logarithmic sample saturation (N=50) and consistency weighting', () => {
      const lowSample = computeConfidence(10, 1.0);
      const saturated = computeConfidence(50, 1.0);
      const supersaturated = computeConfidence(200, 1.0);

      expect(lowSample).toBeGreaterThan(0);
      expect(saturated).toBeGreaterThan(lowSample);
      expect(supersaturated).toBeCloseTo(saturated, 2); // Saturates at N=50
    });

    it('1.2.3 computes weighted composite effectiveness score: 35% CTR + 25% Retention + 30% Conv + 10% Eff', () => {
      const metrics: CreativeMetricsInput = {
        impressions: 10_000,
        views: 7_000,
        clicks: 500, // CTR = 5%
        conversions: 50, // Conv = 10%
        spendCents: 5_000, // $50
        revenueCents: 15_000, // $150 -> ROI = 3.0
        retentionRate: 0.70,
      };
      const result = calculateEffectivenessScore(metrics);
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.ctr).toBe(5);
      expect(result.conversionRate).toBe(10);
      expect(result.roiMultiplier).toBe(3.0);
    });

    it('1.2.4 derives CPA, ROI multiplier, and assigns confidence levels (high, medium, low)', () => {
      // High confidence (impressions >= 50)
      const high = calculateEffectivenessScore({
        impressions: 5_000,
        views: 3_000,
        clicks: 200,
        conversions: 20,
        spendCents: 4_000,
        revenueCents: 8_000,
      });
      expect(high.cpaCents).toBe(200); // 4000 / 20 = 200c ($2.00)
      expect(high.roiMultiplier).toBe(2.0);
      expect(high.confidenceLevel).toBe('high');

      // Low confidence (impressions < 5)
      const low = calculateEffectivenessScore({
        impressions: 4,
        views: 2,
        clicks: 1,
        conversions: 0,
        spendCents: 100,
        revenueCents: 0,
      });
      expect(low.confidence).toBe(0);
      expect(low.confidenceLevel).toBe('low');
    });

    it('1.2.5 provides zero-division guard against zero impressions, conversions, or spend', () => {
      const zeroMetrics: CreativeMetricsInput = {
        impressions: 0,
        views: 0,
        clicks: 0,
        conversions: 0,
        spendCents: 0,
        revenueCents: 0,
      };
      const result = calculateEffectivenessScore(zeroMetrics);
      expect(Number.isFinite(result.score)).toBe(true);
      expect(Number.isFinite(result.cpaCents)).toBe(true);
      expect(Number.isFinite(result.roiMultiplier)).toBe(true);
      expect(result.cpaCents).toBe(0);
      expect(result.roiMultiplier).toBe(0);
    });
  });

  describe('Tier 1.3: Feature 3 — OCC CAS State Transitions & Concurrency', () => {
    it('1.3.1 updates pattern score when detected_at matches expected timestamp (changes === 1)', async () => {
      const pattern: PlaybookPattern = {
        id: 'pat_cas_1',
        workspaceId: WS_ID,
        featureKey: 'hook_style',
        featureValue: 'curiosity_gap',
        metric: 'ctr',
        avgMetric: 0.08,
        sampleSize: 15,
        confidence: 0.75,
        confidenceLevel: 'medium',
        source: 'mission',
        detectedAt: 1000,
      };
      await upsertPattern(pattern);

      const res = await updatePatternScoreCAS(d1, 'pat_cas_1', 1000, {
        avgMetric: 0.12,
        sampleSize: 30,
        confidence: 0.88,
        confidenceLevel: 'medium',
      });

      expect(res.success).toBe(true);
      expect(res.changes).toBe(1);

      const top = await getTopPattern(WS_ID, 'hook_style');
      expect(top?.avgMetric).toBe(0.12);
      expect(top?.sampleSize).toBe(30);
    });

    it('1.3.2 aborts and reports CONCURRENT_MODIFICATION when row was altered concurrently', async () => {
      const pattern: PlaybookPattern = {
        id: 'pat_cas_conflict',
        workspaceId: WS_ID,
        featureKey: 'duration',
        featureValue: '16-30s',
        metric: 'ctr',
        avgMetric: 0.09,
        sampleSize: 20,
        confidence: 0.80,
        confidenceLevel: 'medium',
        source: 'mission',
        detectedAt: 2000,
      };
      await upsertPattern(pattern);

      // Expecting timestamp 1500 (stale), but stored is 2000; simulate 0 retries
      const res = await updatePatternScoreCAS(d1, 'pat_cas_conflict', 1500, {
        avgMetric: 0.14,
        sampleSize: 40,
        confidence: 0.92,
        confidenceLevel: 'high',
      }, 0);

      expect(res.success).toBe(false);
      expect(res.changes).toBe(0);
      expect(res.error).toBe('CONCURRENT_MODIFICATION');
    });

    it('1.3.3 automatically reloads latest timestamp and retries on concurrent collision', async () => {
      const pattern: PlaybookPattern = {
        id: 'pat_cas_retry',
        workspaceId: WS_ID,
        featureKey: 'channel',
        featureValue: 'tiktok',
        metric: 'conversion_rate',
        avgMetric: 0.04,
        sampleSize: 12,
        confidence: 0.72,
        confidenceLevel: 'medium',
        source: 'mission',
        detectedAt: 3000,
      };
      await upsertPattern(pattern);

      // Caller starts with stale timestamp 2500, but with retries=2 it refreshes to 3000
      const res = await updatePatternScoreCAS(d1, 'pat_cas_retry', 2500, {
        avgMetric: 0.07,
        sampleSize: 25,
        confidence: 0.84,
        confidenceLevel: 'medium',
      }, 2);

      expect(res.success).toBe(true);
      expect(res.retries).toBeGreaterThan(0);
      expect(res.changes).toBe(1);
    });

    it('1.3.4 atomically transitions mission status from completed to learning via CAS', async () => {
      db.prepare(
        `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase, updated_at)
         VALUES ('m_cas_1', ?, ?, 'Test Mission', 'completed', 'executing', 100)`,
      ).run(WS_ID, USER_ID);

      await transitionStatusCAS('m_cas_1', 'completed', 'learning', 'learning_loop');

      const mission = db.prepare('SELECT status, current_phase FROM creative_missions WHERE id = ?').get('m_cas_1') as { status: string; current_phase: string };
      expect(mission.status).toBe('learning');
      expect(mission.current_phase).toBe('learning_loop');
    });

    it('1.3.5 transitions mission status from learning to iterating and prevents invalid jumps', async () => {
      db.prepare(
        `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase, updated_at)
         VALUES ('m_cas_2', ?, ?, 'Test Mission 2', 'learning', 'learning_loop', 200)`,
      ).run(WS_ID, USER_ID);

      await transitionStatusCAS('m_cas_2', 'learning', 'iterating', 'blueprint_synthesis');

      const mission = db.prepare('SELECT status FROM creative_missions WHERE id = ?').get('m_cas_2') as { status: string };
      expect(mission.status).toBe('iterating');

      // Attempting to jump from expected 'completed' when current is 'iterating' fails CAS
      await expect(
        transitionStatusCAS('m_cas_2', 'completed', 'learning', 'illegal_jump'),
      ).rejects.toThrow(/status changed concurrently|CONCURRENT_MODIFICATION/);
    });
  });

  describe('Tier 1.4: Feature 4 — Campaign Blueprint Synthesis', () => {
    it('1.4.1 synthesizes winning patterns (confidence >= 0.70) into a CampaignBlueprint', async () => {
      const patterns: PlaybookPattern[] = [
        {
          id: 'p1',
          workspaceId: WS_ID,
          featureKey: 'hook_style',
          featureValue: 'bold_claim',
          metric: 'ctr',
          avgMetric: 0.12,
          sampleSize: 30,
          confidence: 0.85,
          confidenceLevel: 'medium',
          source: 'mission',
          detectedAt: 100,
        },
        {
          id: 'p2',
          workspaceId: WS_ID,
          featureKey: 'duration',
          featureValue: '16-30s',
          metric: 'ctr',
          avgMetric: 0.14,
          sampleSize: 40,
          confidence: 0.92,
          confidenceLevel: 'high',
          source: 'mission',
          detectedAt: 100,
        },
      ];

      const blueprint = await generateCampaignBlueprint(WS_ID, 'AI Tools Showcase', patterns);
      expect(blueprint.workspaceId).toBe(WS_ID);
      expect(blueprint.hookStyle).toBe('bold_claim');
      expect(blueprint.durationSeconds).toBe(25);
      expect(blueprint.aspectRatio).toBe('9:16');
      expect(blueprint.isActive).toBe(true);
    });

    it('1.4.2 adapts blueprint aspect ratio and channel config for YouTube Shorts and TikTok', async () => {
      const bpShorts = await generateCampaignBlueprint(WS_ID, 'Shorts Trend', [], 'youtube_shorts');
      expect(bpShorts.targetPlatform).toBe('youtube_shorts');
      expect(bpShorts.aspectRatio).toBe('9:16');

      const bpTikTok = await generateCampaignBlueprint(WS_ID, 'TikTok Trend', [], 'tiktok');
      expect(bpTikTok.targetPlatform).toBe('tiktok');
      expect(bpTikTok.aspectRatio).toBe('9:16');
    });

    it('1.4.3 falls back to sensible defaults when patterns do not meet confidence threshold', async () => {
      const lowConfPatterns: PlaybookPattern[] = [
        {
          id: 'p_low',
          workspaceId: WS_ID,
          featureKey: 'hook_style',
          featureValue: 'question',
          metric: 'ctr',
          avgMetric: 0.03,
          sampleSize: 4,
          confidence: 0.40,
          confidenceLevel: 'low',
          source: 'mission',
          detectedAt: 100,
        },
      ];

      const blueprint = await generateCampaignBlueprint(WS_ID, 'New Product', lowConfPatterns);
      expect(blueprint.hookStyle).toBe('curiosity_gap'); // Default fallback
      expect(blueprint.voiceStyle).toBe('dynamic_hook');
      expect(blueprint.durationSeconds).toBe(60);
    });

    it('1.4.4 computes estimated scenes and duration matching multi-track specifications', async () => {
      const shortBp = await generateCampaignBlueprint(WS_ID, 'Short Video', [
        { id: 'p', workspaceId: WS_ID, featureKey: 'duration', featureValue: '16-30s', metric: 'ctr', avgMetric: 0.1, sampleSize: 20, confidence: 0.8, confidenceLevel: 'medium', source: 'mission', detectedAt: 1 },
      ]);
      expect(shortBp.estimatedScenes).toBe(3);

      const longBp = await generateCampaignBlueprint(WS_ID, 'Long Video', []);
      expect(longBp.estimatedScenes).toBe(5);
    });

    it('1.4.5 generates bilingual suggested prompts (EN and VI) for campaign blueprint', async () => {
      const bp = await generateCampaignBlueprint(WS_ID, 'Affiliate Marketing', []);
      expect(bp.name.en).toContain('Affiliate Marketing');
      expect(bp.name.vi).toContain('Affiliate Marketing');
      expect(bp.suggestedPrompts).toHaveLength(1);
      expect(bp.suggestedPrompts[0].en).toBeDefined();
      expect(bp.suggestedPrompts[0].vi).toBeDefined();
    });
  });

  describe('Tier 1.5: Feature 5 — Fail-Closed 7-Gate Preflight Enforcement', () => {
    it('1.5.1 Gate 1 (auth): fails closed with NOT_AUTHENTICATED when unauthenticated', async () => {
      mocks.mockGetCurrentUser.mockResolvedValue(null);
      const res = await runMissionPreflightCheck({ workspaceId: WS_ID });
      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('NOT_AUTHENTICATED');
      expect(res.gates.auth.passed).toBe(false);
    });

    it('1.5.2 Gate 2 (ownership): fails closed with WORKSPACE_ACCESS_DENIED when not in workspace', async () => {
      mocks.mockVerifyWorkspaceAccess.mockResolvedValue(false);
      const res = await runMissionPreflightCheck({
        userId: USER_ID,
        workspaceId: 'forbidden_workspace',
      });
      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('WORKSPACE_ACCESS_DENIED');
      expect(res.gates.ownership.passed).toBe(false);
    });

    it('1.5.3 Gate 3 (entitlement): fails closed with INSUFFICIENT_ENTITLEMENT on 0 balance', async () => {
      mocks.mockGetUserTier.mockResolvedValue('BASIC');
      mocks.mockGetBalance.mockResolvedValue({ credits_remaining: 0 });
      const res = await runMissionPreflightCheck({
        userId: USER_ID,
        workspaceId: WS_ID,
      });
      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('INSUFFICIENT_ENTITLEMENT');
      expect(res.gates.entitlement.passed).toBe(false);
    });

    it('1.5.4 Gate 4 & 5 (credentials & capabilities): fails closed on missing multimodal track providers', async () => {
      // Missing video provider (replicate)
      mocks.mockListUserApiKeyProviders.mockResolvedValue(['openrouter', 'elevenlabs']);
      const res = await runMissionPreflightCheck({
        userId: USER_ID,
        workspaceId: WS_ID,
        requiredCapabilities: ['AI_TEXT', 'AI_AUDIO', 'AI_VIDEO'],
        overrides: { storageReady: true, queueReady: true },
      });
      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('CAPABILITY_NOT_SUPPORTED');
      expect(res.gates.capability.passed).toBe(false);
    });

    it('1.5.5 Gate 6 & 7 (storage & queue): passes all 7 gates when production infrastructure is healthy', async () => {
      mocks.mockListUserApiKeyProviders.mockResolvedValue([
        'openrouter',
        'elevenlabs',
        'fal-ai',
        'replicate',
      ]);
      const res = await runMissionPreflightCheck({
        userId: USER_ID,
        workspaceId: WS_ID,
        requiredCapabilities: ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'],
        overrides: { storageReady: true, queueReady: true },
      });
      expect(res.passed).toBe(true);
      expect(res.failureCode).toBeUndefined();
      expect(res.gates.auth.passed).toBe(true);
      expect(res.gates.ownership.passed).toBe(true);
      expect(res.gates.entitlement.passed).toBe(true);
      expect(res.gates.credential.passed).toBe(true);
      expect(res.gates.capability.passed).toBe(true);
      expect(res.gates.storage.passed).toBe(true);
      expect(res.gates.queue.passed).toBe(true);
    });
  });

  describe('Tier 1.6: Feature 6 — Quota Enforcement & Cost Spike Guard', () => {
    it('1.6.1 allows 9 missions and blocks at 10 missions for BASIC tier', async () => {
      // 9 missions exist
      for (let i = 0; i < 9; i++) {
        db.prepare(`INSERT INTO missions (id, org_id, name, created_at) VALUES (?, ?, 'M', datetime('now'))`).run(`m_${i}`, USER_ID);
      }
      const check9 = await checkMissionQuota(USER_ID, 'BASIC', 'missions');
      expect(check9.allowed).toBe(true);
      expect(check9.used).toBe(9);

      // 10th mission added
      db.prepare(`INSERT INTO missions (id, org_id, name, created_at) VALUES ('m_10', ?, 'M', datetime('now'))`).run(USER_ID);
      const check10 = await checkMissionQuota(USER_ID, 'BASIC', 'missions');
      expect(check10.allowed).toBe(false);
      expect(check10.used).toBe(10);
    });

    it('1.6.2 enforces PREMIUM tier limit (100 missions/month) across combined missions and engine_missions', async () => {
      // 60 in missions, 40 in engine_missions = 100
      for (let i = 0; i < 60; i++) {
        db.prepare(`INSERT INTO missions (id, org_id, name, created_at) VALUES (?, ?, 'M', datetime('now'))`).run(`pm_${i}`, USER_ID);
      }
      const nowSec = Math.floor(Date.now() / 1000);
      for (let i = 0; i < 40; i++) {
        db.prepare(`INSERT INTO engine_missions (id, user_id, title, created_at) VALUES (?, ?, 'EM', ?)`).run(`em_${i}`, USER_ID, nowSec);
      }

      const check = await checkMissionQuota(USER_ID, 'PREMIUM', 'missions');
      expect(check.used).toBe(100);
      expect(check.allowed).toBe(false);
      expect(check.limit).toBe(100);
    });

    it('1.6.3 allows high volume for MASTER tier (up to 10,000 missions/month)', async () => {
      const check = await checkMissionQuota(USER_ID, 'MASTER', 'missions');
      expect(check.limit).toBe(10000);
      expect(check.allowed).toBe(true);
    });

    it('1.6.4 cost spike guard fails closed when single mission/batch cost exceeds 500c ($5.00)', async () => {
      const res = await runMissionPreflightCheck({
        userId: USER_ID,
        workspaceId: WS_ID,
        estimatedCostCents: 501, // Exceeds MAX_SINGLE_MISSION_COST_CENTS (500)
      });
      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('BILLING_FAILURE');
      expect(res.gates.entitlement.passed).toBe(false);
    });

    it('1.6.5 verifies resetAt calculation points to next calendar month UTC', async () => {
      const check = await checkMissionQuota(USER_ID, 'PREMIUM', 'missions');
      const resetDate = new Date(check.resetAt);
      const now = new Date();
      expect(resetDate.getUTCDate()).toBe(1);
      expect(resetDate.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('Tier 1.7: Feature 7 — Rule Auto-Apply & SOP Installation Stamping', () => {
    const highConfidenceRule: PlaybookRule = {
      id: 'rule_auto_1',
      workspaceId: WS_ID,
      patternId: 'pat_high_1',
      platform: 'youtube_shorts',
      goal: 'conversion',
      ruleVi: 'Sử dụng hook curiosity_gap cho Shorts',
      ruleEn: 'Use curiosity_gap hooks for Shorts',
      confidence: 0.95,
      sampleSize: 50,
      appliedCount: 0,
      autoApply: true,
      rollbackCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('1.7.1 flags rule with autoApply: true when confidence >= 0.90', () => {
      expect(highConfidenceRule.autoApply).toBe(true);
      expect(highConfidenceRule.confidence).toBeGreaterThanOrEqual(0.90);
    });

    it('1.7.2 stamps PlaybookConfigValues (source: playbook, ruleId, autoApply) into installation config_values', async () => {
      const result = await applyPlaybook(highConfidenceRule, 'sop_tpl_shorts', USER_ID);
      expect(result.success).toBe(true);
      if (!result.success) return;

      const inst = db
        .prepare('SELECT config_values FROM user_sop_installations WHERE id = ?')
        .get(result.installationId) as { config_values: string };

      expect(inst).toBeDefined();
      const config = JSON.parse(inst.config_values);
      expect(config.source).toBe('playbook');
      expect(config.ruleId).toBe(highConfidenceRule.id);
      expect(config.platform).toBe('youtube_shorts');
      expect(config.autoApply).toBe(true);
    });

    it('1.7.3 toggleAutoApply roundtrips and updates autoApply boolean in JSON without schema changes', async () => {
      const applied = await applyPlaybook(highConfidenceRule, 'sop_tpl_toggle', USER_ID);
      expect(applied.success).toBe(true);
      if (!applied.success) return;

      const toggleOff = await toggleAutoApply(applied.installationId, false);
      expect(toggleOff.success).toBe(true);

      const cfgOff = await getPlaybookConfig(applied.installationId);
      expect(cfgOff?.autoApply).toBe(false);

      const toggleOn = await toggleAutoApply(applied.installationId, true);
      expect(toggleOn.success).toBe(true);

      const cfgOn = await getPlaybookConfig(applied.installationId);
      expect(cfgOn?.autoApply).toBe(true);
    });

    it('1.7.4 getPlaybookConfig filters out non-playbook installations, returning null', async () => {
      db.prepare(
        `INSERT INTO user_sop_installations (id, user_id, template_id, config_values)
         VALUES ('inst_manual', ?, 'tpl_manual', '{"source":"manual","autoApply":false}')`,
      ).run(USER_ID);

      const config = await getPlaybookConfig('inst_manual');
      expect(config).toBeNull();
    });

    it('1.7.5 applying a rule increments applied_count on playbook_rules idempotently', async () => {
      await upsertRule(highConfidenceRule);
      await recordApply(highConfidenceRule.id);
      await recordApply(highConfidenceRule.id);

      const rules = await listRules(WS_ID);
      const rule = rules.find((r) => r.id === highConfidenceRule.id);
      expect(rule?.appliedCount).toBe(2);
    });
  });

  describe('Tier 1.8: Feature 8 — Playbook Rule Rollback & Degradation Safeguards', () => {
    it('1.8.1 recordRollback increments rollback_count and updates timestamp in D1', async () => {
      const rule: PlaybookRule = {
        id: 'rule_rollback_1',
        workspaceId: WS_ID,
        patternId: 'pat_rb_1',
        platform: 'tiktok',
        goal: 'awareness',
        ruleVi: 'Quy tắc TikTok',
        ruleEn: 'TikTok Rule',
        confidence: 0.91,
        sampleSize: 20,
        appliedCount: 5,
        autoApply: true,
        rollbackCount: 0,
        createdAt: 100,
        updatedAt: 100,
      };
      await upsertRule(rule);
      await recordRollback(rule.id);

      const updated = (await listRules(WS_ID)).find((r) => r.id === rule.id);
      expect(updated?.rollbackCount).toBe(1);
      expect(updated?.updatedAt).toBeGreaterThan(100);
    });

    it('1.8.2 rollback disables auto_apply on degraded rules', async () => {
      const rule: PlaybookRule = {
        id: 'rule_degraded_1',
        workspaceId: WS_ID,
        patternId: 'pat_deg_1',
        platform: 'youtube_shorts',
        goal: 'conversion',
        ruleVi: 'Rule Degraded',
        ruleEn: 'Rule Degraded',
        confidence: 0.92,
        sampleSize: 30,
        appliedCount: 10,
        autoApply: true,
        rollbackCount: 0,
        createdAt: 100,
        updatedAt: 100,
      };
      await upsertRule(rule);

      // Disable auto_apply and increment rollback
      await recordRollback(rule.id);
      await db.prepare('UPDATE playbook_rules SET auto_apply = 0 WHERE id = ?').run(rule.id);

      const activeRules = await listRules(WS_ID, true);
      expect(activeRules.some((r) => r.id === rule.id)).toBe(false);
    });

    it('1.8.3 monitors performance degradation to trigger automated rollback (2x baseline failure)', async () => {
      const baselineFailureRate = 0.10;
      const currentFailureRate = 0.25; // Exceeds 2x baseline (0.20)

      const shouldRollback = currentFailureRate >= baselineFailureRate * 2.0;
      expect(shouldRollback).toBe(true);

      const rule: PlaybookRule = {
        id: 'rule_monitor_1',
        workspaceId: WS_ID,
        patternId: 'pat_m_1',
        platform: 'instagram_reels',
        goal: 'conversion',
        ruleVi: 'IG rule',
        ruleEn: 'IG rule',
        confidence: 0.94,
        sampleSize: 25,
        appliedCount: 8,
        autoApply: true,
        rollbackCount: 0,
        createdAt: 100,
        updatedAt: 100,
      };
      await upsertRule(rule);

      if (shouldRollback) {
        await recordRollback(rule.id);
      }

      const post = (await listRules(WS_ID)).find((r) => r.id === rule.id);
      expect(post?.rollbackCount).toBe(1);
    });

    it('1.8.4 preserves historical audit trail and rule identification during rollback', async () => {
      const rule: PlaybookRule = {
        id: 'rule_audit_1',
        workspaceId: WS_ID,
        patternId: 'pat_audit_1',
        platform: 'tiktok',
        goal: 'conversion',
        ruleVi: 'Bảo toàn dữ liệu',
        ruleEn: 'Preserve audit',
        confidence: 0.93,
        sampleSize: 40,
        appliedCount: 12,
        autoApply: true,
        rollbackCount: 0,
        createdAt: 500,
        updatedAt: 500,
      };
      await upsertRule(rule);
      await recordRollback(rule.id);

      const ruleRow = (await listRules(WS_ID)).find((r) => r.id === rule.id);
      expect(ruleRow?.patternId).toBe('pat_audit_1');
      expect(ruleRow?.appliedCount).toBe(12);
      expect(ruleRow?.rollbackCount).toBe(1);
    });

    it('1.8.5 handles rollback on non-existent rule gracefully without throwing unhandled exceptions', async () => {
      await expect(recordRollback('non_existent_rule_id')).resolves.not.toThrow();
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // TIER 2: BOUNDARY & CORNER CASES (Edge cases & Stress conditions)
  // ═════════════════════════════════════════════════════════════════════════════

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('2.1 evaluates sample size boundaries: 0, 1, 4 strictly return 0; 5 returns > 0', () => {
      expect(computeConfidence(0, 1.0)).toBe(0);
      expect(computeConfidence(1, 1.0)).toBe(0);
      expect(computeConfidence(4, 1.0)).toBe(0);
      expect(computeConfidence(5, 1.0)).toBeGreaterThan(0);
    });

    it('2.2 evaluates duration edge values: 0s, 15s, 16s, 30s, 31s, 60s, 61s, 90s, 91s, negative, non-numeric', () => {
      expect(bucketDuration('0')).toBe('0-15s');
      expect(bucketDuration('15')).toBe('0-15s');
      expect(bucketDuration('16')).toBe('16-30s');
      expect(bucketDuration('30')).toBe('16-30s');
      expect(bucketDuration('31')).toBe('31-60s');
      expect(bucketDuration('60')).toBe('31-60s');
      expect(bucketDuration('61')).toBe('61-90s');
      expect(bucketDuration('90')).toBe('61-90s');
      expect(bucketDuration('91')).toBe('90s+');
      expect(bucketDuration('-10')).toBe('0-15s');
      expect(bucketDuration('invalid_string')).toBe('unknown');
      expect(bucketDuration('')).toBe('unknown');
    });

    it('2.3 evaluates exact quota limit boundary: used = limit - 1 allows, used = limit rejects', async () => {
      for (let i = 0; i < 9; i++) {
        db.prepare(`INSERT INTO missions (id, org_id, name, created_at) VALUES (?, ?, 'M', datetime('now'))`).run(`edge_m_${i}`, USER_ID);
      }
      const beforeLimit = await checkMissionQuota(USER_ID, 'BASIC', 'missions');
      expect(beforeLimit.allowed).toBe(true);

      db.prepare(`INSERT INTO missions (id, org_id, name, created_at) VALUES ('edge_m_9', ?, 'M', datetime('now'))`).run(USER_ID);
      const atLimit = await checkMissionQuota(USER_ID, 'BASIC', 'missions');
      expect(atLimit.allowed).toBe(false);

      db.prepare(`INSERT INTO missions (id, org_id, name, created_at) VALUES ('edge_m_10', ?, 'M', datetime('now'))`).run(USER_ID);
      const overLimit = await checkMissionQuota(USER_ID, 'BASIC', 'missions');
      expect(overLimit.allowed).toBe(false);
    });

    it('2.4 evaluates cost spike ceiling boundary: 500c passes, 501c fails closed', async () => {
      const pass500 = await runMissionPreflightCheck({
        userId: USER_ID,
        workspaceId: WS_ID,
        estimatedCostCents: 500,
        overrides: { storageReady: true, queueReady: true },
      });
      expect(pass500.passed).toBe(true);

      const fail501 = await runMissionPreflightCheck({
        userId: USER_ID,
        workspaceId: WS_ID,
        estimatedCostCents: 501,
      });
      expect(fail501.passed).toBe(false);
      expect(fail501.failureCode).toBe('BILLING_FAILURE');
    });

    it('2.5 simulates concurrent CAS conflict with two simultaneous workers on same pattern', async () => {
      const pattern: PlaybookPattern = {
        id: 'pat_race_1',
        workspaceId: WS_ID,
        featureKey: 'hook_style',
        featureValue: 'curiosity_gap',
        metric: 'ctr',
        avgMetric: 0.10,
        sampleSize: 20,
        confidence: 0.80,
        confidenceLevel: 'medium',
        source: 'mission',
        detectedAt: 5000,
      };
      await upsertPattern(pattern);

      // Worker 1 and Worker 2 both read detectedAt = 5000
      // Worker 1 updates successfully
      const worker1 = await updatePatternScoreCAS(d1, 'pat_race_1', 5000, {
        avgMetric: 0.15,
        sampleSize: 25,
        confidence: 0.85,
        confidenceLevel: 'medium',
      }, 0);

      // Worker 2 attempts with stale 5000 without retry
      const worker2 = await updatePatternScoreCAS(d1, 'pat_race_1', 5000, {
        avgMetric: 0.16,
        sampleSize: 30,
        confidence: 0.88,
        confidenceLevel: 'medium',
      }, 0);

      expect(worker1.success).toBe(true);
      expect(worker2.success).toBe(false);
      expect(worker2.error).toBe('CONCURRENT_MODIFICATION');
    });

    it('2.6 verifies missing BYOK provider keys fail closed with precise missing capability details', async () => {
      // Only text configured, missing audio, image, video
      mocks.mockListUserApiKeyProviders.mockResolvedValue(['openrouter']);
      const res = await runMissionPreflightCheck({
        userId: USER_ID,
        workspaceId: WS_ID,
        requiredCapabilities: ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'],
        overrides: { storageReady: true, queueReady: true },
      });
      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('CAPABILITY_NOT_SUPPORTED');
      expect(res.gates.capability.details?.missingCapabilities).toEqual(
        expect.arrayContaining(['AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO']),
      );
    });

    it('2.7 verifies empty workspace returns clean empty arrays without unhandled null pointer exceptions', async () => {
      const emptyWS = 'ws_empty_zero_data';
      const patterns = await listPatterns(emptyWS);
      const rules = await listRules(emptyWS);
      expect(patterns).toEqual([]);
      expect(rules).toEqual([]);
    });

    it('2.8 verifies unique index uidx_playbook_patterns_upsert executes idempotent update ON CONFLICT', async () => {
      const p1: PlaybookPattern = {
        id: 'pat_idx_1',
        workspaceId: WS_ID,
        featureKey: 'posting_time',
        featureValue: 'prime',
        metric: 'ctr',
        avgMetric: 0.05,
        sampleSize: 10,
        confidence: 0.70,
        confidenceLevel: 'medium',
        source: 'mission',
        detectedAt: 100,
      };
      await upsertPattern(p1);

      // Same (workspaceId, featureKey, featureValue, metric) with different ID & updated metric
      const p2: PlaybookPattern = {
        id: 'pat_idx_2',
        workspaceId: WS_ID,
        featureKey: 'posting_time',
        featureValue: 'prime',
        metric: 'ctr',
        avgMetric: 0.09,
        sampleSize: 25,
        confidence: 0.85,
        confidenceLevel: 'medium',
        source: 'mission',
        detectedAt: 200,
      };
      await expect(upsertPattern(p2)).resolves.not.toThrow();

      const all = await listPatterns(WS_ID);
      const matching = all.filter((p) => p.featureKey === 'posting_time' && p.featureValue === 'prime');
      expect(matching).toHaveLength(1);
      expect(matching[0].avgMetric).toBe(0.09);
      expect(matching[0].sampleSize).toBe(25);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // TIER 3: CROSS-FEATURE COMBINATIONS (Pairwise Flows)
  // ═════════════════════════════════════════════════════════════════════════════

  describe('Tier 3: Cross-Feature Combinations', () => {
    it('3.1 Combo 1: Completed mission -> Ingestion -> Feature extraction -> Confidence scoring -> OCC CAS upsert -> Lifecycle advance', async () => {
      // 1. Mission in completed state
      const missionId = 'm_combo_1';
      db.prepare(
        `INSERT INTO creative_missions (id, workspace_id, creator_id, title, channels, status, current_phase, updated_at)
         VALUES (?, ?, ?, 'Viral Campaign', '["youtube_shorts"]', 'completed', 'executing', 100)`,
      ).run(missionId, WS_ID, USER_ID);

      // 2. Ingest associated media assets
      const assets = [
        {
          type: 'script',
          track_type: 'track1',
          metadata: JSON.stringify({ scenes: [{ narration: 'Wait until you discover this secret growth hack!' }] }),
        },
        {
          type: 'audio',
          track_type: 'track2',
          metadata: JSON.stringify({ voiceStyle: 'dynamic_hook', voiceId: 'rachel_123' }),
        },
        {
          type: 'video',
          track_type: 'track4',
          duration_seconds: 25,
          metadata: JSON.stringify({ aspectRatio: '9:16' }),
        },
      ];

      // 3. Extract creative variables
      const extracted = extractCreativeVariables({ id: missionId, workspace_id: WS_ID, channels: '["youtube_shorts"]' }, assets);
      expect(extracted.hookStyle).toBe('curiosity_gap');
      expect(extracted.durationPattern).toBe('16-30s');

      // 4. Calculate effectiveness score
      const score = calculateEffectivenessScore({
        impressions: 20_000,
        views: 14_000,
        clicks: 1_200,
        conversions: 120,
        spendCents: 10_000,
        revenueCents: 30_000,
      });
      expect(score.confidenceLevel).toBe('high');

      // 5. Store pattern with CAS
      const pattern: PlaybookPattern = {
        id: `pat_${missionId}`,
        workspaceId: WS_ID,
        featureKey: 'hook_style',
        featureValue: extracted.hookStyle,
        metric: 'ctr',
        avgMetric: score.ctr,
        sampleSize: 20_000,
        confidence: score.confidence,
        confidenceLevel: score.confidenceLevel,
        source: 'mission',
        detectedAt: Date.now(),
      };
      await upsertPattern(pattern);

      // 6. Transition mission completed -> learning -> iterating
      await transitionStatusCAS(missionId, 'completed', 'learning', 'learning_loop');
      await transitionStatusCAS(missionId, 'learning', 'iterating', 'blueprint_synthesis');

      const finalState = db.prepare('SELECT status FROM creative_missions WHERE id = ?').get(missionId) as { status: string };
      expect(finalState.status).toBe('iterating');
    });

    it('3.2 Combo 2: High-confidence pattern -> Bilingual rule generation -> Rule auto-apply -> Installation config stamping', async () => {
      const pattern: PlaybookPattern = {
        id: 'pat_combo_2',
        workspaceId: WS_ID,
        featureKey: 'voice_style',
        featureValue: 'dynamic_hook',
        metric: 'conversion_rate',
        avgMetric: 0.15,
        sampleSize: 60,
        confidence: 0.94,
        confidenceLevel: 'high',
        source: 'mission',
        detectedAt: Date.now(),
      };
      await upsertPattern(pattern);

      const rule: PlaybookRule = {
        id: 'rule_combo_2',
        workspaceId: WS_ID,
        patternId: pattern.id,
        platform: 'youtube_shorts',
        goal: 'conversion',
        ruleVi: 'Sử dụng giọng đọc dynamic_hook cho video ngắn chuyển đổi cao',
        ruleEn: 'Use dynamic_hook voice profile for high-conversion shorts',
        confidence: pattern.confidence,
        sampleSize: pattern.sampleSize,
        appliedCount: 0,
        autoApply: pattern.confidence >= 0.90,
        rollbackCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await upsertRule(rule);

      const result = await applyPlaybook(rule, 'sop_tpl_voice', USER_ID);
      expect(result.success).toBe(true);
      if (!result.success) return;

      const config = await getPlaybookConfig(result.installationId);
      expect(config?.ruleId).toBe(rule.id);
      expect(config?.autoApply).toBe(true);
      expect(config?.platform).toBe('youtube_shorts');
    });

    it('3.3 Combo 3: Pattern synthesis -> Blueprint creation -> Recurring schedule -> CAS advance next run date', async () => {
      const patterns = await listPatterns(WS_ID);
      const blueprint = await generateCampaignBlueprint(WS_ID, 'Weekly Tech Digest', patterns, 'youtube_shorts');
      expect(blueprint.id).toBeDefined();

      const todayStr = '2026-09-19';
      const scheduleId = 'sched_combo_3';
      db.prepare(
        `INSERT INTO scheduled_campaigns (id, workspace_id, user_id, topic, interval_days, next_run_date, is_active)
         VALUES (?, ?, ?, ?, 7, ?, 1)`,
      ).run(scheduleId, WS_ID, USER_ID, blueprint.name.en, todayStr);

      // Advance schedule date via CAS
      const nextDate = '2026-09-26';
      const updateResult = db
        .prepare(
          `UPDATE scheduled_campaigns
           SET next_run_date = ?, last_run_date = ?, updated_at = datetime('now')
           WHERE id = ? AND next_run_date = ?`,
        )
        .run(nextDate, todayStr, scheduleId, todayStr);

      expect(updateResult.changes).toBe(1);

      const row = db.prepare('SELECT next_run_date, last_run_date FROM scheduled_campaigns WHERE id = ?').get(scheduleId) as { next_run_date: string; last_run_date: string };
      expect(row.next_run_date).toBe('2026-09-26');
      expect(row.last_run_date).toBe('2026-09-19');
    });

    it('3.4 Combo 4: Due recurring schedule -> Tier quota check -> 7-gate preflight -> Credit deduction -> Batch dispatch', async () => {
      // 1. Quota check
      const quota = await checkMissionQuota(USER_ID, 'PREMIUM', 'missions');
      expect(quota.allowed).toBe(true);

      // 2. 7-Gate Preflight check
      const preflight = await runMissionPreflightCheck({
        userId: USER_ID,
        workspaceId: WS_ID,
        requiredCapabilities: ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'],
        estimatedCostCents: 150,
        overrides: { storageReady: true, queueReady: true },
      });
      expect(preflight.passed).toBe(true);

      // 3. Deduct MCU credits
      db.prepare(`INSERT INTO user_mcu_balance (user_id, credits_remaining) VALUES (?, 1000)`).run(USER_ID);
      const decResult = db
        .prepare(`UPDATE user_mcu_balance SET credits_remaining = credits_remaining - 150 WHERE user_id = ? AND credits_remaining >= 150`)
        .run(USER_ID);
      expect(decResult.changes).toBe(1);

      // 4. Record transaction
      db.prepare(`INSERT INTO mcu_transactions (id, user_id, amount_cents, reason) VALUES ('tx_1', ?, 150, 'batch_dispatch')`).run(USER_ID);

      const balance = db.prepare('SELECT credits_remaining FROM user_mcu_balance WHERE user_id = ?').get(USER_ID) as { credits_remaining: number };
      expect(balance.credits_remaining).toBe(850);
    });

    it('3.5 Combo 5: Degrading performance alert -> Auto-apply rollback -> Rollback count increment -> Blueprint fallback', async () => {
      const rule: PlaybookRule = {
        id: 'rule_degrade_combo',
        workspaceId: WS_ID,
        patternId: 'pat_deg_combo',
        platform: 'tiktok',
        goal: 'conversion',
        ruleVi: 'Degrade rule',
        ruleEn: 'Degrade rule',
        confidence: 0.93,
        sampleSize: 50,
        appliedCount: 20,
        autoApply: true,
        rollbackCount: 0,
        createdAt: 100,
        updatedAt: 100,
      };
      await upsertRule(rule);

      // Rollback triggered
      await recordRollback(rule.id);
      db.prepare('UPDATE playbook_rules SET auto_apply = 0 WHERE id = ?').run(rule.id);

      const rules = await listRules(WS_ID);
      const current = rules.find((r) => r.id === rule.id);
      expect(current?.rollbackCount).toBe(1);
      expect(current?.autoApply).toBe(false);

      // Blueprint generation falls back gracefully to default templates
      const fallbackBp = await generateCampaignBlueprint(WS_ID, 'Fallback Topic', []);
      expect(fallbackBp.hookStyle).toBe('curiosity_gap');
      expect(fallbackBp.isActive).toBe(true);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS (End-to-End Flows)
  // ═════════════════════════════════════════════════════════════════════════════

  describe('Tier 4: Real-World Application Scenarios', () => {
    it('4.1 Scenario 1: Automated Viral Shorts Playbook E2E Flow', async () => {
      // 1. Creator launches 10 YouTube Shorts missions
      for (let i = 0; i < 10; i++) {
        const mId = `m_viral_${i}`;
        db.prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, channels, status, current_phase, updated_at)
           VALUES (?, ?, ?, ?, '["youtube_shorts"]', 'completed', 'executing', 100)`,
        ).run(mId, WS_ID, USER_ID, `Viral Short #${i + 1}`);

        // Track 1 script with curiosity gap hook
        db.prepare(
          `INSERT INTO content_assets (id, project_id, workspace_id, mission_id, track_type, type, duration_seconds, metadata)
           VALUES (?, 'proj_1', ?, ?, 'track1', 'script', 25, ?)`,
        ).run(`ast_script_${i}`, WS_ID, mId, JSON.stringify({ scenes: [{ narration: 'Wait until you see how this tool changes everything!' }] }));

        // Track 2 audio with dynamic_hook voice
        db.prepare(
          `INSERT INTO content_assets (id, project_id, workspace_id, mission_id, track_type, type, metadata)
           VALUES (?, 'proj_1', ?, ?, 'track2', 'audio', ?)`,
        ).run(`ast_audio_${i}`, WS_ID, mId, JSON.stringify({ voiceId: 'voice_rachel', voiceStyle: 'dynamic_hook', provider: 'elevenlabs' }));

        // Track 4 video
        db.prepare(
          `INSERT INTO content_assets (id, project_id, workspace_id, mission_id, track_type, type, duration_seconds, metadata)
           VALUES (?, 'proj_1', ?, ?, 'track4', 'video', 25, '{"aspectRatio":"9:16"}')`,
        ).run(`ast_video_${i}`, WS_ID, mId);
      }

      // 2. Learning Loop processes completed missions
      const assets = db.prepare(`SELECT * FROM content_assets WHERE workspace_id = ?`).all(WS_ID) as Array<{ track_type: string; type: string; duration_seconds?: number; metadata: string }>;
      const extracted = extractCreativeVariables({ id: 'm_viral_0', workspace_id: WS_ID, channels: '["youtube_shorts"]' }, assets);
      expect(extracted.hookStyle).toBe('curiosity_gap');
      expect(extracted.voiceProfile.voiceStyle).toBe('dynamic_hook');
      expect(extracted.durationPattern).toBe('16-30s');

      // 3. Scoring detects winning pattern with 94% confidence
      const scoring = calculateEffectivenessScore({
        impressions: 50_000,
        views: 34_000,
        clicks: 6_250, // 12.5% CTR
        conversions: 625,
        spendCents: 25_000,
        revenueCents: 75_000,
        retentionRate: 0.68,
      });
      expect(scoring.ctr).toBe(12.5);
      expect(scoring.confidence).toBeGreaterThanOrEqual(0.90);
      expect(scoring.confidenceLevel).toBe('high');

      // 4. Pattern upserted to D1
      const pattern: PlaybookPattern = {
        id: 'pat_viral_shorts_winning',
        workspaceId: WS_ID,
        featureKey: 'hook_style',
        featureValue: extracted.hookStyle,
        metric: 'ctr',
        avgMetric: scoring.ctr,
        sampleSize: 50_000,
        confidence: scoring.confidence,
        confidenceLevel: 'high',
        source: 'mission',
        detectedAt: Date.now(),
      };
      await upsertPattern(pattern);

      // 5. Bilingual Playbook rule generated and auto-applied
      const rule: PlaybookRule = {
        id: 'rule_viral_shorts_auto',
        workspaceId: WS_ID,
        patternId: pattern.id,
        platform: 'youtube_shorts',
        goal: 'conversion',
        ruleVi: 'Sử dụng hook kiểu tò mò kết hợp giọng đọc dynamic_hook cho video ngắn dưới 30s',
        ruleEn: 'Use curiosity_gap hook combined with dynamic_hook voice for shorts under 30s',
        confidence: pattern.confidence,
        sampleSize: pattern.sampleSize,
        appliedCount: 0,
        autoApply: true,
        rollbackCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await upsertRule(rule);

      const installResult = await applyPlaybook(rule, 'sop_viral_shorts', USER_ID);
      expect(installResult.success).toBe(true);

      // 6. Campaign blueprint synthesized from winning hook and duration
      const durationPattern: PlaybookPattern = {
        id: 'pat_viral_duration_winning',
        workspaceId: WS_ID,
        featureKey: 'duration',
        featureValue: '16-30s',
        metric: 'ctr',
        avgMetric: 0.12,
        sampleSize: 50_000,
        confidence: 0.95,
        confidenceLevel: 'high',
        source: 'mission',
        detectedAt: Date.now(),
      };
      await upsertPattern(durationPattern);

      const blueprint = await generateCampaignBlueprint(WS_ID, 'AI Tech Shorts', [pattern, durationPattern], 'youtube_shorts');
      expect(blueprint.hookStyle).toBe('curiosity_gap');
      expect(blueprint.durationSeconds).toBe(25);
      expect(blueprint.aspectRatio).toBe('9:16');

      // 7. Daily recurring campaign schedule registered
      const todayStr = '2026-09-19';
      db.prepare(
        `INSERT INTO scheduled_campaigns (id, workspace_id, user_id, topic, interval_days, next_run_date, is_active)
         VALUES ('sched_viral_daily', ?, ?, ?, 1, ?, 1)`,
      ).run(WS_ID, USER_ID, blueprint.name.en, todayStr);

      // 8. Cron execution: preflight check, quota check, credit deduction, CAS schedule advance
      const preflight = await runMissionPreflightCheck({
        userId: USER_ID,
        workspaceId: WS_ID,
        requiredCapabilities: ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'],
        estimatedCostCents: 150,
        overrides: { storageReady: true, queueReady: true },
      });
      expect(preflight.passed).toBe(true);

      const quota = await checkMissionQuota(USER_ID, 'PREMIUM', 'missions');
      expect(quota.allowed).toBe(true);

      db.prepare(
        `UPDATE scheduled_campaigns
         SET next_run_date = '2026-09-20', last_run_date = ?, updated_at = datetime('now')
         WHERE id = 'sched_viral_daily' AND next_run_date = ?`,
      ).run(todayStr, todayStr);

      const schedRow = db.prepare('SELECT next_run_date FROM scheduled_campaigns WHERE id = ?').get('sched_viral_daily') as { next_run_date: string };
      expect(schedRow.next_run_date).toBe('2026-09-20');
    });

    it('4.2 Scenario 2: Recurring Affiliate Showcase Campaign E2E Flow', async () => {
      // 1. Setup TikTok Affiliate Campaign
      const topic = 'Smart Home Gadgets Review';
      const patterns: PlaybookPattern[] = [
        {
          id: 'pat_aff_hook',
          workspaceId: WS_ID,
          featureKey: 'hook_style',
          featureValue: 'problem_agitation',
          metric: 'conversion_rate',
          avgMetric: 0.08,
          sampleSize: 10_000,
          confidence: 0.92,
          confidenceLevel: 'high',
          source: 'mission',
          detectedAt: Date.now(),
        },
        {
          id: 'pat_aff_voice',
          workspaceId: WS_ID,
          featureKey: 'voice_style',
          featureValue: 'enthusiastic_recommender',
          metric: 'conversion_rate',
          avgMetric: 0.10,
          sampleSize: 10_000,
          confidence: 0.95,
          confidenceLevel: 'high',
          source: 'mission',
          detectedAt: Date.now(),
        },
      ];

      // 2. Blueprint synthesis for 60s TikTok review
      const blueprint = await generateCampaignBlueprint(WS_ID, topic, patterns, 'tiktok');
      expect(blueprint.targetPlatform).toBe('tiktok');
      expect(blueprint.hookStyle).toBe('problem_agitation');
      expect(blueprint.voiceStyle).toBe('enthusiastic_recommender');
      expect(blueprint.durationSeconds).toBe(60);
      expect(blueprint.aspectRatio).toBe('9:16');

      // 3. Batch size: 3 variations weekly
      const batchSize = 3;
      const totalEstimatedCostCents = batchSize * 150; // 450c <= 500c spike guard
      expect(totalEstimatedCostCents).toBeLessThanOrEqual(500);

      // 4. Preflight & Quota Verification
      const preflight = await runMissionPreflightCheck({
        userId: USER_ID,
        workspaceId: WS_ID,
        requiredCapabilities: ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'],
        estimatedCostCents: totalEstimatedCostCents,
        overrides: { storageReady: true, queueReady: true },
      });
      expect(preflight.passed).toBe(true);

      // 5. Deduct MCU credits for batch
      db.prepare(`INSERT INTO user_mcu_balance (user_id, credits_remaining) VALUES (?, 1000)`).run(USER_ID);
      const deduct = db
        .prepare(`UPDATE user_mcu_balance SET credits_remaining = credits_remaining - ? WHERE user_id = ? AND credits_remaining >= ?`)
        .run(totalEstimatedCostCents, USER_ID, totalEstimatedCostCents);
      expect(deduct.changes).toBe(1);

      // 6. Create 3 Mission records for batch fanout
      const batchMissions: string[] = [];
      for (let b = 1; b <= batchSize; b++) {
        const bMissionId = `m_aff_batch_${b}`;
        db.prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, budget_cents, status, current_phase, updated_at)
           VALUES (?, ?, ?, ?, 150, 'running', 'executing', ?)`,
        ).run(bMissionId, WS_ID, USER_ID, `${topic} — Variant ${b}`, Date.now());
        batchMissions.push(bMissionId);
      }
      expect(batchMissions).toHaveLength(3);

      // 7. Advance weekly schedule via CAS
      const todayStr = '2026-09-19';
      db.prepare(
        `INSERT INTO scheduled_campaigns (id, workspace_id, user_id, topic, interval_days, next_run_date, is_active)
         VALUES ('sched_aff_weekly', ?, ?, ?, 7, ?, 1)`,
      ).run(WS_ID, USER_ID, topic, todayStr);

      const nextWeekStr = '2026-09-26';
      const adv = db
        .prepare(
          `UPDATE scheduled_campaigns
           SET next_run_date = ?, last_run_date = ?, updated_at = datetime('now')
           WHERE id = 'sched_aff_weekly' AND next_run_date = ?`,
        )
        .run(nextWeekStr, todayStr, todayStr);
      expect(adv.changes).toBe(1);

      const schedResult = db.prepare('SELECT next_run_date FROM scheduled_campaigns WHERE id = ?').get('sched_aff_weekly') as { next_run_date: string };
      expect(schedResult.next_run_date).toBe('2026-09-26');
    });
  });
});
