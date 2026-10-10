/**
 * LLM Prompt Optimizer & Analytics Fetcher
 * Layer: tree/sop
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { EvaluationResult } from '@/seed/types/performance-feedback';
import type { StepWithPrompt, LlmOptimizationSuggestion } from './types';

export async function fetchVideoMetrics(db: D1Database, executionId: string) {
  const stats = await db
    .prepare(
      `SELECT SUM(views) as total_views, SUM(likes) as total_likes, SUM(comments) as total_comments, SUM(shares) as total_shares
       FROM video_analytics
       WHERE video_id = ?1`,
    )
    .bind(executionId)
    .first<{ total_views: number; total_likes: number; total_comments: number; total_shares: number }>();

  const totalViews = stats?.total_views ?? 0;
  const totalLikes = stats?.total_likes ?? 0;
  const totalComments = stats?.total_comments ?? 0;
  const totalShares = stats?.total_shares ?? 0;

  return {
    totalViews,
    metrics: {
      actual_views: totalViews,
      expected_views: 100, // baseline
      actual_engagement: totalLikes + totalComments + totalShares,
      expected_engagement: 10, // baseline
      actual_revenue: 0,
      expected_revenue: 0,
    },
  };
}

export function parseStepsFromTemplate(stepsJson: string): StepWithPrompt[] {
  let steps: Array<{ name_en: string; tool: string; config?: Record<string, unknown> }> = [];
  try {
    steps = JSON.parse(stepsJson);
  } catch {
    return [];
  }

  return steps
    .map((step, index) => ({
      index,
      name: step.name_en,
      tool: step.tool,
      prompt: (step.config?.prompt as string) || '',
    }))
    .filter((s) => s.prompt.length > 0);
}

export async function callOpenRouterAPI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenRouter HTTP ${response.status} - ${await response.text()}`);
  }
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content || '';
}

export async function requestLlmOptimizations(params: {
  openRouterKey: string;
  cycleId: string;
  totalViews: number;
  metrics: { actual_engagement: number };
  evaluation: EvaluationResult;
  stepsWithPrompts: StepWithPrompt[];
}): Promise<LlmOptimizationSuggestion[]> {
  const systemPrompt = `You are a Senior AI Prompt Engineer. Your task is to optimize the AI prompts used in an automated Video Video Generation SOP.
Analyze the video performance metrics and optimize the existing prompts to achieve better viewer retention, higher views, and stronger engagement.
Return your suggestions STRICTLY in a JSON object format:
{
  "optimizations": [
    {
      "step_index": number,
      "suggested_prompt": "..."
    }
  ]
}`;

  const userPrompt = `Video Performance Metrics:
- Views: ${params.totalViews} (Expected: 100)
- Engagement: ${params.metrics.actual_engagement} (Expected: 10)
- Overall Performance Score: ${params.evaluation.overallScore}
- Recommendations: ${JSON.stringify(params.evaluation.recommendations)}

Existing Prompts in SOP:
${JSON.stringify(params.stepsWithPrompts, null, 2)}

Optimize the prompts above to improve performance. Provide the optimized prompts in the JSON output. Keep other configurations unchanged.`;

  try {
    const responseText = await callOpenRouterAPI(params.openRouterKey, systemPrompt, userPrompt);
    const jsonText = responseText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(jsonText) as { optimizations?: LlmOptimizationSuggestion[] };
    return parsed.optimizations ?? [];
  } catch (err) {
    logger.error('feedback_engine.llm_optimization_failed', {
      cycleId: params.cycleId,
      error: getErrorMessage(err),
    });
    return [];
  }
}
