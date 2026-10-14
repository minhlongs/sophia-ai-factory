/**
 * SEO Script Generation Engine
 * Layer: LAND (Business Domain Workflows)
 */

import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import {
  type GenerateSeoScriptInput,
  type GenerateSeoScriptResult,
  SeoScriptConfigurationError,
  DEFAULT_MODEL,
} from './types';
import { buildPrompt, splitScriptAndTitles, extractH1 } from './prompt-builder';
import { scoreSeo } from './seo-scorer';

export async function generateSeoScript(
  input: GenerateSeoScriptInput,
): Promise<GenerateSeoScriptResult> {
  const topic = input.topic?.trim() ?? '';
  if (topic.length === 0) {
    throw new SeoScriptConfigurationError('EMPTY_TOPIC', 'topic is required');
  }
  const keywords = (input.keywords ?? []).map((k) => k.trim()).filter((k) => k.length > 0);
  const language = input.language ?? 'en';
  const min = input.lengthHint?.min ?? 180;
  const max = input.lengthHint?.max ?? 260;

  const keyOrNull = await resolveUserApiKey(
    input.userId,
    'openrouter',
    process.env.OPENROUTER_API_KEY ?? undefined,
  );
  if (!keyOrNull) {
    throw new SeoScriptConfigurationError(
      'BYOK_REQUIRED',
      'Script generation requires an OpenRouter key. Add yours in the Setup Wizard.',
    );
  }
  const source: 'user' | 'platform' = process.env.OPENROUTER_API_KEY === keyOrNull ? 'platform' : 'user';
  const model = input.model ?? DEFAULT_MODEL;

  try {
    const content = await resilientChatCompletion(
      buildPrompt(topic, keywords, language, min, max),
      {
        openRouterKey: keyOrNull,
        anthropicKey: undefined,
        enableFallback: false,
        model,
      }
    );
    const raw = content.trim();
    if (raw.length === 0) {
      throw new Error('LLM provider returned empty body');
    }

    const { script, titles } = splitScriptAndTitles(raw);
    const title = extractH1(script);
    const wordCount = script.split(/\s+/).filter(Boolean).length;
    const primary = keywords[0] ?? null;
    const { score, coverage } = scoreSeo({
      body: script,
      title,
      keywords,
      primaryKeyword: primary,
      wordCount,
      min,
      max,
    });

    return {
      script,
      suggestedTitles: titles,
      seoScore: score,
      keywordCoverage: coverage,
      wordCount,
      model,
      source,
    };
  } catch (err) {
    logger.error('[generate-seo-script] failed', toError(err), { userId: input.userId, topic });
    throw err;
  }
}
