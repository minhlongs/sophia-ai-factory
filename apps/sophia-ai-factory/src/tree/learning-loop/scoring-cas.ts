/**
 * Optimistic Concurrency Control (OCC) CAS Engine — Phase 5: Auto-Creative Playbook
 *
 * Atomic Compare-And-Swap (CAS) state updates on `playbook_patterns` and
 * mission lifecycle transitions (`completed` -> `learning` -> `iterating`).
 *
 * Layer: tree (domain reusable — only imports from @/seed)
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  isCertificationBlocking,
  resolveCertifiedProvider,
} from '@/seed/ai/provider-certification';
import type {
  VideoEngagementFeedback,
  PatternUpdateResult,
  PatternUpdateDetail,
} from '@/seed/types/creative-intelligence';
import {
  computeLogarithmicConfidence,
  determineConfidenceLevel,
} from './effectiveness-scorer';
import type {
  CASUpdateResult,
  CreativeMissionStatus,
  PatternScoreUpdates,
} from './types';

/** Error thrown on lifecycle or concurrency validation failures */
export class LearningLoopError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'LearningLoopError';
    this.code = code;
  }
}

/** Canonical mission lifecycle transitions */
export const ALLOWED_LIFECYCLE_TRANSITIONS: Record<CreativeMissionStatus, readonly CreativeMissionStatus[]> = {
  draft: ['planned', 'cancelled'],
  planned: ['approval_required', 'cancelled'],
  approval_required: ['running', 'cancelled'],
  running: ['paused', 'review', 'completed', 'failed', 'cancelled'],
  paused: ['running', 'review', 'failed', 'cancelled'],
  review: ['completed', 'iterating', 'failed', 'cancelled'],
  completed: ['learning'],
  learning: ['iterating'],
  iterating: ['draft', 'planned', 'running', 'cancelled'],
  failed: ['draft', 'planned', 'running'],
  cancelled: ['draft'],
};

/**
 * Validate whether a mission status transition is legally permitted.
 */
export function canMissionTransition(from: CreativeMissionStatus, to: CreativeMissionStatus): boolean {
  const allowed = ALLOWED_LIFECYCLE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Perform an atomic OCC Compare-And-Swap update on a playbook pattern score.
 * Verifies that the row's `detected_at` matches `expectedDetectedAt` before applying updates.
 *
 * @param patternId           ID of the playbook_pattern record
 * @param expectedDetectedAt Expected timestamp before update
 * @param updates             New metric, sample, and confidence values
 * @param maxRetries          Maximum retry attempts on concurrent collision (default 3)
 * @param d1Override          Optional D1 binding for testing
 */
export async function updatePatternScoreCAS(
  patternId: string,
  expectedDetectedAt: number,
  updates: PatternScoreUpdates,
  maxRetries = 5,
  d1Override?: D1Database,
): Promise<CASUpdateResult> {
  const db = d1Override !== undefined ? d1Override : await getD1();
  if (!db) {
    return { success: false, changes: 0, retries: 0, error: 'D1_UNAVAILABLE' };
  }

  const safeAvg = Number.isFinite(updates.avgMetric) ? updates.avgMetric : 0;
  const safeN = Number.isFinite(updates.sampleSize) ? updates.sampleSize : 0;
  const safeConf = Number.isFinite(updates.confidence) ? updates.confidence : 0;

  let currentExpected = expectedDetectedAt;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const now = Math.max(Date.now(), currentExpected + 1);

    const result = await db
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
        safeAvg,
        safeN,
        safeConf,
        updates.confidenceLevel,
        now,
        patternId,
        currentExpected,
      )
      .run();

    if (result.meta.changes > 0) {
      return {
        success: true,
        changes: result.meta.changes,
        retries: attempt,
      };
    }

    // Row modified concurrently or timestamp changed
    if (attempt < maxRetries) {
      // Full-jitter exponential backoff between retry attempts
      const baseJitter = 25 * Math.pow(2, attempt) + 10;
      const jitterMs = Math.floor(Math.random() * Math.min(500, baseJitter));
      await new Promise((resolve) => setTimeout(resolve, jitterMs));

      const refreshed = await db
        .prepare('/* SELECT detected_at FROM playbook_patterns */ SELECT avg_metric, sample_size, detected_at FROM playbook_patterns WHERE id = ?')
        .bind(patternId)
        .first<{ detected_at: number; avg_metric?: number; sample_size?: number }>();

      if (!refreshed) {
        return {
          success: false,
          changes: 0,
          retries: attempt,
          error: 'PATTERN_NOT_FOUND',
        };
      }

      currentExpected = refreshed.detected_at;
    }
  }

  logger.warn('[ScoringCAS] Pattern score CAS update failed after max retries', {
    patternId,
    maxRetries,
  });

  return {
    success: false,
    changes: 0,
    retries: maxRetries,
    error: 'CONCURRENT_MODIFICATION',
  };
}

