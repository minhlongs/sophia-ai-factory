/**
 * Optimistic Concurrency Control (OCC) CAS: Feature Dimensions & Pattern Discovery.
 * Layer: tree (domain reusable)
 *
 * @module tree/learning-loop/cas/pattern-dimension-resolver
 */

import { logger } from '@/seed/utils/logger-utility';
import type { VideoEngagementFeedback } from '@/seed/types/creative-intelligence';

export function durationToBucket(seconds?: number): string {
  if (!seconds || seconds <= 0) return '31-60s';
  if (seconds <= 15) return '0-15s';
  if (seconds <= 30) return '16-30s';
  if (seconds <= 60) return '31-60s';
  if (seconds <= 90) return '61-90s';
  return '90s+';
}

export function resolveFeatureDimensions(
  feedback: VideoEngagementFeedback,
): Array<{ key: string; value: string }> {
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

export async function insertColdPatterns(
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

export interface PlaybookPatternCandidateRow {
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

export async function fetchCandidatePatterns(
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
