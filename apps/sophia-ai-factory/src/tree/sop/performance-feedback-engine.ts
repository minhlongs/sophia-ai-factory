/**
 * Performance Feedback Engine — scheduled evaluation + prompt optimization.
 * Layer: tree (domain-reusable, imports seed only)
 */

import { getD1Raw } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import type { FeedbackCycle, EvaluationResult, PromptOptimization } from '@/seed/types/performance-feedback'
import { rowToCycle, rowToOptimization } from './performance-feedback-mappers'
import { computeEvaluation } from './performance-feedback-scoring'
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key'

/** Evaluate-after window: 7 days in seconds */
const EVALUATE_AFTER_SECONDS = 604800

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new feedback cycle for a published SOP execution.
 * evaluate_at = publishedAt + 7 days.
 */
export async function createFeedbackCycle(params: {
  executionId: string
  sopId: string
  userId: string
  publishedAt: number
}): Promise<string> {
  const id = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)
  const evaluateAt = params.publishedAt + EVALUATE_AFTER_SECONDS

  try {
    const db = await getD1Raw()
    await db
      .prepare(
        `INSERT INTO performance_feedback_cycles
         (id, execution_id, sop_id, user_id, published_at, evaluate_at, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
      )
      .bind(id, params.executionId, params.sopId, params.userId, params.publishedAt, evaluateAt, now)
      .run()

    logger.info('feedback_cycle.created', { id, sopId: params.sopId })
    return id
  } catch (err) {
    logger.error('feedback_cycle.create_failed', { error: getErrorMessage(err) })
    throw err
  }
}

/**
 * Return all pending cycles whose evaluate_at has passed.
 */
export async function getPendingEvaluations(now?: number): Promise<FeedbackCycle[]> {
  const cutoff = now ?? Math.floor(Date.now() / 1000)

  try {
    const db = await getD1Raw()
    const { results } = await db
      .prepare(
        `SELECT * FROM performance_feedback_cycles
         WHERE status = 'pending' AND evaluate_at <= ?
         ORDER BY evaluate_at ASC`
      )
      .bind(cutoff)
      .all()

    return (results as Record<string, unknown>[]).map(rowToCycle)
  } catch (err) {
    logger.error('feedback_cycle.pending_query_failed', { error: getErrorMessage(err) })
    throw err
  }
}

/**
 * Evaluate cycle performance given real-world metrics.
 * Stores result and transitions status to 'completed'.
 *
 * Expected metric keys:
 *   actual_views, expected_views,
 *   actual_engagement, expected_engagement,
 *   actual_revenue, expected_revenue
 *
 * Scoring weights: revenue 50%, views 30%, engagement 20%.
 */
export async function evaluatePerformance(
  cycleId: string,
  metrics: Record<string, number>
): Promise<EvaluationResult> {
  const evaluation = computeEvaluation(metrics)

  try {
    const db = await getD1Raw()
    await db
      .prepare(
        `UPDATE performance_feedback_cycles
         SET status = 'completed', metrics_json = ?, evaluation_json = ?
         WHERE id = ?`
      )
      .bind(JSON.stringify(metrics), JSON.stringify(evaluation), cycleId)
      .run()

    logger.info('feedback_cycle.evaluated', { cycleId, overallScore: evaluation.overallScore })
    return evaluation
  } catch (err) {
    logger.error('feedback_cycle.evaluate_failed', { cycleId, error: getErrorMessage(err) })
    throw err
  }
}

/**
 * Log a suggested prompt optimization for a given SOP step.
 */
export async function suggestOptimization(params: {
  cycleId: string
  sopId: string
  stepIndex: number
  originalPrompt: string
  suggestedPrompt: string
  improvementScore?: number
}): Promise<string> {
  const id = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)

  try {
    const db = await getD1Raw()
    await db
      .prepare(
        `INSERT INTO prompt_optimization_log
         (id, cycle_id, sop_id, step_index, original_prompt, suggested_prompt, improvement_score, applied, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
      )
      .bind(
        id, params.cycleId, params.sopId, params.stepIndex,
        params.originalPrompt, params.suggestedPrompt,
        params.improvementScore ?? null, now
      )
      .run()

    logger.info('optimization.suggested', { id, sopId: params.sopId, stepIndex: params.stepIndex })
    return id
  } catch (err) {
    logger.error('optimization.suggest_failed', { error: getErrorMessage(err) })
    throw err
  }
}

/**
 * Mark an optimization as applied. Idempotent.
 */
export async function applyOptimization(optimizationId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000)

  try {
    const db = await getD1Raw()
    await db
      .prepare(`UPDATE prompt_optimization_log SET applied = 1, applied_at = ? WHERE id = ?`)
      .bind(now, optimizationId)
      .run()

    logger.info('optimization.applied', { optimizationId })
  } catch (err) {
    logger.error('optimization.apply_failed', { optimizationId, error: getErrorMessage(err) })
    throw err
  }
}