/**
 * Atomically transition a creative mission's lifecycle state via OCC CAS.
 * Asserts that changes > 0; throws `CONCURRENT_MODIFICATION` if row was altered concurrently.
 */
export async function transitionMissionLifecycleCAS(
  missionId: string,
  expectedStatus: CreativeMissionStatus,
  newStatus: CreativeMissionStatus,
  currentPhase = 'learning_loop',
  d1Override?: D1Database,
): Promise<void> {
  if (!canMissionTransition(expectedStatus, newStatus)) {
    throw new LearningLoopError(
      'INVALID_STATUS_TRANSITION',
      `Cannot transition mission ${missionId} from '${expectedStatus}' to '${newStatus}'`,
    );
  }

  const db = d1Override !== undefined ? d1Override : await getD1();
  if (!db) {
    throw new LearningLoopError('D1_UNAVAILABLE', 'D1 database binding unavailable');
  }

  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .prepare(
      `UPDATE creative_missions
       SET status = ?, current_phase = ?, updated_at = ?
       WHERE id = ? AND status = ?`,
    )
    .bind(newStatus, currentPhase, now, missionId, expectedStatus)
    .run();

  if (result.meta.changes === 0) {
    throw new LearningLoopError(
      'CONCURRENT_MODIFICATION',
      `Mission ${missionId} status changed concurrently (expected: ${expectedStatus})`,
    );
  }
}

/**
 * Advance mission lifecycle from completed to learning stage.
 */
export async function transitionMissionToLearningCAS(
  missionId: string,
  d1Override?: D1Database,
): Promise<void> {
  await transitionMissionLifecycleCAS(
    missionId,
    'completed',
    'learning',
    'learning_loop_analyzing',
    d1Override,
  );
}

/**
 * Advance mission lifecycle from learning to iterating stage.
 */
export async function transitionMissionToIteratingCAS(
  missionId: string,
  d1Override?: D1Database,
): Promise<void> {
  await transitionMissionLifecycleCAS(
    missionId,
    'learning',
    'iterating',
    'ready_for_iteration',
    d1Override,
  );
}

// ── Continuous Viral Feedback Loop & Atomic Ingestion ─────────────────────────

function safeNonNegative(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  return fallback;
}

/**
 * Calculates normalized Creative Effectiveness Score (CES) from video engagement signals.
 *
 * Formula:
 *   CES = (0.35 * R + 0.30 * S + 0.20 * E + 0.15 * C) * 100
 *
 * Where:
 *   - R (Retention / Completion Rate): weight 35%
 *   - S (Viral Amplification / Share Rate): weight 30% (3% share rate = 1.0)
 *   - E (Engagement Depth / Likes + Comments): weight 20%
 *   - C (Commercial Conversion / CTR): weight 15%
 *
 * All inputs are strictly sanitized against NaN, Infinity, -Infinity, null, and undefined.
 */
