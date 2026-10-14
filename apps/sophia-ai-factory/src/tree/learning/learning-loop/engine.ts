/**
 * Creative Learning Loop Execution Engine
 *
 * Layer: tree/learning
 */

import { getPerformanceEvents } from '@/tree/performance/events';
import {
  upsertMemory,
  getMemoryByCategory,
  recordLearning,
} from '@/tree/creative-memory/index';
import { getMissionMetrics } from '@/tree/mission/types';
import { success, failure, type Result } from '@/seed/types/result';
import type { CreativeMemory } from '@/seed/types/creative-domain';
import type { LearningLoopResult, LearningLoopError } from './types';
import { analyzePerformance, extractExperimentInsights } from './analysis';
import { generateRecommendations } from './recommendations';

/**
 * Run the full learning loop for a workspace + mission.
 *
 * Steps:
 * 1. Gather performance events and experiment results.
 * 2. Analyze → extract insights.
 * 3. Update CreativeMemory with evidence-backed insights.
 * 4. Generate recommendations for the next iteration.
 */
export async function runLearningLoop(
  workspaceId: string,
  missionId: string,
  experimentIds: string[] = [],
): Promise<Result<LearningLoopResult, LearningLoopError>> {
  try {
    const events = await getPerformanceEvents(workspaceId);
    const metrics = await getMissionMetrics(missionId);

    const perfInsights = analyzePerformance(events);
    const expInsights = await extractExperimentInsights(workspaceId, experimentIds);
    const insights = [...perfInsights, ...expInsights];

    let memoriesWritten = 0;
    for (const insight of insights) {
      try {
        await recordLearning(
          workspaceId,
          insight.category,
          insight.key,
          insight.value,
          insight.evidence,
          'mission',
          missionId,
        );
        memoriesWritten++;
      } catch {
        // Non-fatal: a single failed memory write shouldn't fail the loop
      }
    }

    const recommendations = generateRecommendations(insights, metrics);

    return success({
      insights,
      recommendations,
      memoriesWritten,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    return failure({ code: 'DB_UNAVAILABLE', message });
  }
}

/**
 * Get the latest creative memory for a workspace, grouped by category.
 */
export async function getLatestInsights(
  workspaceId: string,
  category?: CreativeMemory['category'],
): Promise<CreativeMemory[]> {
  return getMemoryByCategory(workspaceId, category ?? 'performance');
}

// ─── Re-exports ──────────────────────────────────────────────────────────────

export { upsertMemory, getMemoryByCategory, recordLearning };
