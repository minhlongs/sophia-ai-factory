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

export interface ContentInsight {
  insight: string;
  recommendation: string;
  confidence: 'high' | 'medium' | 'low';
}

interface TopVideoMetric {
  videoId: string;
  views: number;
  ctr: number;
  watchTimeSec: number;
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
  const apiKey = await resolveUserApiKey(userId, 'openrouter', process.env.OPENROUTER_API_KEY);
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? undefined;

  if (!apiKey && !anthropicKey) {
    logger.warn('[content-insights-generator] No API keys configured');
    return [];
  }

  const prompt = buildInsightsPrompt(summary, topVideos);

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

function buildInsightsPrompt(summary: AnalyticsSummary, topVideos: TopVideoMetric[]): string {
  const top = topVideos.slice(0, 3).map(v =>
    `- Views: ${v.views}, CTR: ${(v.ctr * 100).toFixed(1)}%, WatchTime: ${Math.round(v.watchTimeSec / 60)}min`,
  ).join('\n');

  return `You are a content strategy analyst. Given these YouTube video performance metrics, identify patterns in high-performing content and suggest 3-5 improvements for future videos.

Summary (last 30 days):
- Total views: ${summary.totalViews}
- Avg CTR: ${(summary.avgCtr * 100).toFixed(2)}%
- Avg completion rate: ${(summary.avgCompletionRate * 100).toFixed(1)}%
- Total watch time: ${Math.round(summary.totalWatchTimeSec / 3600)}h

Top performing videos:
${top || 'No data yet'}

Respond ONLY with valid JSON in this exact format:
{
  "insights": [
    {
      "insight": "specific observation about what works",
      "recommendation": "actionable next step",
      "confidence": "high" | "medium" | "low"
    }
  ]
}`;
}
