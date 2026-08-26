#!/usr/bin/env node

/**
 * Backtest Performance Model v1 (heuristic)
 *
 * Replays historical performance_events per asset:
 *   - Score at T0 using events in [T0 - window, T0]
 *   - Compare actual top-quartile membership at T0+14d
 *   - Print precision (KPI target: >70% top-quartile)
 *
 * Usage:
 *   npx tsx scripts/backtest-performance-model.ts --help
 *   npx tsx scripts/backtest-performance-model.ts --workspace <id> --window-days 14 --horizon-days 14
 *   npx tsx scripts/backtest-performance-model.ts --fixture-path ./test-fixtures/performance.db
 */

import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createLogger } from '@/seed/utils/logger-utility';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = createLogger('scripts/backtest-performance-model');

// ─── Types ───────────────────────────────────────────────────────────────────

interface PerformanceEventRow {
  id: string;
  workspace_id: string;
  asset_id: string;
  project_id: string | null;
  entity_type: string;
  entity_id: string;
  channel: string | null;
  event_type: string;
  count: number;
  value_cents: number;
  metrics_json: string;
  recorded_at: number;
  created_at: number;
  raw_data: string | null;
}

interface AggregatedMetrics {
  assetId: string;
  workspaceId: string;
  channel: string;
  impressions: number;
  views: number;
  clicks: number;
  likes: number;
  shares: number;
  saves: number;
  follows: number;
  conversions: number;
  revenueEvents: number;
  totalEngagements: number;
  engagementRate: number;
  retention3s: number;
  retention30s: number;
  windowStart: number;
  windowEnd: number;
  eventCount: number;
}

interface ScoreResult {
  assetId: string;
  workspaceId: string;
  channel: string;
  score: number;
  predictedQuartile: 1 | 2 | 3 | 4;
  confidence: 'low' | 'medium' | 'high';
}

interface BacktestResult {
  assetId: string;
  t0: number;
  t0PlusHorizon: number;
  predictedQuartile: 1 | 2 | 3 | 4;
  actualQuartileAtT0PlusHorizon: 1 | 2 | 3 | 4 | null;
  predictedTopQuartile: boolean;
  actualTopQuartile: boolean;
  correct: boolean | null; // null if actual unknown
}

interface BacktestSummary {
  totalAssets: number;
  assetsWithFutureData: number;
  correctPredictions: number;
  precision: number; // correct / assetsWithFutureData
  byConfidence: Record<'low' | 'medium' | 'high', { total: number; correct: number; precision: number }>;
}

// ─── Config (matches DEFAULT_CONFIG from scoring.ts) ────────────────────────

interface ScorerConfig {
  weights: {
    engagementRate: number;
    velocity: number;
    retention: number;
  };
  velocitySaturation: number;
  engagementSaturation: number;
  minEventsThreshold: number;
  quartileBoundaries: [number, number, number];
}

const DEFAULT_CONFIG: ScorerConfig = {
  weights: {
    engagementRate: 0.4,
    velocity: 0.35,
    retention: 0.25,
  },
  velocitySaturation: 100,
  engagementSaturation: 0.15,
  minEventsThreshold: 5,
  quartileBoundaries: [0.25, 0.5, 0.75],
};

// ─── Pure scorer (duplicated from scoring.ts for script independence) ────────

function computeScore(metrics: AggregatedMetrics, config: ScorerConfig = DEFAULT_CONFIG): ScoreResult {
  // Engagement Rate
  const engagementDenominator = Math.max(metrics.views, metrics.impressions, 1);
  const rawEngagementRate = metrics.totalEngagements / engagementDenominator;
  const normalizedEngagement = Math.min(rawEngagementRate / config.engagementSaturation, 1.0);

  // Velocity
  const windowDays = Math.max(
    (metrics.windowEnd - metrics.windowStart) / (1000 * 60 * 60 * 24),
    1 / 24,
  );
  const rawVelocity = metrics.eventCount / windowDays;
  const normalizedVelocity = Math.min(rawVelocity / config.velocitySaturation, 1.0);

  // Retention
  const rawRetention =
    metrics.retention30s > 0
      ? metrics.retention30s
      : metrics.retention3s > 0
        ? metrics.retention3s
        : 0.5;
  const normalizedRetention = Math.max(0, Math.min(rawRetention, 1.0));

  // Composite
  const { weights } = config;
  const score =
    normalizedEngagement * weights.engagementRate +
    normalizedVelocity * weights.velocity +
    normalizedRetention * weights.retention;
  const clampedScore = Math.max(0, Math.min(score, 1.0));

  // Quartile
  const [q1, q2, q3] = config.quartileBoundaries;
  let predictedQuartile: 1 | 2 | 3 | 4;
  if (clampedScore < q1) predictedQuartile = 1;
  else if (clampedScore < q2) predictedQuartile = 2;
  else if (clampedScore < q3) predictedQuartile = 3;
  else predictedQuartile = 4;

  // Confidence
  const hasEngagementData = metrics.views > 0 || metrics.impressions > 0;
  const hasRetentionData = metrics.retention30s > 0 || metrics.retention3s > 0;
  const hasVelocityData = metrics.eventCount > 0;

  let confidence: 'low' | 'medium' | 'high';
  if (metrics.eventCount >= config.minEventsThreshold && hasEngagementData && hasVelocityData) {
    confidence = hasRetentionData ? 'high' : 'medium';
  } else if (metrics.eventCount >= 2 && hasVelocityData) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    assetId: metrics.assetId,
    workspaceId: metrics.workspaceId,
    channel: metrics.channel,
    score: clampedScore,
    predictedQuartile,
    confidence,
  };
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

