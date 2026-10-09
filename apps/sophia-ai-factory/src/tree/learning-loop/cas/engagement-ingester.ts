/**
 * Optimistic Concurrency Control (OCC) CAS: Viral Feedback Ingestion Orchestrator.
 * Layer: tree (domain reusable)
 *
 * @module tree/learning-loop/cas/engagement-ingester
 */

import type {
  PatternUpdateDetail,
  PatternUpdateResult,
  VideoEngagementFeedback,
} from '@/seed/types/creative-intelligence';
import { determineConfidenceLevel } from '../effectiveness-scorer';
import { calculateViralCES } from './ces-scorer';
import { checkAndLogProviderFallback } from './provider-diversion';
import {
  fetchCandidatePatterns,
  insertColdPatterns,
  resolveFeatureDimensions,
} from './pattern-dimension-resolver';
import { updateSinglePatternCAS } from './pattern-pipeline-helpers';

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
