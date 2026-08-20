/**
 * Inngest: Strategy Feedback (Phase 4.3 — Creative Memory Feedback Loop)
 *
 * Event-triggered: fires when >=5 high-confidence signals accumulate in
 * creative_memory for a workspace. Uses OpenRouter (BYOK) via
 * resilientChatCompletion to generate strategy recommendations.
 *
 * Writes results back to creative_memory as `strategy:<timestamp>:recommendation`.
 *
 * Layer: forest (infrastructure orchestration)
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { recordLearning } from '@/tree/creative-memory';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import type { StrategyRecommendation } from '@/seed/types/performance-feedback';

const MIN_HIGH_CONFIDENCE_SIGNALS = 5;

export const strategyFeedback = inngest.createFunction(
  { id: 'strategy-feedback' },
  { event: 'creative-memory/signal-accumulated' },
  async ({ event }) => {
    const { workspaceId } = event.data;
    if (!workspaceId) {
      logger.warn('[strategy-feedback] missing workspaceId in event');
      return { generated: false };
    }

    const db = await getD1();
    if (!db) {
      logger.error('[strategy-feedback] D1 not available');
      return { generated: false };
    }

    // Count high-confidence memories
    const countResult = await db.prepare(
      `SELECT COUNT(*) as cnt FROM creative_memory
       WHERE workspace_id = ? AND confidence = 'high' AND is_deleted = 0`,
    ).bind(workspaceId).first<{ cnt: number }>();

    const signalCount = countResult?.cnt ?? 0;
    if (signalCount < MIN_HIGH_CONFIDENCE_SIGNALS) {
      logger.info('[strategy-feedback] below threshold', {
        workspaceId,
        signalCount,
        threshold: MIN_HIGH_CONFIDENCE_SIGNALS,
      });
      return { generated: false, signalCount };
    }

    // Gather high-confidence memories for context
    const memories = await db.prepare(
      `SELECT key, value, category, evidence FROM creative_memory
       WHERE workspace_id = ? AND confidence = 'high' AND is_deleted = 0
       ORDER BY updated_at DESC LIMIT 20`,
    ).bind(workspaceId).all<{
      key: string;
      value: string;
      category: string;
      evidence: string;
    }>();

    const memoryRows = memories.results ?? [];

    // Resolve API key (BYOK)
    const apiKey = await resolveUserApiKey(workspaceId, 'openrouter', process.env.OPENROUTER_API_KEY);
    const anthropicKey = process.env.ANTHROPIC_API_KEY ?? undefined;

    if (!apiKey && !anthropicKey) {
      logger.warn('[strategy-feedback] no API keys configured', { workspaceId });
      return { generated: false, reason: 'no_api_key' };
    }

    const prompt = buildStrategyPrompt(memoryRows, signalCount);

    try {
      const content = await resilientChatCompletion(prompt, {
        openRouterKey: apiKey,
        anthropicKey,
        enableFallback: !!anthropicKey,
      });

      const parsed = JSON.parse(content) as {
        recommendation?: string;
        reasoning?: string;
        confidence?: string;
        category?: string;
      };

      if (!parsed.recommendation) {
        logger.warn('[strategy-feedback] empty recommendation', { workspaceId });
        return { generated: false, reason: 'empty_response' };
      }

      const rec: StrategyRecommendation = {
        id: `strat_${Date.now()}_${workspaceId.slice(0, 8)}`,
        workspaceId,
        signalCount,
        signalSummary: memoryRows.slice(0, 5).map((m) => m.key).join(', '),
        recommendation: parsed.recommendation,
        reasoning: parsed.reasoning ?? '',
        confidence: validateConfidence(parsed.confidence),
        category: parsed.category ?? 'general',
        applied: false,
        createdAt: Date.now(),
      };

      await recordLearning(
        workspaceId,
        'performance',
        `strategy:${rec.id}:recommendation`,
        rec,
        JSON.stringify(memoryRows.map((m) => m.key)),
        'global',
      );

      logger.info('[strategy-feedback] Generated recommendation', {
        workspaceId,
        recommendationId: rec.id,
        confidence: rec.confidence,
        signalCount,
      });

      return { generated: true, recommendationId: rec.id, confidence: rec.confidence };
    } catch (err) {
      logger.error('[strategy-feedback] AI call failed', {
        error: err instanceof Error ? err.message : String(err),
        workspaceId,
      });
      return { generated: false, reason: 'ai_error' };
    }
  },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateConfidence(raw: string | undefined): 'high' | 'medium' | 'low' {
  if (raw === 'high' || raw === 'medium' || raw === 'low') return raw;
  return 'medium';
}

function buildStrategyPrompt(
  memories: { key: string; value: string; category: string; evidence: string }[],
  signalCount: number,
): string {
  const memoryList = memories.map((m) =>
    `- [${m.category}] ${m.key}: ${m.value}`,
  ).join('\n');

  return `You are a creative strategy advisor for a YouTube content creator.
Based on ${signalCount} high-confidence performance signals, generate ONE actionable strategy recommendation.

High-confidence creative memory signals:
${memoryList}

Respond ONLY with valid JSON in this exact format:
{
  "recommendation": "one clear, actionable strategy change",
  "reasoning": "why this recommendation is supported by the signals",
  "confidence": "high | medium | low",
  "category": "content_type | posting_schedule | audience_targeting | thumbnail | hook | general"
}`;
}
