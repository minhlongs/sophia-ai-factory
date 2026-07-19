/**
 * Content insights generator — AI-powered recommendations from analytics data.
 * Uses OpenRouter (BYOK) to analyze performance patterns.
 *
 * @module lib/analytics/content-insights-generator
 */

import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { logger } from '@/seed/utils/logger-utility';
import type { AnalyticsSummary } from '@/seed/db/repositories/video-analytics-repo';

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

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

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
  if (!apiKey) {
    logger.warn('[content-insights-generator] No OpenRouter key', { userId });
    return [];
  }

  const prompt = buildInsightsPrompt(summary, topVideos);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sophia.agencyos.network',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      logger.warn('[content-insights-generator] API error', { status: res.status });
      return [];
    }

    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(content) as { insights?: ContentInsight[] };
    return Array.isArray(parsed.insights) ? parsed.insights.slice(0, 5) : [];
  } catch (err) {
    logger.error('[content-insights-generator] Failed', { err: String(err) });
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
