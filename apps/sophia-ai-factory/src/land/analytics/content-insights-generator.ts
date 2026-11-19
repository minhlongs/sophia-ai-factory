/**
 * Content insights generator — AI-powered recommendations from analytics data.
 * Uses OpenRouter (BYOK) to analyze performance patterns.
 *
 * @module lib/analytics/content-insights-generator
 */

import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { logger } from '@/seed/utils/logger-utility';
import type { AnalyticsSummary } from '@/seed/db/repositories/video-analytics-repo';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import {
  buildInsightsPrompt,
  buildContentRoiPrompt,
  type TopVideoMetric,
  type ContentRoiSummary,
} from '@/seed/inference/prompt-builders';

export interface ContentInsight {
  insight: string;
  recommendation: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Generate content insights by comparing top vs bottom performers.
 * Returns 3-5 structured recommendations.
 */
export async function generateContentInsights(
  userId: string,
  summary: AnalyticsSummary,
  topVideos: TopVideoMetric[],
): Promise<ContentInsight[]> {
  // Fail closed to customer BYOK — never spend platform OPENROUTER_API_KEY on content insights.
  const apiKey = await resolveUserApiKey(userId, 'openrouter');
  const anthropicKey = (await resolveUserApiKey(userId, 'anthropic')) ?? undefined;

  if (!apiKey && !anthropicKey) {
    logger.warn('[content-insights-generator] No BYOK API keys configured');
    return [];
  }

  const summaryText = `Total views: ${summary.totalViews}
- Avg CTR: ${(summary.avgCtr * 100).toFixed(2)}%
- Avg completion rate: ${(summary.avgCompletionRate * 100).toFixed(1)}%
- Total watch time: ${Math.round(summary.totalWatchTimeSec / 3600)}h`;

  const prompt = buildInsightsPrompt(summaryText, topVideos);

  try {
    const content = await resilientChatCompletion(prompt, {
      openRouterKey: apiKey,
      anthropicKey,
      enableFallback: !!anthropicKey,
    });

    const parsed = JSON.parse(content) as { insights?: ContentInsight[] };
    return Array.isArray(parsed.insights) ? parsed.insights.slice(0, 5) : [];
  } catch (err) {
    logger.warn('[content-insights-generator] AI call failed', { error: String(err) });
    return [];
  }
}

/**
 * Generate ROI-aware content insights.
 * Caller pre-fetches ROI data (forest layer) and passes it as roiProjects.
 * Returns 3-5 structured ROI recommendations — never throws.
 *
 * @param userId - workspace owner
 * @param summaryText - pre-formatted performance summary
 * @param roiProjects - top projects by ROI (pre-fetched by caller)
 * @param hasData - false when roi_records is empty
 */
export async function generateRoiInsights(
  userId: string,
  summaryText: string,
  roiProjects: ContentRoiSummary[],
  hasData: boolean,
): Promise<ContentInsight[]> {
  // Fail closed to customer BYOK — never spend platform OPENROUTER_API_KEY on ROI insights.
  const apiKey = await resolveUserApiKey(userId, 'openrouter');
  const anthropicKey = (await resolveUserApiKey(userId, 'anthropic')) ?? undefined;

  if (!apiKey && !anthropicKey) {
    logger.warn('[content-insights-generator] No BYOK API keys configured for ROI insights');
    return [];
  }

  const prompt = buildContentRoiPrompt(summaryText, roiProjects, hasData);

  try {
    const content = await resilientChatCompletion(prompt, {
      openRouterKey: apiKey,
      anthropicKey,
      enableFallback: !!anthropicKey,
    });

    const parsed = JSON.parse(content) as { insights?: ContentInsight[] };
    return Array.isArray(parsed.insights) ? parsed.insights.slice(0, 5) : [];
  } catch (err) {
    logger.warn('[content-insights-generator] ROI insights AI call failed', { error: String(err) });
    return [];
  }
}