/**
 * Return all optimizations for a SOP, ordered by step then creation date.
 */
export async function getOptimizationsForSOP(sopId: string): Promise<PromptOptimization[]> {
  try {
    const db = await getD1Raw()
    const { results } = await db
      .prepare(
        `SELECT * FROM prompt_optimization_log
         WHERE sop_id = ?
         ORDER BY step_index ASC, created_at DESC`
      )
      .bind(sopId)
      .all()

    return (results as Record<string, unknown>[]).map(rowToOptimization)
  } catch (err) {
    logger.error('optimization.query_failed', { sopId, error: getErrorMessage(err) })
    throw err
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

  const db = await getD1Raw();
  let processedCount = 0;

  for (const cycle of pending) {
    try {
      // 1. Fetch consolidated video metrics from video_analytics
      const stats = await db
        .prepare(
          `SELECT SUM(views) as total_views, SUM(likes) as total_likes, SUM(comments) as total_comments, SUM(shares) as total_shares
           FROM video_analytics
           WHERE video_id = ?1`
        )
        .bind(cycle.executionId)
        .first<{ total_views: number; total_likes: number; total_comments: number; total_shares: number }>();

      const totalViews = stats?.total_views ?? 0;
      const totalLikes = stats?.total_likes ?? 0;
      const totalComments = stats?.total_comments ?? 0;
      const totalShares = stats?.total_shares ?? 0;

      const metrics = {
        actual_views: totalViews,
        expected_views: 100, // baseline
        actual_engagement: totalLikes + totalComments + totalShares,
        expected_engagement: 10, // baseline
        actual_revenue: 0,
        expected_revenue: 0,
      };

      // 2. Perform evaluation and save to D1
      const evaluation = await evaluatePerformance(cycle.id, metrics);

      // 3. Perform LLM-driven prompt optimization
      const template = await db
        .prepare(`SELECT steps_json FROM sop_templates WHERE id = ?1 LIMIT 1`)
        .bind(cycle.sopId)
        .first<{ steps_json: string }>();

      if (template) {
        let steps: Array<{ name_en: string; tool: string; config?: Record<string, unknown> }> = [];
        try {
          steps = JSON.parse(template.steps_json);
        } catch {
          // ignore parsing error for robust execution
        }

        const openRouterKey = await resolveUserApiKey(
          cycle.userId,
          'openrouter',
          process.env.OPENROUTER_API_KEY
        );

        if (openRouterKey && steps.length > 0) {
          // Identify steps with prompts
          const stepsWithPrompts = steps
            .map((step, index) => ({
              index,
              name: step.name_en,
              tool: step.tool,
              prompt: (step.config?.prompt as string) || '',
            }))
            .filter(s => s.prompt.length > 0);

          if (stepsWithPrompts.length > 0) {
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
- Views: ${totalViews} (Expected: 100)
- Engagement: ${metrics.actual_engagement} (Expected: 10)
- Overall Performance Score: ${evaluation.overallScore}
- Recommendations: ${JSON.stringify(evaluation.recommendations)}

Existing Prompts in SOP:
${JSON.stringify(stepsWithPrompts, null, 2)}

Optimize the prompts above to improve performance. Provide the optimized prompts in the JSON output. Keep other configurations unchanged.`;

            try {
              const responseText = await callOpenRouterAPI(openRouterKey, systemPrompt, userPrompt);
              let parsed: { optimizations?: Array<{ step_index: number; suggested_prompt: string }> } = {};
              try {
                // Remove potential markdown code blocks
                const jsonText = responseText.replace(/```json|```/g, '').trim();
                parsed = JSON.parse(jsonText);
              } catch (parseErr) {
                logger.error('feedback_engine.llm_json_parse_failed', {
                  cycleId: cycle.id,
                  response: responseText,
                  error: parseErr instanceof Error ? parseErr.message : String(parseErr),
                });
              }

              if (parsed.optimizations && parsed.optimizations.length > 0) {
                for (const opt of parsed.optimizations) {
                  const original = stepsWithPrompts.find(s => s.index === opt.step_index);
                  if (original && opt.suggested_prompt) {
                    const optId = await suggestOptimization({
                      cycleId: cycle.id,
                      sopId: cycle.sopId,
                      stepIndex: opt.step_index,
                      originalPrompt: original.prompt,
                      suggestedPrompt: opt.suggested_prompt,
                      improvementScore: 0.1, // mock estimated improvement
                    });
                    // Automatically apply optimization for autonomous platform behavior
                    await applyOptimization(optId);
                  }
                }
              }
            } catch (llmErr) {
              logger.error('feedback_engine.llm_call_failed', {
                cycleId: cycle.id,
                error: llmErr instanceof Error ? llmErr.message : String(llmErr),
              });
            }
          }
        }
      }

      processedCount++;
    } catch (err) {
      logger.error('feedback_engine.cycle_processing_failed', {
        cycleId: cycle.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return processedCount;
}

async function callOpenRouterAPI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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
