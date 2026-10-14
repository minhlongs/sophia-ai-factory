import { logger } from '@/seed/utils/logger-utility';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import { localeName, TRANSLATION_MODEL } from './types';

export async function translateWithOpenRouter(
  source: string,
  targetLocale: string,
  apiKey: string,
): Promise<string | null> {
  const systemPrompt = `You are a professional social media translator.
Translate the caption to ${localeName(targetLocale)}.
Rules:
- Preserve all hashtags (translate hashtag text if appropriate for the locale, keep # prefix)
- Preserve emojis
- Keep brand names, product names, URLs unchanged
- Match the tone: casual for social, professional for LinkedIn
- Return ONLY the translated caption text, nothing else`;

  try {
    const content = await resilientChatCompletion(
      `System: ${systemPrompt}\n\nUser: ${source}`,
      {
        openRouterKey: apiKey,
        anthropicKey: undefined,
        enableFallback: false,
        model: TRANSLATION_MODEL,
      },
    );
    return content.trim() || null;
  } catch (err) {
    logger.warn(
      `[caption-translator] Translation failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}
