/**
 * Core scoreProvider function for the provider scoring engine.
 * Computes all 7 dimension scores and the weighted composite for a
 * single tool against a task context.
 * @module seed/ai/score-provider
 */

import { createLogger } from '@/seed/utils/logger-utility';
import { type ProviderScore, type TaskContext, type ToolInfo } from './provider-scoring-types';
import {
  computeTaskFit,
  computeControl,
  computeCostEfficiency,
  computeContinuity,
} from './scoring-dimensions';
import {
  computeOutputQuality,
  computeReliability,
  computeLatency,
} from './scoring-quality';
import { applyContextualAdjustments } from './scoring-contextual';

const logger = createLogger('seed/ai/provider-scoring');

/**
 * Score a single provider against a task context.
 * Returns a ProviderScore with all 7 dimensions and the computed
 * weighted composite. All scores are normalised 0-1.
 */
export function scoreProvider(
  tool: ToolInfo,
  taskContext: TaskContext,
): ProviderScore {
  logger.debug('Scoring provider', { provider: tool.provider, toolName: tool.name });

  const bestFor = new Set(tool.bestFor ?? []);
  const intent = taskContext.intent ?? '';
  const styleKeywords = new Set(taskContext.styleKeywords ?? []);

  for (const source of [taskContext.style, taskContext.platform, ...(taskContext.needs ?? [])]) {
    if (source) {
      source.split(/[\s,]+/).forEach((kw) => styleKeywords.add(kw.toLowerCase()));
    }
  }

  const taskFit = computeTaskFit(bestFor, intent, styleKeywords);
  const control = computeControl(tool.supports ?? {});

  let estimatedCost = 0;
  if (tool.estimateCost) {
    try {
      estimatedCost = tool.estimateCost(taskContext);
    } catch {
      // Cost estimation failed — treat as free
    }
  }
  const costEfficiency = computeCostEfficiency(estimatedCost, taskContext.budgetRemainingUsd);
  const latency = computeLatency(tool);
  const continuity = computeContinuity(tool.provider, taskContext.lockedProviders ?? []);

  const statusValue = tool.stability ?? 'experimental';
  const outputQuality = computeOutputQuality(tool, statusValue);
  const reliability = computeReliability(tool, statusValue);

  const adjusted = applyContextualAdjustments(tool, taskContext, {
    taskFit,
    outputQuality,
    control,
  });

  const weightedScore =
    adjusted.taskFit * 0.30 +
    adjusted.outputQuality * 0.20 +
    adjusted.control * 0.15 +
    reliability * 0.15 +
    costEfficiency * 0.10 +
    latency * 0.05 +
    continuity * 0.05;

  logger.debug('Provider score', {
    provider: tool.provider,
    toolName: tool.name,
    weightedScore: weightedScore.toFixed(3),
  });

  return {
    provider: tool.provider,
    toolName: tool.name,
    task_fit: adjusted.taskFit,
    output_quality: adjusted.outputQuality,
    control: adjusted.control,
    reliability,
    cost_efficiency: costEfficiency,
    latency,
    continuity,
    weighted_score: weightedScore,
  };
}
