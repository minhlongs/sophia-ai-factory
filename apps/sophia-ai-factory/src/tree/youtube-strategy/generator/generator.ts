import { logger } from '@/seed/utils/logger-utility';
import type { StrategyRequest, ContentStrategy, AIGenerateFn } from './types';
import { generateStrategyWithAI, generateTemplateStrategy } from './ai-parser';

/**
 * Generate a content strategy, preferring AI generation when available.
 */
export async function generateStrategy(
  request: StrategyRequest,
  generateText?: AIGenerateFn,
): Promise<ContentStrategy> {
  if (generateText) {
    try {
      const aiStrategy = await generateStrategyWithAI(request, generateText);
      if (aiStrategy) return aiStrategy;
    } catch (err) {
      logger.warn('AI strategy generation failed; using template fallback', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return generateTemplateStrategy(request);
}