function calculateRetentionScore(feedback: VideoEngagementFeedback): number {
  if (typeof feedback.completionRate === 'number' && Number.isFinite(feedback.completionRate)) {
    return Math.max(0, Math.min(1, feedback.completionRate));
  }
  if (typeof feedback.metrics?.completionRate === 'number' && Number.isFinite(feedback.metrics.completionRate)) {
    return Math.max(0, Math.min(1, feedback.metrics.completionRate));
  }
  const watchTime = safeNonNegative(feedback.watchTimeSeconds ?? feedback.metrics?.watchTimeSeconds);
  const duration = safeNonNegative(feedback.totalDurationSeconds ?? feedback.durationSeconds);
  if (duration > 0 && watchTime > 0) {
    const rawRatio = watchTime / duration;
    return Number.isFinite(rawRatio) ? Math.max(0, Math.min(1, rawRatio)) : 0;
  }
  return 0;
}

function calculateSharesScore(feedback: VideoEngagementFeedback, views: number): number {
  const shares = safeNonNegative(feedback.shares ?? feedback.metrics?.shares);
  const rawS = (shares / views) * 33.33;
  return Number.isFinite(rawS) ? Math.max(0, Math.min(1.0, rawS)) : 0;
}

function calculateEngagementDepthScore(feedback: VideoEngagementFeedback, views: number): number {
  const likes = safeNonNegative(feedback.likes);
  const comments = safeNonNegative(feedback.comments);
  const rawE = ((likes + 2 * comments) / views) * 10.0;
  return Number.isFinite(rawE) ? Math.max(0, Math.min(1.0, rawE)) : 0;
}

function calculateCommercialConversionScore(feedback: VideoEngagementFeedback, views: number): number {
  const rawImpressions = safeNonNegative(feedback.impressions);
  const impressions = Math.max(rawImpressions > 0 ? rawImpressions : views, 1);
  const clicks = safeNonNegative(feedback.clicks);
  const conversions = safeNonNegative(feedback.conversions);
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const convRate = clicks > 0 ? conversions / clicks : 0;
  const rawC = 0.6 * (ctr * 10.0) + 0.4 * (convRate * 5.0);
  return Number.isFinite(rawC) ? Math.max(0, Math.min(1.0, rawC)) : 0;
}

export function calculateViralCES(feedback: VideoEngagementFeedback): number {
  const rawViews = safeNonNegative(feedback.views ?? feedback.metrics?.views);
  const views = Math.max(rawViews, 1);

  const R = calculateRetentionScore(feedback);
  const S = calculateSharesScore(feedback, views);
  const E = calculateEngagementDepthScore(feedback, views);
  const C = calculateCommercialConversionScore(feedback, views);

  const rawCes = (0.35 * R + 0.30 * S + 0.20 * E + 0.15 * C) * 100;
  if (!Number.isFinite(rawCes)) {
    return 0;
  }
  return Math.round(Math.min(100, Math.max(0, rawCes)) * 100) / 100;
}

function durationToBucket(seconds?: number): string {
  if (!seconds || seconds <= 0) return '31-60s';
  if (seconds <= 15) return '0-15s';
  if (seconds <= 30) return '16-30s';
  if (seconds <= 60) return '31-60s';
  if (seconds <= 90) return '61-90s';
  return '90s+';
}

function checkAndLogProviderFallback(feedback: VideoEngagementFeedback) {
  isCertificationBlocking('hermes');
  const providerResolution = resolveCertifiedProvider('hermes', ['openrouter', 'anthropic']);
  if (providerResolution.diverted) {
    logger.warn('[ScoringCAS] Hermes text provider blocked by certification gate — actively diverted text reasoning to certified provider', {
      videoId: feedback.videoId,
      originalProvider: providerResolution.originalProvider,
      divertedProvider: providerResolution.provider,
      reason: providerResolution.reason,
    });
  }
  return providerResolution;
}

