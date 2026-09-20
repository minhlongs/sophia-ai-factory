/**
 * Opaque-box E2E Test Harness — Autonomous Growth & Revenue Engine ($1M MRR Path)
 *
 * Implements the contract specifications from PROJECT.md, TEST_INFRA.md, and ORIGINAL_REQUEST.md:
 * 1. Trend Scouting (TikTok, Shorts, X)
 * 2. Mathematical Hook Scoring (6 styles) & SES Forecast (alpha=0.40)
 * 3. Autonomous Daily Campaign Generator
 * 4. Closed-Loop Viral Feedback Ingestion & OCC CAS
 * 5. Marketplace Discovery (/marketplace, /vi/marketplace)
 * 6. Studio Blueprint Cloning & Pre-Flight Cost Estimator
 * 7. Creator Royalty Attribution & Lineage
 * 8. 5-Network Affiliate Webhook Ingestion & Timing-Safe HMAC
 * 9. 14-Day Anti-Fraud Clawback Hold & Dual-Entry Ledger
 * 10. NOWPayments USDT Mass Payouts & Daily Reconciliation
 * 11. Mekong Cloudflare Tunnel & Hybrid Edge Router
 * 12. 15-Second Edge Node Health & Failover
 *
 * Zero external network calls. Built on deterministic in-memory SQLite (node:sqlite).
 *
 * @module tests/e2e/growth-engine/growth-engine-harness
 */

import { createRequire } from 'node:module';

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

// ─── D1 Compatible In-Memory SQLite Wrapper ───────────────────────────────────

export interface MockD1Database {
  prepare(sql: string): {
    bind(...params: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | undefined>;
      run(): Promise<{ success: boolean; meta: { changes: number; duration: number } }>;
      all<T = Record<string, unknown>>(): Promise<{ results: T[]; meta: { changes: number; duration: number } }>;
    };
    first<T = Record<string, unknown>>(): Promise<T | undefined>;
    run(): Promise<{ success: boolean; meta: { changes: number; duration: number } }>;
    all<T = Record<string, unknown>>(): Promise<{ results: T[]; meta: { changes: number; duration: number } }>;
  };
  exec(sql: string): void;
  batch(stmts: unknown[]): Promise<unknown[]>;
  rawDb: InstanceType<typeof DatabaseSync>;
}

export function createGrowthEngineD1(): MockD1Database {
  const db = new DatabaseSync(':memory:');
  db.exec(GROWTH_ENGINE_SCHEMA);

  return {
    rawDb: db,
    prepare(sql: string) {
      const stmt: StatementSync = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T = Record<string, unknown>>() => stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
            },
            all: async <T = Record<string, unknown>>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0, duration: 0 } };
            },
          };
        },
        first: async <T = Record<string, unknown>>() => stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
        },
        all: async <T = Record<string, unknown>>() => {
          return { results: stmt.all() as T[], meta: { changes: 0, duration: 0 } };
        },
      };
    },
    exec: (sql: string) => db.exec(sql),
    batch: (stmts: unknown[]) => Promise.all(stmts),
  };
}

// ─── D1 Schema Definition ─────────────────────────────────────────────────────

export const GROWTH_ENGINE_SCHEMA = `
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
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_blueprints (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  hook_style TEXT NOT NULL,
  target_platform TEXT NOT NULL,
  aspect_ratios TEXT NOT NULL DEFAULT '["9:16"]',
  estimated_scenes INTEGER NOT NULL DEFAULT 5,
  estimated_duration_seconds INTEGER NOT NULL DEFAULT 30,
  estimated_cost_cents INTEGER NOT NULL DEFAULT 50,
  confidence REAL NOT NULL DEFAULT 0.8,
  status TEXT NOT NULL DEFAULT 'generated',
  marketplace_listed INTEGER NOT NULL DEFAULT 0,
  niche TEXT DEFAULT 'general',
  conversion_rate REAL DEFAULT 0.05,
  remix_count INTEGER NOT NULL DEFAULT 0,
  creator_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS creator_earnings_ledger (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  event_type TEXT NOT NULL DEFAULT 'royalty_accrual',
  source_type TEXT NOT NULL DEFAULT 'blueprint_remix',
  reference_id TEXT NOT NULL,
  balance_after_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'payable', 'paid', 'clawed_back')),
  sequence_num INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  UNIQUE(creator_id, reference_id, event_type),
  UNIQUE(creator_id, sequence_num)
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_creator_ledger_seq 
  ON creator_earnings_ledger(creator_id, sequence_num);

CREATE TABLE IF NOT EXISTS blueprint_remixes (
  id TEXT PRIMARY KEY,
  blueprint_id TEXT NOT NULL,
  parent_blueprint_id TEXT,
  creator_id TEXT NOT NULL,
  remixer_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  royalty_cents INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS commission_ledger (
  id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL,
  network TEXT NOT NULL,
  external_conversion_id TEXT NOT NULL,
  sub_id TEXT,
  order_value_cents INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  hold_days INTEGER NOT NULL DEFAULT 14,
  attributed_at INTEGER NOT NULL,
  payable_at INTEGER NOT NULL,
  payout_batch_id TEXT,
  parent_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payout_batches (
  id TEXT PRIMARY KEY,
  rail TEXT NOT NULL,
  total_amount_cents INTEGER NOT NULL DEFAULT 0,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'confirmed', 'reconciliation_failed')),
  tx_hash TEXT,
  created_at INTEGER NOT NULL,
  confirmed_at INTEGER
);

CREATE TABLE IF NOT EXISTS edge_nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tunnel_url TEXT NOT NULL,
  bearer_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ONLINE',
  hardware_profile TEXT NOT NULL DEFAULT 'apple_m1_max',
  cost_kind TEXT NOT NULL DEFAULT 'unmetered',
  last_heartbeat_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS edge_node_heartbeats (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms REAL NOT NULL DEFAULT 10.0,
  recorded_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS creative_missions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  budget_cents INTEGER NOT NULL DEFAULT 0,
  blueprint_id TEXT,
  created_at INTEGER NOT NULL
);
`;