function openDatabase(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  return db;
}

function loadEvents(
  db: DatabaseSync,
  workspaceId: string,
  startTime: number,
  endTime: number,
): PerformanceEventRow[] {
  const stmt = db.prepare(
    `SELECT * FROM performance_events
     WHERE workspace_id = ? AND recorded_at >= ? AND recorded_at <= ?
     ORDER BY recorded_at ASC`,
  );
  return stmt.all(workspaceId, startTime, endTime) as PerformanceEventRow[];
}

function getDistinctAssets(db: DatabaseSync, workspaceId: string): string[] {
  const stmt = db.prepare(
    `SELECT DISTINCT asset_id FROM performance_events WHERE workspace_id = ?`,
  );
  return (stmt.all(workspaceId) as { asset_id: string }[]).map((r) => r.asset_id);
}

function getTimeRange(db: DatabaseSync, workspaceId: string): { min: number; max: number } | null {
  const stmt = db.prepare(
    `SELECT MIN(recorded_at) as min, MAX(recorded_at) as max FROM performance_events WHERE workspace_id = ?`,
  );
  const row = stmt.get(workspaceId) as { min: number | null; max: number | null } | null;
  if (!row || row.min === null || row.max === null) return null;
  return { min: row.min, max: row.max };
}

function aggregateEventsForAsset(
  events: PerformanceEventRow[],
  assetId: string,
  windowStart: number,
  windowEnd: number,
): AggregatedMetrics | null {
  const assetEvents = events.filter(
    (e) => e.asset_id === assetId && e.recorded_at >= windowStart && e.recorded_at <= windowEnd,
  );

  if (assetEvents.length === 0) return null;

  let impressions = 0;
  let views = 0;
  let clicks = 0;
  let likes = 0;
  let shares = 0;
  let saves = 0;
  let follows = 0;
  let conversions = 0;
  let revenueEvents = 0;
  let retention3sSum = 0;
  let retention30sSum = 0;
  let retentionCount = 0;
  const channels = new Set<string>();

  for (const e of assetEvents) {
    channels.add(e.channel ?? 'unknown');
    const c = e.count;
    switch (e.event_type) {
      case 'impression':
        impressions += c;
        break;
      case 'view':
        views += c;
        break;
      case 'click':
        clicks += c;
        break;
      case 'like':
        likes += c;
        break;
      case 'share':
        shares += c;
        break;
      case 'save':
        saves += c;
        break;
      case 'follow':
        follows += c;
        break;
      case 'conversion':
        conversions += c;
        break;
      case 'revenue':
        revenueEvents += c;
        break;
    }
    try {
      const metrics = JSON.parse(e.metrics_json) as Record<string, unknown>;
      if (typeof metrics.retention3s === 'number') {
        retention3sSum += metrics.retention3s;
        retentionCount++;
      }
      if (typeof metrics.retention30s === 'number') {
        retention30sSum += metrics.retention30s;
        retentionCount++;
      }
    } catch {
      // ignore
    }
  }

  const totalEngagements = likes + shares + saves + follows;
  const engagementDenominator = Math.max(views, impressions, 1);

  const channel = channels.size === 1 ? channels.values().next().value! : 'mixed';

  return {
    assetId,
    workspaceId: assetEvents[0].workspace_id,
    channel,
    impressions,
    views,
    clicks,
    likes,
    shares,
    saves,
    follows,
    conversions,
    revenueEvents,
    totalEngagements,
    engagementRate: totalEngagements / engagementDenominator,
    retention3s: retentionCount > 0 ? retention3sSum / retentionCount : 0,
    retention30s: retentionCount > 0 ? retention30sSum / retentionCount : 0,
    windowStart,
    windowEnd,
    eventCount: assetEvents.length,
  };
}