function resolveFeatureDimensions(feedback: VideoEngagementFeedback): Array<{ key: string; value: string }> {
  const targetDimensions: Array<{ key: string; value: string }> = [];

  const hookVal = feedback.hookStyle ?? feedback.features?.hookStyle;
  if (hookVal) {
    targetDimensions.push({ key: 'hook_style', value: hookVal });
  }

  const voiceVal = feedback.voiceStyle ?? feedback.features?.voiceProfile;
  if (voiceVal) {
    targetDimensions.push({ key: 'voice_style', value: voiceVal });
  }

  const durationVal =
    feedback.features?.durationPattern ??
    durationToBucket(feedback.durationSeconds ?? feedback.totalDurationSeconds);
  if (durationVal) {
    targetDimensions.push({ key: 'duration', value: durationVal });
  }

  const channelVal = feedback.platform ?? feedback.features?.channel;
  if (channelVal) {
    targetDimensions.push({ key: 'channel', value: channelVal });
  }

  if (targetDimensions.length === 0) {
    targetDimensions.push({ key: 'hook_style', value: 'curiosity_gap' });
  }

  return targetDimensions;
}

async function insertColdPatterns(
  db: D1Database,
  workspaceId: string,
  dimensions: Array<{ key: string; value: string }>,
  cesScore: number,
): Promise<void> {
  const now = Date.now();
  for (const dim of dimensions) {
    const patternId = `pat_${workspaceId}_${dim.key}_${dim.value}`.replace(/[^\w]/g, '_');
    try {
      await db
        .prepare(
          `INSERT INTO playbook_patterns (
            id, workspace_id, feature_key, feature_value, metric,
            avg_metric, sample_size, confidence, confidence_level, source, detected_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'low', 'mission', ?, ?)
          ON CONFLICT(workspace_id, feature_key, feature_value, metric) DO NOTHING`,
        )
        .bind(patternId, workspaceId, dim.key, dim.value, 'ces', cesScore, now, now)
        .run();
    } catch (err) {
      logger.warn('[ScoringCAS] Failed cold insert for pattern', {
        workspaceId,
        featureKey: dim.key,
        featureValue: dim.value,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

interface PlaybookPatternCandidateRow {
  id: string;
  workspace_id: string;
  feature_key: string;
  feature_value: string;
  metric: string;
  avg_metric: number;
  sample_size: number;
  confidence: number;
  confidence_level: 'high' | 'medium' | 'low';
  detected_at: number;
}

async function fetchCandidatePatterns(
  db: D1Database,
  workspaceId: string,
  dimensions: Array<{ key: string; value: string }>,
): Promise<PlaybookPatternCandidateRow[]> {
  const placeholders = dimensions
    .map(() => '(feature_key = ? AND feature_value = ?)')
    .join(' OR ');
  const bindArgs: unknown[] = [workspaceId];
  for (const dim of dimensions) {
    bindArgs.push(dim.key, dim.value);
  }

  const queryRes = await db
    .prepare(
      `SELECT id, workspace_id, feature_key, feature_value, metric, avg_metric, sample_size, confidence, confidence_level, detected_at
       FROM playbook_patterns
       WHERE workspace_id = ? AND metric = 'ces' AND (${placeholders})`,
    )
    .bind(...bindArgs)
    .all<PlaybookPatternCandidateRow>();

  const candidatePatterns = queryRes.results ?? [];
  candidatePatterns.sort((a, b) => a.id.localeCompare(b.id));
  return candidatePatterns;
}

function computeUpdatedAverages(currentAvg: number, currentN: number, cesScore: number) {
  const newN = currentN + 1;
  let newAvg: number;
  if (currentN < 10) {
    newAvg = (currentAvg * currentN + cesScore) / newN;
  } else {
    newAvg = 0.4 * cesScore + 0.6 * currentAvg;
  }
  if (!Number.isFinite(newAvg)) {
    newAvg = cesScore;
  }
  const safeNewAvg = Math.round(Math.min(100, Math.max(0, newAvg)) * 100) / 100;
  const newConfidence = computeLogarithmicConfidence(newN);
  const newConfidenceLevel = determineConfidenceLevel(newConfidence);

  return { newN, safeNewAvg, newConfidence, newConfidenceLevel };
}

async function refreshPatternAfterCollision(
  db: D1Database,
  patternId: string,
  attempt: number,
): Promise<{ nextN?: number; nextAvg?: number; nextDetectedAt?: number } | null> {
  const baseJitter = 25 * Math.pow(2, attempt) + 10;
  const jitterMs = Math.floor(Math.random() * Math.min(500, baseJitter));
  await new Promise((resolve) => setTimeout(resolve, jitterMs));

  const latestRow = await db
    .prepare(
      `SELECT avg_metric, sample_size, detected_at
       FROM playbook_patterns
       WHERE id = ?`,
    )
    .bind(patternId)
    .first<{ avg_metric?: number; sample_size?: number; detected_at: number }>();

  if (!latestRow) {
    logger.warn('[ScoringCAS] Pattern row deleted during OCC CAS retry', {
      patternId,
    });
    return null;
  }

  const nextN = typeof latestRow.sample_size === 'number' && Number.isFinite(latestRow.sample_size)
    ? latestRow.sample_size
    : undefined;
  const nextAvg = typeof latestRow.avg_metric === 'number' && Number.isFinite(latestRow.avg_metric)
    ? latestRow.avg_metric
    : undefined;

  return { nextN, nextAvg, nextDetectedAt: latestRow.detected_at };
}

function applyRefreshedRow(
  state: { currentN: number; currentAvg: number; currentDetectedAt: number },
  refreshed: { nextN?: number; nextAvg?: number; nextDetectedAt?: number },
) {
  if (refreshed.nextN !== undefined) state.currentN = refreshed.nextN;
  if (refreshed.nextAvg !== undefined) state.currentAvg = refreshed.nextAvg;
  if (refreshed.nextDetectedAt !== undefined) state.currentDetectedAt = refreshed.nextDetectedAt;
}

async function executePatternDbUpdate(
  db: D1Database,
  patternId: string,
  currentDetectedAt: number,
  avgData: ReturnType<typeof computeUpdatedAverages>,
): Promise<boolean> {
  const nowTimestamp = Math.max(Date.now(), currentDetectedAt + 1);
  const result = await db
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
      avgData.safeNewAvg,
      avgData.newN,
      avgData.newConfidence,
      avgData.newConfidenceLevel,
      nowTimestamp,
      patternId,
      currentDetectedAt,
    )
    .run();
  return result.meta.changes > 0;
}

async function updateSinglePatternCAS(
  db: D1Database,
  pattern: PlaybookPatternCandidateRow,
  cesScore: number,
  maxRetries: number,
): Promise<PatternUpdateDetail> {
  const state = {
    currentAvg: Number.isFinite(pattern.avg_metric) ? pattern.avg_metric : cesScore,
    currentN: Number.isFinite(pattern.sample_size) && pattern.sample_size >= 0 ? pattern.sample_size : 0,
    currentDetectedAt: pattern.detected_at,
  };
  let success = false;
  let attemptsTaken = 0;
  let finalNewAvg = state.currentAvg;
  let finalNewN = state.currentN;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attemptsTaken = attempt;
    const avgData = computeUpdatedAverages(state.currentAvg, state.currentN, cesScore);
    finalNewAvg = avgData.safeNewAvg;
    finalNewN = avgData.newN;

    const updated = await executePatternDbUpdate(db, pattern.id, state.currentDetectedAt, avgData);
    if (updated) {
      success = true;
      break;
    }

    if (attempt >= maxRetries) break;

    const refreshed = await refreshPatternAfterCollision(db, pattern.id, attempt);
    if (!refreshed) break;
    applyRefreshedRow(state, refreshed);
  }

  return {
    patternId: pattern.id,
    featureKey: pattern.feature_key,
    featureValue: pattern.feature_value,
    previousAvg: pattern.avg_metric,
    newAvg: finalNewAvg,
    sampleSize: finalNewN,
    retries: attemptsTaken,
    status: success ? 'updated' : 'conflict_exhausted',
  };
}

/**
 * Ingests published video engagement feedback, recalculates Creative Effectiveness
 * Scores (CES), and applies atomic OCC CAS updates on matching `playbook_patterns` rows.
 */
export async function ingestEngagementFeedback(
  db: D1Database,
  feedback: VideoEngagementFeedback,
  maxRetries = 5,
): Promise<PatternUpdateResult> {
  const providerResolution = checkAndLogProviderFallback(feedback);
  const workspaceId = feedback.workspaceId ?? 'ws_default';
  const rawCes = calculateViralCES(feedback);
  const cesScore = Number.isFinite(rawCes) ? Math.max(0, Math.min(100, rawCes)) : 0;

  const targetDimensions = resolveFeatureDimensions(feedback);
  await insertColdPatterns(db, workspaceId, targetDimensions, cesScore);
  const candidatePatterns = await fetchCandidatePatterns(db, workspaceId, targetDimensions);

  const updatedPatterns: PatternUpdateDetail[] = [];
  for (const pattern of candidatePatterns) {
    const detail = await updateSinglePatternCAS(db, pattern, cesScore, maxRetries);
    updatedPatterns.push(detail);
  }

  const primaryPattern = updatedPatterns[0];
  const overallConfidence =
    candidatePatterns.length > 0
      ? candidatePatterns.reduce((acc, p) => acc + p.confidence, 0) / candidatePatterns.length
      : 0;

  return {
    videoId: feedback.videoId,
    patternId: primaryPattern?.patternId,
    previousScore: primaryPattern?.previousAvg,
    newScore: primaryPattern?.newAvg,
    cesScore,
    sampleCount: primaryPattern?.sampleSize,
    sampleSize: primaryPattern?.sampleSize,
    confidence: Math.round(overallConfidence * 100) / 100,
    confidenceLevel: determineConfidenceLevel(overallConfidence),
    updatedPatterns,
    casApplied: updatedPatterns.length > 0 && updatedPatterns.every((u) => u.status === 'updated'),
    updatedAt: Date.now(),
    resolvedProvider: providerResolution.provider,
    providerDiverted: providerResolution.diverted,
  };
}

export interface PromptOptimizeRequest {
  readonly originalPrompt: string;
  readonly hookStyle?: string;
  readonly targetNiche?: string;
  readonly feedbackScore?: number;
}

export interface CreativeReasoningRequest {
  readonly brief: string;
  readonly audience?: string;
  readonly winningPatterns?: readonly string[];
}

/**
 * Actively diverts a prompt optimization task from an uncertified provider (e.g. 'hermes')
 * to a certified provider ('openrouter' / 'anthropic').
 *
 * @param request Prompt optimization payload
 * @param preferredProvider Target provider (default: 'hermes')
 * @param fallbackCandidates Ordered fallbacks (default: ['openrouter', 'anthropic'])
 */
export function divertPromptOptimization(
  request: PromptOptimizeRequest,
  preferredProvider = 'hermes',
  fallbackCandidates: readonly string[] = ['openrouter', 'anthropic'],
): {
  readonly resolvedProvider: string;
  readonly diverted: boolean;
  readonly originalProvider: string;
  readonly request: PromptOptimizeRequest;
} {
  const resolution = resolveCertifiedProvider(preferredProvider, fallbackCandidates);
  return {
    resolvedProvider: resolution.provider,
    diverted: resolution.diverted,
    originalProvider: resolution.originalProvider,
    request,
  };
}

/**
 * Actively diverts a creative reasoning task from an uncertified provider (e.g. 'hermes')
 * to a certified provider ('openrouter' / 'anthropic').
 *
 * @param request Creative reasoning payload
 * @param preferredProvider Target provider (default: 'hermes')
 * @param fallbackCandidates Ordered fallbacks (default: ['openrouter', 'anthropic'])
 */
export function divertCreativeReasoning(
  request: CreativeReasoningRequest,
  preferredProvider = 'hermes',
  fallbackCandidates: readonly string[] = ['openrouter', 'anthropic'],
): {
  readonly resolvedProvider: string;
  readonly diverted: boolean;
  readonly originalProvider: string;
  readonly request: CreativeReasoningRequest;
} {
  const resolution = resolveCertifiedProvider(preferredProvider, fallbackCandidates);
  return {
    resolvedProvider: resolution.provider,
    diverted: resolution.diverted,
    originalProvider: resolution.originalProvider,
    request,
  };
}

