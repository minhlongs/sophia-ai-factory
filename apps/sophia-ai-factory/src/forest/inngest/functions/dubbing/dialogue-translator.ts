/**
 * Background Dubbing Orchestration: Dialogue Translation with Tempo Constraints
 *
 * Layer: forest (infrastructure orchestrator & Inngest function)
 *
 * @module forest/inngest/functions/dubbing/dialogue-translator
 */

import { logger } from '@/seed/utils/logger-utility';
import type { ApacLocale } from '@/seed/types/dubbing';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import type { DialogueTempoConstraints } from './types';
import { getAiBinding } from './binding-helper';
import {
  cleanTranslationOutput,
  buildDubbingTranslationPrompt,
  contextualDialogueTranslate,
} from './dialogue-translator-helpers';

export {
  cleanTranslationOutput,
  buildDubbingTranslationPrompt,
  contextualDialogueTranslate,
};

async function tryWorkersAiTranslation(
  trimmedText: string,
  fromLocale: ApacLocale,
  toLocale: ApacLocale,
  tempo?: DialogueTempoConstraints,
): Promise<string | null> {
  const ai = await getAiBinding();
  if (!ai) return null;

  try {
    const prompt = buildDubbingTranslationPrompt(trimmedText, fromLocale, toLocale, tempo);
    const res = (await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content:
            'You are an expert bilingual audiovisual dubbing translator. Translate dialogue accurately with dialogue tempo preservation. Return only the translated text.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 512,
      temperature: 0.3,
    })) as { response?: string };

    const candidate = res?.response?.trim();
    if (candidate) return cleanTranslationOutput(candidate);
  } catch (err) {
    logger.warn('[VideoVoiceDubbing] CF LLaMA translation failed, trying M2M100', {
      error: String(err),
    });
  }

  try {
    const m2mRes = (await ai.run('@cf/meta/m2m100-1.2b', {
      text: trimmedText,
      source_lang: fromLocale,
      target_lang: toLocale,
    })) as { translated_text?: string };

    const m2mText = m2mRes?.translated_text?.trim();
    if (m2mText) return cleanTranslationOutput(m2mText);
  } catch (m2mErr) {
    logger.warn('[VideoVoiceDubbing] CF M2M100 translation failed', { error: String(m2mErr) });
  }

  return null;
}

/**
 * Contextual dialogue translation preserving speech tempo constraints.
 */
export async function translateDialogueText(
  text: string,
  fromLocale: ApacLocale,
  toLocale: ApacLocale,
  tempo?: DialogueTempoConstraints,
): Promise<string> {
  const trimmedText = text.trim();
  if (!trimmedText) return '';
  if (fromLocale === toLocale) return trimmedText;

  // 1. Try Cloudflare Workers AI
  const cfResult = await tryWorkersAiTranslation(trimmedText, fromLocale, toLocale, tempo);
  if (cfResult) return cfResult;

  // 2. Try OpenRouter BYOK/platform key if available
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const prompt = buildDubbingTranslationPrompt(trimmedText, fromLocale, toLocale, tempo);
      const response = await resilientChatCompletion(prompt, {
        openRouterKey: process.env.OPENROUTER_API_KEY,
        model: 'openai/gpt-4o-mini',
      });
      const cleaned = cleanTranslationOutput(response);
      if (cleaned) return cleaned;
    } catch (openRouterErr) {
      logger.warn('[VideoVoiceDubbing] OpenRouter translation failed', {
        error: String(openRouterErr),
      });
    }
  }

  // 3. Fallback: Contextual dialogue translation engine matching tempo constraints
  return contextualDialogueTranslate(trimmedText, fromLocale, toLocale, tempo);
}