function computeActualQuartileAtTime(
  db: DatabaseSync,
  workspaceId: string,
  assetId: string,
  targetTime: number,
  horizonDays: number,
): 1 | 2 | 3 | 4 | null {
  // Get events in [targetTime, targetTime + horizonDays]
  const horizonStart = targetTime;
  const horizonEnd = targetTime + horizonDays * 24 * 60 * 60 * 1000;

  const stmt = db.prepare(
    `SELECT * FROM performance_events
     WHERE workspace_id = ? AND asset_id = ? AND recorded_at >= ? AND recorded_at <= ?
     ORDER BY recorded_at ASC`,
  );
  const events = stmt.all(workspaceId, assetId, horizonStart, horizonEnd) as PerformanceEventRow[];

  if (events.length === 0) return null;

  // Compute a "future score" using same logic but on future window
  const metrics = aggregateEventsForAsset(events, assetId, horizonStart, horizonEnd);
  if (!metrics) return null;

  const scoreResult = computeScore(metrics);
  return scoreResult.predictedQuartile;
}

// ─── Main backtest ───────────────────────────────────────────────────────────

interface CliOptions {
  workspaceId: string;
  dbPath: string;
  windowDays: number;
  horizonDays: number;
  stepDays: number;
  minEventsAtT0: number;
  verbose: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    workspaceId: '',
    dbPath: '',
    windowDays: 14,
    horizonDays: 14,
    stepDays: 7,
    minEventsAtT0: 5,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      case '--workspace':
        options.workspaceId = args[++i];
        break;
      case '--db':
      case '--fixture-path':
        options.dbPath = args[++i];
        break;
      case '--window-days':
        options.windowDays = parseInt(args[++i], 10);
        break;
      case '--horizon-days':
        options.horizonDays = parseInt(args[++i], 10);
        break;
      case '--step-days':
        options.stepDays = parseInt(args[++i], 10);
        break;
      case '--min-events':
        options.minEventsAtT0 = parseInt(args[++i], 10);
        break;
      case '--verbose':
        options.verbose = true;
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        printHelp();
        process.exit(1);
    }
  }

  if (!options.workspaceId) {
    console.error('Error: --workspace is required');
    printHelp();
    process.exit(1);
  }

  if (!options.dbPath) {
    // Default to local D1 test database
    options.dbPath = resolve(__dirname, '../../.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  }

  return options;
}

function printHelp(): void {
  console.log(`
Backtest Performance Model v1 (heuristic)

Usage:
  npx tsx scripts/backtest-performance-model.ts --workspace <id> [options]

Options:
  --workspace <id>        Workspace ID to backtest (required)
  --db <path>             Path to SQLite database file (default: local wrangler D1)
  --window-days <n>       Observation window in days (default: 14)
  --horizon-days <n>      Prediction horizon in days (default: 14)
  --step-days <n>         Step between T0 samples in days (default: 7)
  --min-events <n>        Minimum events at T0 to score (default: 5)
  --verbose               Verbose output per asset
  --help, -h              Show this help

Example:
  npx tsx scripts/backtest-performance-model.ts --workspace ws_abc123 --db ./test.db --window-days 14 --horizon-days 14
`);
}

async function runBacktest(opts: CliOptions): Promise<BacktestSummary> {
  logger.info('Starting backtest', {
    workspaceId: opts.workspaceId,
    dbPath: opts.dbPath,
    windowDays: opts.windowDays,
    horizonDays: opts.horizonDays,
    stepDays: opts.stepDays,
  });

  const db = openDatabase(opts.dbPath);

  // Get time range
  const timeRange = getTimeRange(db, opts.workspaceId);
  if (!timeRange) {
    throw new Error(`No performance_events found for workspace ${opts.workspaceId}`);
  }

  const { min: earliestEvent, max: latestEvent } = timeRange;
  logger.info('Time range', {
    earliest: new Date(earliestEvent).toISOString(),
    latest: new Date(latestEvent).toISOString(),
  });

  // We need T0 + horizon <= latestEvent, so latest T0 = latestEvent - horizon
  const latestT0 = latestEvent - opts.horizonDays * 24 * 60 * 60 * 1000;
  const earliestT0 = earliestEvent + opts.windowDays * 24 * 60 * 60 * 1000;

  if (latestT0 <= earliestT0) {
    throw new Error('Insufficient time range for backtest (need at least window + horizon)');
  }

  const assets = getDistinctAssets(db, opts.workspaceId);
  logger.info(`Found ${assets.length} distinct assets`);

  const results: BacktestResult[] = [];

  // Generate T0 timestamps
  const stepMs = opts.stepDays * 24 * 60 * 60 * 1000;
  const windowMs = opts.windowDays * 24 * 60 * 60 * 1000;

  for (let t0 = earliestT0; t0 <= latestT0; t0 += stepMs) {
    const windowStart = t0 - windowMs;
    const windowEnd = t0;

    // Load all events in this window for this workspace
    const allEvents = loadEvents(db, opts.workspaceId, windowStart, windowEnd);

    for (const assetId of assets) {
      const metrics = aggregateEventsForAsset(allEvents, assetId, windowStart, windowEnd);
      if (!metrics) continue;

      // Skip if insufficient events at T0
      if (metrics.eventCount < opts.minEventsAtT0) continue;

      // Score at T0
      const scoreResult = computeScore(metrics);

      // Get actual quartile at T0+horizon
      const actualQuartile = computeActualQuartileAtTime(
        db,
        opts.workspaceId,
        assetId,
        t0,
        opts.horizonDays,
      );

      const predictedTopQuartile = scoreResult.predictedQuartile === 4;
      const actualTopQuartile = actualQuartile === 4;
      const correct = actualQuartile !== null ? predictedTopQuartile === actualTopQuartile : null;

      results.push({
        assetId,
        t0,
        t0PlusHorizon: t0 + opts.horizonDays * 24 * 60 * 60 * 1000,
        predictedQuartile: scoreResult.predictedQuartile,
        actualQuartileAtT0PlusHorizon: actualQuartile,
        predictedTopQuartile,
        actualTopQuartile,
        correct,
      });

      if (opts.verbose) {
        console.log(
          `  ${assetId} @ ${new Date(t0).toISOString().slice(0, 10)}: ` +
            `pred=Q${scoreResult.predictedQuartile} (score=${scoreResult.score.toFixed(3)}, conf=${scoreResult.confidence}) ` +
            `${actualQuartile !== null ? `actual=Q${actualQuartile} ${correct ? '✓' : '✗'}` : 'actual=N/A'}`,
        );
      }
    }
  }

  // Compute summary
  const assetsWithFutureData = results.filter((r) => r.correct !== null);
  const correctPredictions = results.filter((r) => r.correct === true).length;
  const precision = assetsWithFutureData.length > 0 ? correctPredictions / assetsWithFutureData.length : 0;

  const byConfidence: BacktestSummary['byConfidence'] = {
    low: { total: 0, correct: 0, precision: 0 },
    medium: { total: 0, correct: 0, precision: 0 },
    high: { total: 0, correct: 0, precision: 0 },
  };

  for (const r of assetsWithFutureData) {
    // We need confidence — recompute or track it
    // For simplicity, recompute from metrics at T0
    const metrics = aggregateEventsForAsset(
      loadEvents(db, opts.workspaceId, r.t0 - windowMs, r.t0),
      r.assetId,
      r.t0 - windowMs,
      r.t0,
    );
    if (metrics) {
      const conf = computeScore(metrics).confidence;
      byConfidence[conf].total++;
      if (r.correct) byConfidence[conf].correct++;
    }
  }

  for (const conf of ['low', 'medium', 'high'] as const) {
    const c = byConfidence[conf];
    c.precision = c.total > 0 ? c.correct / c.total : 0;
  }

  const summary: BacktestSummary = {
    totalAssets: results.length,
    assetsWithFutureData: assetsWithFutureData.length,
    correctPredictions,
    precision,
    byConfidence,
  };

  return summary;
}

function printSummary(summary: BacktestSummary): void {
  console.log('\n=== BACKTEST RESULTS ===');
  console.log(`Total scored assets:     ${summary.totalAssets}`);
  console.log(`Assets with future data: ${summary.assetsWithFutureData}`);
  console.log(`Correct predictions:     ${summary.correctPredictions}`);
  console.log(`Precision (top-quartile): ${(summary.precision * 100).toFixed(1)}%`);

  console.log('\n--- By Confidence ---');
  for (const conf of ['low', 'medium', 'high'] as const) {
    const c = summary.byConfidence[conf];
    console.log(
      `  ${conf.padEnd(6)}: ${c.total.toString().padStart(4)} assets, ${c.correct.toString().padStart(4)} correct, ${(c.precision * 100).toFixed(1).padStart(5)}% precision`,
    );
  }

  console.log('\n=== KPI CHECK ===');
  const kpiMet = summary.precision >= 0.7;
  console.log(`Target: >70% top-quartile precision`);
  console.log(`Actual: ${(summary.precision * 100).toFixed(1)}%`);
  console.log(kpiMet ? '✅ KPI MET' : '❌ KPI NOT MET (expected — heuristic v1)');

  if (!kpiMet) {
    console.log('\nNote: Heuristic v1 is expected to be below 70%. This is a gate decision point per roadmap R3.');
    console.log('Do NOT fake ML — ship with confidence: low flag and record gap in roadmap.');
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs();

  try {
    const summary = await runBacktest(opts);
    printSummary(summary);
    process.exit(0);
  } catch (err) {
    logger.error('Backtest failed', { error: err instanceof Error ? err.message : String(err) });
    console.error('Backtest failed:', err);
    process.exit(1);
  }
}

main();