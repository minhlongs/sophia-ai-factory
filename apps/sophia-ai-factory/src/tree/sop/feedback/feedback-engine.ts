/**
 * Feedback Loop Coordinator
 * Layer: tree/sop
 */

import { getD1, type D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { FeedbackCycle } from '@/seed/types/performance-feedback';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import type { StepWithPrompt, LlmOptimizationSuggestion } from './types';
import { getPendingEvaluations, evaluatePerformance } from './feedback-cycles';
import { suggestOptimization, applyOptimization } from './prompt-optimizations';
import {
  fetchVideoMetrics,
  parseStepsFromTemplate,
  requestLlmOptimizations,
} from './llm-prompt-optimizer';

async function applyStepOptimizations(
  cycle: FeedbackCycle,
  stepsWithPrompts: StepWithPrompt[],
  optimizations: LlmOptimizationSuggestion[],
): Promise<void> {
  for (const opt of optimizations) {
    const original = stepsWithPrompts.find((s) => s.index === opt.step_index);
    if (!original || !opt.suggested_prompt) continue;

    const optId = await suggestOptimization({
      cycleId: cycle.id,
      sopId: cycle.sopId,
      stepIndex: opt.step_index,
      originalPrompt: original.prompt,
      suggestedPrompt: opt.suggested_prompt,
      improvementScore: 0.1,
    });
    await applyOptimization(optId);
  }
}

async function processSingleFeedbackCycle(cycle: FeedbackCycle, db: D1Database): Promise<void> {
  // 1. Fetch consolidated video metrics from video_analytics
  const { totalViews, metrics } = await fetchVideoMetrics(db, cycle.executionId);

  // 2. Perform evaluation and save to D1
  const evaluation = await evaluatePerformance(cycle.id, metrics);

  // 3. Perform LLM-driven prompt optimization
  const template = await db
    .prepare('SELECT steps_json FROM sop_templates WHERE id = ?1 LIMIT 1')
    .bind(cycle.sopId)
    .first<{ steps_json: string }>();

  if (!template) return;

  const stepsWithPrompts = parseStepsFromTemplate(template.steps_json);
  if (stepsWithPrompts.length === 0) return;

  const openRouterKey = await resolveUserApiKey(
    cycle.userId,
    'openrouter',
    process.env.OPENROUTER_API_KEY,
  );
  if (!openRouterKey) return;

  const optimizations = await requestLlmOptimizations({
    openRouterKey,
    cycleId: cycle.id,
    totalViews,
    metrics,
    evaluation,
    stepsWithPrompts,
  });

  if (optimizations.length > 0) {
    await applyStepOptimizations(cycle, stepsWithPrompts, optimizations);
  }
}

/**
 * Run evaluation and optimization for all pending feedback cycles.
 * Typically invoked by scheduled jobs after analytics synchronization.
 */
export async function runPerformanceFeedbackAndOptimization(): Promise<number> {
  const pending = await getPendingEvaluations();
  if (pending.length === 0) {
    logger.info('feedback_engine.no_pending_evaluations');
    return 0;
  }

  const db = await getD1();
  if (!db) throw new Error('D1 binding not available');
  let processedCount = 0;

  for (const cycle of pending) {
    try {
      await processSingleFeedbackCycle(cycle, db);
      processedCount++;
    } catch (err) {
      logger.error('feedback_engine.cycle_processing_failed', {
        cycleId: cycle.id,
        error: getErrorMessage(err),
      });
    }
  }

  return processedCount;
}