// ─── Type Definitions ─────────────────────────────────────────────────────────

export type Platform = 'tiktok' | 'youtube_shorts' | 'x';
export type HookStyle =
  | 'question'
  | 'curiosity_gap'
  | 'bold_claim'
  | 'negative_warning'
  | 'story_opener'
  | 'before_after';

export type AffiliateNetwork =
  | 'tiktok_shop'
  | 'amazon_associates'
  | 'clickbank'
  | 'accesstrade'
  | 'awin';

export interface TrendingSignal {
  id: string;
  platform: Platform;
  topic: string;
  hashtag: string;
  volume: number;
  velocity: number;
  momentum: number;
  detectedAt: number;
}

export interface HookEvaluationInput {
  hookText: string;
  style: HookStyle;
  pacingScore: number;
  retentionScore: number;
  ctaScore: number;
  hookStyleScore?: number;
}

export interface HookScoreResult {
  viralScore: number;
  breakdown: {
    hook: number;
    pacing: number;
    retention: number;
    cta: number;
  };
  style: HookStyle;
  verdict: 'viral' | 'strong' | 'moderate' | 'weak';
}

export interface ForecastPoint {
  step: number;
  timestamp: number;
  projected: number;
  lower: number;
  upper: number;
}

export interface ForecastResult {
  alpha: number;
  level: number;
  residualStdDev: number;
  points: ForecastPoint[];
}

export interface CampaignBlueprint {
  id: string;
  workspaceId: string;
  title: string;
  hookStyle: HookStyle;
  targetPlatform: Platform;
  aspectRatios: string[];
  estimatedScenes: number;
  estimatedDurationSeconds: number;
  estimatedCostCents: number;
  confidence: number;
  status: 'generated' | 'active';
  createdAt: number;
}

export interface VideoEngagementFeedback {
  patternId: string;
  views: number;
  shares: number;
  watchTimeSeconds: number;
  durationSeconds: number;
  conversions: number;
  spendCents: number;
  expectedDetectedAt: number;
}

export interface PatternUpdateResult {
  success: boolean;
  patternId: string;
  newScore: number;
  newSampleSize: number;
  previousDetectedAt: number;
  newDetectedAt: number;
  retries: number;
  error?: string;
}

export interface MarketplaceFilters {
  niche?: string;
  platform?: Platform;
  minConversionRate?: number;
  search?: string;
  page?: number;
  pageSize?: number;
  locale?: 'en' | 'vi';
}

export interface MarketplaceBlueprintItem {
  id: string;
  workspaceId: string;
  title: string;
  hookStyle: string;
  targetPlatform: string;
  aspectRatios: string[];
  estimatedScenes: number;
  estimatedDurationSeconds: number;
  estimatedCostCents: number;
  niche: string;
  conversionRate: number;
  remixCount: number;
  creatorId: string;
  createdAt: number;
}

