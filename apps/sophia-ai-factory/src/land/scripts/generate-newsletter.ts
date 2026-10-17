/**
 * Newsletter Writer — generates email newsletter HTML via BYOK OpenRouter.
 *
 * Similar to generate-seo-script.ts but outputs structured newsletter
 * with subject line, intro, curated sections, and CTA.
 *
 * @module land/scripts/generate-newsletter
 */

import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import {
  DEFAULT_NEWSLETTER_MODEL,
  buildNewsletterPrompt,
  parseNewsletterResponse,
} from './newsletter-prompt-parser';

export interface GenerateNewsletterInput {
  userId: string;
  brandName: string;
  topic: string;
  tone: 'professional' | 'conversational' | 'educational' | 'witty';
  editorIntro?: string;
  ctaText?: string;
  language?: 'en' | 'vi';
  model?: string;
}

export interface GenerateNewsletterResult {
  subject: string;
  html: string;
  plainText: string;
  wordCount: number;
  model: string;
  source: 'user' | 'platform';
}

export class NewsletterConfigError extends Error {
  code: 'BYOK_REQUIRED' | 'EMPTY_TOPIC' | 'EMPTY_BRAND';
  constructor(code: NewsletterConfigError['code'], message: string) {
    super(message);
    this.name = 'NewsletterConfigError';
    this.code = code;
  }
}

export async function generateNewsletter(
  input: GenerateNewsletterInput,
): Promise<GenerateNewsletterResult> {
  const brand = input.brandName?.trim().slice(0, 200) ?? '';
  if (brand.length === 0) {
    throw new NewsletterConfigError('EMPTY_BRAND', 'Brand name is required');
  }
  const topic = input.topic?.trim().slice(0, 2000) ?? '';
  if (topic.length === 0) {
    throw new NewsletterConfigError('EMPTY_TOPIC', 'Topic is required');
  }

  const keyOrNull = await resolveUserApiKey(
    input.userId,
    'openrouter',
    process.env.OPENROUTER_API_KEY ?? undefined,
  );
  if (!keyOrNull) {
    throw new NewsletterConfigError(
      'BYOK_REQUIRED',
      'Newsletter generation requires an OpenRouter key. Add yours in the Setup Wizard.',
    );
  }

  const source: 'user' | 'platform' = process.env.OPENROUTER_API_KEY === keyOrNull ? 'platform' : 'user';
  const model = input.model ?? DEFAULT_NEWSLETTER_MODEL;

  try {
    const content = await resilientChatCompletion(
      buildNewsletterPrompt(input),
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

    const { subject, html, plainText } = parseNewsletterResponse(raw);
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;

    return { subject, html, plainText, wordCount, model, source };
  } catch (err) {
    logger.error('[generate-newsletter] failed', toError(err), { userId: input.userId, topic });
    throw err;
  }
}