export interface PaginatedBlueprints {
  items: MarketplaceBlueprintItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PreflightCostEstimate {
  audioMCU: number;
  visualMCU: number;
  llmMCU: number;
  totalMCU: number;
  totalCostCents: number;
  isCeilingExceeded: boolean;
}

export interface CloneBlueprintResult {
  success: boolean;
  missionId?: string;
  blueprintId: string;
  preflightCostCents: number;
  error?: string;
}

export interface BlueprintRemixInput {
  blueprintId: string;
  parentCreatorId: string;
  remixerUserId: string;
  missionId: string;
  revenueCents: number;
  royaltyPercent: number;
}

export interface RoyaltyAccrualResult {
  success: boolean;
  remixId: string;
  creatorId: string;
  royaltyCents: number;
  ledgerId: string;
  error?: string;
}

export interface WebhookProcessingResult {
  success: boolean;
  conversionId?: string;
  affiliateId?: string;
  commissionCents?: number;
  payableAt?: number;
  network?: AffiliateNetwork;
  error?: string;
}

export interface LedgerAdjustmentResult {
  success: boolean;
  adjustmentId?: string;
  amountCents: number;
  status: 'clawback';
  parentConversionId: string;
  error?: string;
}

export interface PayoutBatchResult {
  success: boolean;
  batchId?: string;
  totalAmountCents: number;
  recipientCount: number;
  claimedRowIds: string[];
  error?: string;
}

export interface ReconciliationResult {
  batchId: string;
  ledgerClaimedCents: number;
  externalConfirmedCents: number;
  diffCents: number;
  isReconciled: boolean;
  alertRequired: boolean;
}

export interface InferenceTask {
  taskId: string;
  type: 'llm' | 'tts' | 'image' | 'video';
  prompt: string;
  model: string;
  maxTokens?: number;
}

export interface InferenceResult {
  taskId: string;
  provider: 'mekong_m1_max' | 'cloud_byok';
  costKind: 'unmetered' | 'metered';
  output: string;
  latencyMs: number;
  encrypted: boolean;
}

export interface NodeHealthStatus {
  nodeId: string;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  latencyMs: number;
  reachable: boolean;
  lastCheckedAt: number;
}

// ─── Feature 1: Hermes V2 Cross-Channel Trend Scouting ─────────────────────────

export async function scoutTrendingSignals(
  platform: Platform,
  query: string,
  _db: MockD1Database,
  nowMs = Date.now(),
): Promise<TrendingSignal[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  // Generate deterministic signals based on platform and query
  const mockTags = [
    `#${normalizedQuery}`,
    `#${normalizedQuery}hack`,
    `#${normalizedQuery}viral`,
    `#${normalizedQuery}review`,
    `#best${normalizedQuery}`,
  ];

  return mockTags.map((hashtag, idx) => {
    const baseVolume = 10000 * (5 - idx);
    const velocity = Math.round(150 * (5 - idx) * (platform === 'tiktok' ? 1.5 : 1.0));
    // z-score momentum calculation with multiplier
    const zScore = (velocity - 100) / 30;
    const platformMultiplier = platform === 'tiktok' ? 1.3 : platform === 'youtube_shorts' ? 1.2 : 1.0;
    const momentum = Math.max(0, Number((zScore * platformMultiplier).toFixed(3)));

    return {
      id: `sig_${platform}_${idx}_${nowMs}`,
      platform,
      topic: normalizedQuery,
      hashtag,
      volume: baseVolume,
      velocity,
      momentum,
      detectedAt: nowMs - idx * 3600000,
    };
  });
}

// ─── Feature 2: Mathematical Hook Scoring & SES Forecasting ───────────────────

export function calculateHookScore(input: HookEvaluationInput): HookScoreResult {
  // 6 canonical hook styles baseline weights
  const styleMultipliers: Record<HookStyle, number> = {
    question: 82,
    curiosity_gap: 94,
    bold_claim: 88,
    negative_warning: 90,
    story_opener: 85,
    before_after: 89,
  };

  const hookScore = input.hookStyleScore ?? styleMultipliers[input.style] ?? 70;
  // Formula: S_viral = 0.40 * S_hook + 0.25 * S_pacing + 0.20 * S_retention + 0.15 * S_cta
  const rawScore =
    0.4 * hookScore +
    0.25 * input.pacingScore +
    0.2 * input.retentionScore +
    0.15 * input.ctaScore;

  const viralScore = Math.max(0, Math.min(100, Number(rawScore.toFixed(2))));

  let verdict: 'viral' | 'strong' | 'moderate' | 'weak';
  if (viralScore >= 85) verdict = 'viral';
  else if (viralScore >= 70) verdict = 'strong';
  else if (viralScore >= 50) verdict = 'moderate';
  else verdict = 'weak';

  return {
    viralScore,
    breakdown: {
      hook: Number((0.4 * hookScore).toFixed(2)),
      pacing: Number((0.25 * input.pacingScore).toFixed(2)),
      retention: Number((0.2 * input.retentionScore).toFixed(2)),
      cta: Number((0.15 * input.ctaScore).toFixed(2)),
    },
    style: input.style,
    verdict,
  };
}

export function calculateSESForecast(
  series: readonly number[],
  alpha = 0.4,
  horizonSteps = 7,
  stepMs = 86400000,
  nowMs = Date.now(),
): ForecastResult {
  if (alpha <= 0 || alpha > 1 || !Number.isFinite(alpha)) {
    throw new RangeError(`alpha must be in (0, 1], received ${alpha}`);
  }
  if (series.length === 0) {
    return { alpha, level: 0, residualStdDev: 0, points: [] };
  }

  // SES recursion: l_t = alpha * x_t + (1 - alpha) * l_{t-1}, l_0 = x_0
  let level = series[0];
  const errors: number[] = [];

  for (let i = 1; i < series.length; i++) {
    errors.push(series[i] - level);
    level = alpha * series[i] + (1 - alpha) * level;
  }

  let residualStdDev = 0;
  if (errors.length > 0) {
    const mean = errors.reduce((acc, e) => acc + e, 0) / errors.length;
    const variance = errors.reduce((acc, e) => acc + (e - mean) ** 2, 0) / errors.length;
    residualStdDev = Math.sqrt(variance);
  }

  const points: ForecastPoint[] = [];
  const Z_95 = 1.95996;

  for (let step = 1; step <= horizonSteps; step++) {
    const margin = Z_95 * residualStdDev * Math.sqrt(step);
    points.push({
      step,
      timestamp: nowMs + step * stepMs,
      projected: Math.max(0, Number(level.toFixed(2))),
      lower: Math.max(0, Number((level - margin).toFixed(2))),
      upper: Math.max(0, Number((level + margin).toFixed(2))),
    });
  }

  return {
    alpha,
    level: Number(level.toFixed(2)),
    residualStdDev: Number(residualStdDev.toFixed(2)),
    points,
  };
}

// ─── Feature 3: Autonomous Daily Campaign Generator ───────────────────────────

export async function generateDailyCampaignBlueprints(
  db: MockD1Database,
  workspaceId: string,
  minConfidence = 0.7,
  nowMs = Date.now(),
): Promise<CampaignBlueprint[]> {
  const patternsResult = await db
    .prepare(
      `SELECT * FROM playbook_patterns
       WHERE workspace_id = ? AND confidence >= ?
       ORDER BY confidence DESC LIMIT 10`,
    )
    .bind(workspaceId, minConfidence)
    .all<{
      id: string;
      feature_key: string;
      feature_value: string;
      confidence: number;
    }>();

  const patterns = patternsResult.results;
  const blueprints: CampaignBlueprint[] = [];

  for (const pattern of patterns) {
    const hookStyle: HookStyle =
      pattern.feature_key === 'hook_style' &&
      [
        'question',
        'curiosity_gap',
        'bold_claim',
        'negative_warning',
        'story_opener',
        'before_after',
      ].includes(pattern.feature_value)
        ? (pattern.feature_value as HookStyle)
        : 'curiosity_gap';

    const targetPlatform: Platform =
      pattern.feature_value === 'shorts'
        ? 'youtube_shorts'
        : pattern.feature_value === 'x'
          ? 'x'
          : 'tiktok';

    const aspectRatios = targetPlatform === 'x' ? ['16:9', '1:1'] : ['9:16'];
    const estimatedScenes = 5;
    const estimatedDurationSeconds = 30;
    const estimatedCostCents = 45; // 45 cents USD

    const blueprintId = `bp_${Math.random().toString(36).substring(2, 9)}_${nowMs}`;
    const title = `Auto Campaign: ${pattern.feature_key}=${pattern.feature_value} (${targetPlatform})`;

    await db
      .prepare(
        `INSERT INTO campaign_blueprints (
          id, workspace_id, title, hook_style, target_platform, aspect_ratios,
          estimated_scenes, estimated_duration_seconds, estimated_cost_cents,
          confidence, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        blueprintId,
        workspaceId,
        title,
        hookStyle,
        targetPlatform,
        JSON.stringify(aspectRatios),
        estimatedScenes,
        estimatedDurationSeconds,
        estimatedCostCents,
        pattern.confidence,
        'generated',
        nowMs,
      )
      .run();

    blueprints.push({
      id: blueprintId,
      workspaceId,
      title,
      hookStyle,
      targetPlatform,
      aspectRatios,
      estimatedScenes,
      estimatedDurationSeconds,
      estimatedCostCents,
      confidence: pattern.confidence,
      status: 'generated',
      createdAt: nowMs,
    });
  }

  return blueprints;
}

// ─── Feature 4: Closed-Loop Viral Feedback Ingestion & OCC CAS ─────────────────

export async function ingestEngagementFeedback(
  db: MockD1Database,
  feedback: VideoEngagementFeedback,
  nowMs = Date.now(),
): Promise<PatternUpdateResult> {
  // Input validations & negative value guards
  if (feedback.views < 0 || feedback.shares < 0 || feedback.watchTimeSeconds < 0) {
    return {
      success: false,
      patternId: feedback.patternId,
      newScore: 0,
      newSampleSize: 0,
      previousDetectedAt: feedback.expectedDetectedAt,
      newDetectedAt: feedback.expectedDetectedAt,
      retries: 0,
      error: 'INVALID_METRICS_NEGATIVE',
    };
  }

  // Calculate Creative Effectiveness Score (CES):
  // 0.35 * CTR + 0.25 * Retention + 0.30 * Conv + 0.10 * Efficiency
  const views = Math.max(1, feedback.views);
  const ctr = Math.min(1.0, feedback.shares / views);
  const duration = Math.max(1, feedback.durationSeconds);
  const retention = Math.min(1.0, feedback.watchTimeSeconds / (views * duration));
  const conversionRate = Math.min(1.0, feedback.conversions / views);
  const efficiency = Math.max(0, Math.min(1.0, 1.0 - (feedback.spendCents / 1000)));

  const ces = 0.35 * ctr + 0.25 * retention + 0.3 * conversionRate + 0.1 * efficiency;
  const newScore = Number((ces * 100).toFixed(2));

  // OCC CAS Update:
  // Verify detected_at matches expectedDetectedAt
  const existing = await db
    .prepare('SELECT id, sample_size, detected_at, confidence FROM playbook_patterns WHERE id = ?')
    .bind(feedback.patternId)
    .first<{ id: string; sample_size: number; detected_at: number; confidence: number }>();

  if (!existing) {
    return {
      success: false,
      patternId: feedback.patternId,
      newScore,
      newSampleSize: 0,
      previousDetectedAt: feedback.expectedDetectedAt,
      newDetectedAt: feedback.expectedDetectedAt,
      retries: 0,
      error: 'PATTERN_NOT_FOUND',
    };
  }

  if (existing.detected_at !== feedback.expectedDetectedAt) {
    return {
      success: false,
      patternId: feedback.patternId,
      newScore,
      newSampleSize: existing.sample_size,
      previousDetectedAt: existing.detected_at,
      newDetectedAt: existing.detected_at,
      retries: 0,
      error: 'CONCURRENT_MODIFICATION_COLLISION',
    };
  }

  const updatedSampleSize = existing.sample_size + 1;
  const updatedConfidence = Math.min(0.99, Number((existing.confidence + 0.02).toFixed(2)));

  const updateResult = await db
    .prepare(
      `UPDATE playbook_patterns
       SET avg_metric = ?, sample_size = ?, confidence = ?, detected_at = ?
       WHERE id = ? AND detected_at = ?`,
    )
    .bind(
      newScore,
      updatedSampleSize,
      updatedConfidence,
      nowMs,
      feedback.patternId,
      feedback.expectedDetectedAt,
    )
    .run();

  if (updateResult.meta.changes === 0) {
    return {
      success: false,
      patternId: feedback.patternId,
      newScore,
      newSampleSize: existing.sample_size,
      previousDetectedAt: feedback.expectedDetectedAt,
      newDetectedAt: feedback.expectedDetectedAt,
      retries: 1,
      error: 'CAS_ATTEMPT_FAILED',
    };
  }

  return {
    success: true,
    patternId: feedback.patternId,
    newScore,
    newSampleSize: updatedSampleSize,
    previousDetectedAt: feedback.expectedDetectedAt,
    newDetectedAt: nowMs,
    retries: 0,
  };
}

// ─── Feature 5: Marketplace Discovery Interface ────────────────────────────────

export async function listMarketplaceBlueprints(
  db: MockD1Database,
  filters: MarketplaceFilters,
): Promise<PaginatedBlueprints> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(50, filters.pageSize ?? 10));
  const offset = (page - 1) * pageSize;

  let query = 'SELECT * FROM campaign_blueprints WHERE marketplace_listed = 1';
  const params: unknown[] = [];

  if (filters.niche) {
    query += ' AND niche = ?';
    params.push(filters.niche);
  }

  if (filters.platform) {
    query += ' AND target_platform = ?';
    params.push(filters.platform);
  }

  if (filters.minConversionRate !== undefined) {
    query += ' AND conversion_rate >= ?';
    params.push(filters.minConversionRate);
  }

  if (filters.search) {
    query += ' AND title LIKE ?';
    params.push(`%${filters.search}%`);
  }

  // Count total matching
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countRes = await db.prepare(countQuery).bind(...params).first<{ total: number }>();
  const total = countRes?.total ?? 0;

  query += ' ORDER BY conversion_rate DESC, remix_count DESC LIMIT ? OFFSET ?';
  params.push(pageSize, offset);

  const rows = await db.prepare(query).bind(...params).all<{
    id: string;
    workspace_id: string;
    title: string;
    hook_style: string;
    target_platform: string;
    aspect_ratios: string;
    estimated_scenes: number;
    estimated_duration_seconds: number;
    estimated_cost_cents: number;
    niche: string;
    conversion_rate: number;
    remix_count: number;
    creator_id: string;
    created_at: number;
  }>();

  const items: MarketplaceBlueprintItem[] = rows.results.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    title: r.title,
    hookStyle: r.hook_style,
    targetPlatform: r.target_platform,
    aspectRatios: JSON.parse(r.aspect_ratios || '["9:16"]'),
    estimatedScenes: r.estimated_scenes,
    estimatedDurationSeconds: r.estimated_duration_seconds,
    estimatedCostCents: r.estimated_cost_cents,
    niche: r.niche,
    conversionRate: r.conversion_rate,
    remixCount: r.remix_count,
    creatorId: r.creator_id,
    createdAt: r.created_at,
  }));

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ─── Feature 6: Studio Blueprint Cloning & Pre-Flight Cost Estimator ──────────

export function estimateBlueprintStudioCost(
  scenes: number,
  durationSeconds: number,
  trackCount = 3,
): PreflightCostEstimate {
  // MCU Rates:
  // LLM script generation: 50 MCU
  // Audio narration (ElevenLabs): 10 MCU per 5s = 2 MCU/sec
  // Visual generation (Fal / Midjourney): 40 MCU per scene
  const llmMCU = 50;
  const audioMCU = Math.round(durationSeconds * 2);
  const visualMCU = scenes * 40;
  const totalMCU = (llmMCU + audioMCU + visualMCU) * Math.max(1, trackCount / 2);

  // Conversion: 10 MCU = 1 cent USD ($0.01)
  const totalCostCents = Math.round(totalMCU / 10);
  const isCeilingExceeded = totalCostCents > 500; // $5.00 ceiling

  return {
    audioMCU,
    visualMCU,
    llmMCU,
    totalMCU,
    totalCostCents,
    isCeilingExceeded,
  };
}

export async function cloneBlueprintForMission(
  db: MockD1Database,
  blueprintId: string,
  userId: string,
  workspaceId: string,
  nowMs = Date.now(),
): Promise<CloneBlueprintResult> {
  const bp = await db
    .prepare('SELECT * FROM campaign_blueprints WHERE id = ?')
    .bind(blueprintId)
    .first<{
      id: string;
      title: string;
      estimated_scenes: number;
      estimated_duration_seconds: number;
      estimated_cost_cents: number;
    }>();

  if (!bp) {
    return {
      success: false,
      blueprintId,
      preflightCostCents: 0,
      error: 'BLUEPRINT_NOT_FOUND',
    };
  }

  const preflight = estimateBlueprintStudioCost(
    bp.estimated_scenes,
    bp.estimated_duration_seconds,
  );

  if (preflight.isCeilingExceeded) {
    return {
      success: false,
      blueprintId,
      preflightCostCents: preflight.totalCostCents,
      error: 'COST_SPIKE_CEILING_EXCEEDED',
    };
  }

  const missionId = `mis_${Math.random().toString(36).substring(2, 9)}_${nowMs}`;

  await db
    .prepare(
      `INSERT INTO creative_missions (
        id, workspace_id, creator_id, title, status, budget_cents, blueprint_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      missionId,
      workspaceId,
      userId,
      `Cloned: ${bp.title}`,
      'draft',
      preflight.totalCostCents,
      blueprintId,
      nowMs,
    )
    .run();

  // Increment remix count on blueprint
  await db
    .prepare('UPDATE campaign_blueprints SET remix_count = remix_count + 1 WHERE id = ?')
    .bind(blueprintId)
    .run();

  return {
    success: true,
    missionId,
    blueprintId,
    preflightCostCents: preflight.totalCostCents,
  };
}

// ─── Feature 7: Creator Royalty Attribution & Lineage ──────────────────────────

export async function recordBlueprintRemixAndAccrueRoyalty(
  db: MockD1Database,
  remix: BlueprintRemixInput,
  nowMs = Date.now(),
): Promise<RoyaltyAccrualResult> {
  if (remix.royaltyPercent < 0 || remix.royaltyPercent > 100) {
    return {
      success: false,
      remixId: '',
      creatorId: remix.parentCreatorId,
      royaltyCents: 0,
      ledgerId: '',
      error: 'INVALID_ROYALTY_PERCENT',
    };
  }

  // Prevent self-remix royalty fraud
  if (remix.parentCreatorId === remix.remixerUserId) {
    return {
      success: false,
      remixId: '',
      creatorId: remix.parentCreatorId,
      royaltyCents: 0,
      ledgerId: '',
      error: 'CIRCULAR_SELF_REMIX_DENIED',
    };
  }

  const royaltyCents = Math.floor((remix.revenueCents * remix.royaltyPercent) / 100);
  const remixId = `rem_${Math.random().toString(36).substring(2, 9)}_${nowMs}`;
  const ledgerId = `led_${Math.random().toString(36).substring(2, 9)}_${nowMs}`;

  // Record remix relationship
  await db
    .prepare(
      `INSERT INTO blueprint_remixes (
        id, blueprint_id, creator_id, remixer_id, mission_id, royalty_cents, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      remixId,
      remix.blueprintId,
      remix.parentCreatorId,
      remix.remixerUserId,
      remix.missionId,
      royaltyCents,
      nowMs,
    )
    .run();

  // Accrue earnings in creator earnings ledger with monotonic sequence & balance tracking
  let nextSeq = 1;
  let nextBalance = royaltyCents;

  try {
    const tail = await db
      .prepare(
        `SELECT sequence_num, balance_after_cents, amount_cents 
         FROM creator_earnings_ledger 
         WHERE creator_id = ? 
         ORDER BY sequence_num DESC, created_at DESC 
         LIMIT 1`,
      )
      .bind(remix.parentCreatorId)
      .first<{ sequence_num?: number; balance_after_cents?: number; amount_cents?: number }>();

    if (tail) {
      nextSeq = (tail.sequence_num ?? 0) + 1;
      nextBalance = (tail.balance_after_cents ?? tail.amount_cents ?? 0) + royaltyCents;
    }
  } catch {
    // Fallback for minimal schemas
  }

  await db
    .prepare(
      `INSERT INTO creator_earnings_ledger (
        id, creator_id, source_type, reference_id, amount_cents, status, created_at,
        balance_after_cents, sequence_num, event_type, currency, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      ledgerId,
      remix.parentCreatorId,
      'blueprint_remix',
      remixId,
      royaltyCents,
      'pending',
      nowMs,
      nextBalance,
      nextSeq,
      'royalty_accrual',
      'USD',
      '{}',
    )
    .run();

  return {
    success: true,
    remixId,
    creatorId: remix.parentCreatorId,
    royaltyCents,
    ledgerId,
  };
}

// ─── Feature 8: 5-Network Affiliate Webhook Ingestion & Timing-Safe HMAC ────────

export async function verifyAffiliateHmac(
  rawBody: string,
  signature: string,
  secret: string,
  algorithm: 'SHA-256' | 'SHA-1' | 'SHA-512' = 'SHA-256',
): Promise<boolean> {
  if (!rawBody || !signature || !secret) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign', 'verify'],
  );

  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const hashArray = Array.from(new Uint8Array(signed));
  const computedHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  // Constant-time string comparison to defeat timing attacks
  if (computedHex.length !== signature.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < computedHex.length; i++) {
    mismatch |= computedHex.charCodeAt(i) ^ signature.charCodeAt(i);
  }

  return mismatch === 0;
}

export async function processAffiliateWebhook(
  db: MockD1Database,
  network: AffiliateNetwork,
  rawBody: string,
  signatureHeader: string,
  secret: string,
  nowMs = Date.now(),
): Promise<WebhookProcessingResult> {
  const isValid = await verifyAffiliateHmac(rawBody, signatureHeader, secret, 'SHA-256');
  if (!isValid) {
    return {
      success: false,
      error: 'INVALID_HMAC_SIGNATURE',
    };
  }

  let payload: {
    conversionId?: string;
    affiliateId?: string;
    subId?: string;
    orderValueCents?: number;
    commissionCents?: number;
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return {
      success: false,
      error: 'MALFORMED_JSON_PAYLOAD',
    };
  }

  const conversionId =
    payload.conversionId ?? `conv_${network}_${Math.random().toString(36).substring(2, 9)}`;
  const affiliateId = payload.affiliateId ?? 'aff_default';
  const commissionCents = payload.commissionCents ?? 0;
  const orderValueCents = payload.orderValueCents ?? 0;

  if (commissionCents <= 0) {
    return {
      success: false,
      error: 'ZERO_OR_NEGATIVE_COMMISSION',
    };
  }

  // 14-day hold: payable_at = attributed_at + 14 * 86400 * 1000
  const holdMs = 14 * 86400 * 1000;
  const payableAt = nowMs + holdMs;
  const ledgerId = `com_${conversionId}`;

  await db
    .prepare(
      `INSERT INTO commission_ledger (
        id, affiliate_id, network, external_conversion_id, sub_id,
        order_value_cents, commission_cents, status, hold_days,
        attributed_at, payable_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      ledgerId,
      affiliateId,
      network,
      conversionId,
      payload.subId ?? null,
      orderValueCents,
      commissionCents,
      'pending',
      14,
      nowMs,
      payableAt,
      nowMs,
    )
    .run();

  return {
    success: true,
    conversionId,
    affiliateId,
    commissionCents,
    payableAt,
    network,
  };
}

// ─── Feature 9: 14-Day Anti-Fraud Clawback Hold & Dual-Entry Ledger ────────────

export async function flipPendingToPayable(
  db: MockD1Database,
  nowTimestampMs: number,
): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE commission_ledger
       SET status = 'payable'
       WHERE status = 'pending' AND payable_at <= ?`,
    )
    .bind(nowTimestampMs)
    .run();

  return result.meta.changes;
}

export async function recordClawbackAdjustment(
  db: MockD1Database,
  parentConversionId: string,
  refundCents: number,
  nowMs = Date.now(),
): Promise<LedgerAdjustmentResult> {
  const original = await db
    .prepare('SELECT * FROM commission_ledger WHERE external_conversion_id = ?')
    .bind(parentConversionId)
    .first<{
      id: string;
      affiliate_id: string;
      network: string;
      commission_cents: number;
    }>();

  if (!original) {
    return {
      success: false,
      amountCents: 0,
      status: 'clawback',
      parentConversionId,
      error: 'CONVERSION_NOT_FOUND',
    };
  }

  // Negative adjustment row invariant: NEVER mutate historical record
  const negativeCents = -Math.abs(refundCents);
  const adjustmentId = `adj_${Math.random().toString(36).substring(2, 9)}_${nowMs}`;

  await db
    .prepare(
      `INSERT INTO commission_ledger (
        id, affiliate_id, network, external_conversion_id,
        commission_cents, status, hold_days, attributed_at, payable_at, parent_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      adjustmentId,
      original.affiliate_id,
      original.network,
      `claw_${parentConversionId}`,
      negativeCents,
      'clawback',
      0,
      nowMs,
      nowMs,
      original.id,
      nowMs,
    )
    .run();

  return {
    success: true,
    adjustmentId,
    amountCents: negativeCents,
    status: 'clawback',
    parentConversionId,
  };
}

export async function getNetAffiliateBalance(
  db: MockD1Database,
  affiliateId: string,
): Promise<number> {
  const res = await db
    .prepare(
      `SELECT SUM(commission_cents) as net_cents
       FROM commission_ledger
       WHERE affiliate_id = ?`,
    )
    .bind(affiliateId)
    .first<{ net_cents: number | null }>();

  return res?.net_cents ?? 0;
}

// ─── Feature 10: NOWPayments USDT Mass Payouts & Daily Financial Reconciliation ──

export async function processPayoutBatch(
  db: MockD1Database,
  rail: 'nowpayments_usdt' | 'stripe_connect',
  nowMs = Date.now(),
): Promise<PayoutBatchResult> {
  const batchId = `batch_${rail}_${nowMs}`;

  // Claim payable rows via CAS:
  // UPDATE commission_ledger SET status = 'paying', payout_batch_id = ? WHERE status = 'payable' AND payout_batch_id IS NULL
  const payableRows = await db
    .prepare(
      `SELECT id, affiliate_id, commission_cents
       FROM commission_ledger
       WHERE status = 'payable' AND payout_batch_id IS NULL`,
    )
    .all<{ id: string; affiliate_id: string; commission_cents: number }>();

  if (payableRows.results.length === 0) {
    return {
      success: true,
      batchId,
      totalAmountCents: 0,
      recipientCount: 0,
      claimedRowIds: [],
    };
  }

  // Minimum threshold: $1.00 (100 cents)
  const claimedRowIds: string[] = [];
  let totalAmountCents = 0;
  const uniqueRecipients = new Set<string>();

  for (const row of payableRows.results) {
    if (row.commission_cents >= 100) {
      claimedRowIds.push(row.id);
      totalAmountCents += row.commission_cents;
      uniqueRecipients.add(row.affiliate_id);

      await db
        .prepare(
          `UPDATE commission_ledger
           SET status = 'paying', payout_batch_id = ?
           WHERE id = ? AND status = 'payable' AND payout_batch_id IS NULL`,
        )
        .bind(batchId, row.id)
        .run();
    }
  }

  await db
    .prepare(
      `INSERT INTO payout_batches (
        id, rail, total_amount_cents, recipient_count, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(batchId, rail, totalAmountCents, uniqueRecipients.size, 'processing', nowMs)
    .run();

  return {
    success: true,
    batchId,
    totalAmountCents,
    recipientCount: uniqueRecipients.size,
    claimedRowIds,
  };
}

export async function reconcileDailyFinancials(
  db: MockD1Database,
  batchId: string,
  externalConfirmedCents: number,
  nowMs = Date.now(),
): Promise<ReconciliationResult> {
  const batch = await db
    .prepare('SELECT * FROM payout_batches WHERE id = ?')
    .bind(batchId)
    .first<{ total_amount_cents: number }>();

  const ledgerClaimedCents = batch?.total_amount_cents ?? 0;
  const diffCents = Math.abs(ledgerClaimedCents - externalConfirmedCents);
  const isReconciled = diffCents <= 100; // <= $1.00 tolerance
  const alertRequired = diffCents > 100;

  if (isReconciled) {
    await db
      .prepare('UPDATE payout_batches SET status = ?, confirmed_at = ? WHERE id = ?')
      .bind('confirmed', nowMs, batchId)
      .run();
  } else {
    await db
      .prepare('UPDATE payout_batches SET status = ? WHERE id = ?')
      .bind('reconciliation_failed', batchId)
      .run();
  }

  return {
    batchId,
    ledgerClaimedCents,
    externalConfirmedCents,
    diffCents,
    isReconciled,
    alertRequired,
  };
}

// ─── Feature 11: Mekong Cloudflare Tunnel & Hybrid Edge Router ────────────────

export async function routeInferenceTask(
  task: InferenceTask,
  db: MockD1Database,
  preferredNodeId?: string,
  nowMs = Date.now(),
): Promise<InferenceResult> {
  let targetNode: { id: string; status: string; tunnel_url: string; bearer_token: string } | undefined;

  if (preferredNodeId) {
    targetNode = await db
      .prepare('SELECT id, status, tunnel_url, bearer_token FROM edge_nodes WHERE id = ?')
      .bind(preferredNodeId)
      .first<{ id: string; status: string; tunnel_url: string; bearer_token: string }>();
  } else {
    targetNode = await db
      .prepare("SELECT id, status, tunnel_url, bearer_token FROM edge_nodes WHERE status = 'ONLINE' LIMIT 1")
      .first<{ id: string; status: string; tunnel_url: string; bearer_token: string }>();
  }

  // Routing policy: If node is ONLINE, route via tunnel (unmetered Apple Silicon)
  if (targetNode && targetNode.status === 'ONLINE') {
    return {
      taskId: task.taskId,
      provider: 'mekong_m1_max',
      costKind: 'unmetered',
      output: `[Mekong Local Edge] Generated output for: ${task.prompt.substring(0, 30)}...`,
      latencyMs: 120,
      encrypted: true,
    };
  }

  // Transparent fallback to Cloud BYOK provider
  return {
    taskId: task.taskId,
    provider: 'cloud_byok',
    costKind: 'metered',
    output: `[Cloud BYOK Fallback] Generated output for: ${task.prompt.substring(0, 30)}...`,
    latencyMs: 650,
    encrypted: true,
  };
}

// ─── Feature 12: 15-Second Edge Node Health & Failover ─────────────────────────

export async function probeEdgeNode(
  nodeUrl: string,
  bearerToken: string,
  timeoutMs = 2500,
): Promise<NodeHealthStatus> {
  // Opaque probe logic: checks endpoint URL format and token
  if (!nodeUrl || !bearerToken || timeoutMs < 500) {
    return {
      nodeId: 'unknown',
      status: 'OFFLINE',
      latencyMs: 0,
      reachable: false,
      lastCheckedAt: Date.now(),
    };
  }

  const isMockUnreachable = nodeUrl.includes('offline') || nodeUrl.includes('unreachable');
  if (isMockUnreachable) {
    return {
      nodeId: nodeUrl,
      status: 'OFFLINE',
      latencyMs: timeoutMs,
      reachable: false,
      lastCheckedAt: Date.now(),
    };
  }

  return {
    nodeId: nodeUrl,
    status: 'ONLINE',
    latencyMs: 18.5,
    reachable: true,
    lastCheckedAt: Date.now(),
  };
}

export async function checkClusterHealth(
  db: MockD1Database,
  nowMs = Date.now(),
  thresholdSeconds = 15,
): Promise<{
  totalNodes: number;
  onlineCount: number;
  offlineCount: number;
  transitionsToOffline: string[];
}> {
  const thresholdMs = thresholdSeconds * 1000;
  const nodes = await db
    .prepare('SELECT id, status, last_heartbeat_at FROM edge_nodes')
    .all<{ id: string; status: string; last_heartbeat_at: number }>();

  let onlineCount = 0;
  let offlineCount = 0;
  const transitionsToOffline: string[] = [];

  for (const node of nodes.results) {
    const isStale = nowMs - node.last_heartbeat_at > thresholdMs;
    if (isStale && node.status === 'ONLINE') {
      // Transition to OFFLINE
      await db
        .prepare("UPDATE edge_nodes SET status = 'OFFLINE' WHERE id = ?")
        .bind(node.id)
        .run();
      transitionsToOffline.push(node.id);
      offlineCount++;
    } else if (node.status === 'ONLINE') {
      onlineCount++;
    } else {
      offlineCount++;
    }
  }

  return {
    totalNodes: nodes.results.length,
    onlineCount,
    offlineCount,
    transitionsToOffline,
  };
}
