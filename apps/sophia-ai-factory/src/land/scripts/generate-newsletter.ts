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

const DEFAULT_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function buildPrompt(input: GenerateNewsletterInput): string {
  const lang = input.language === 'vi' ? 'Vietnamese' : 'English';
  const introLine = input.editorIntro
    ? `Include this editor intro near the top: "${input.editorIntro}"`
    : '';
  const ctaLine = input.ctaText
    ? `End with a call-to-action button text: "${input.ctaText}"`
    : '';

  return [
    `Write a ${lang}-language email newsletter for the brand "${input.brandName}".`,
    `Topic/theme this week: ${input.topic}`,
    `Tone: ${input.tone}`,
    introLine,
    'Structure:',
    '1. A catchy subject line (prefix with SUBJECT: on its own line)',
    '2. A greeting and brief intro paragraph',
    '3. 2-3 content sections with ## headings covering the topic',
    '4. A brief closing paragraph',
    ctaLine,
    '',
    'Output the newsletter body in clean HTML (use <h2>, <p>, <ul>, <strong>, <a> tags).',
    'Put the subject line on the FIRST line as: SUBJECT: Your Subject Here',
    'Then the HTML body after a blank line.',
    'Keep total length 300-500 words.',
    'Do not wrap in ```html blocks or add explanations.',
  ]
    .filter((s) => s.length > 0)
    .join('\n');
}

function parseResponse(raw: string): { subject: string; html: string; plainText: string } {
  const lines = raw.split('\n');
  let subject = '';
  const bodyLines: string[] = [];
  let foundSubject = false;

  for (const line of lines) {
    const m = /^SUBJECT:\s*(.+)$/i.exec(line.trim());
    if (m && !foundSubject) {
      subject = m[1].trim();
      foundSubject = true;
    } else {
      bodyLines.push(line);
    }
  }

  const html = bodyLines.join('\n').trim();
  const plainText = html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!subject) {
    subject = `Newsletter from ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }

  return { subject, html, plainText };
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
  const model = input.model ?? DEFAULT_MODEL;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keyOrNull}`,
        'Content-Type': 'application/json',
        'X-Title': 'Sophia newsletter-writer',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: buildPrompt(input) }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn('[generate-newsletter] OpenRouter non-2xx', { status: res.status, body: body.slice(0, 200) });
      throw new Error(`LLM provider returned ${res.status}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? '';
    if (raw.length === 0) {
      throw new Error('LLM provider returned empty body');
    }

    const { subject, html, plainText } = parseResponse(raw);
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;

    return { subject, html, plainText, wordCount, model, source };
  } catch (err) {
    logger.error('[generate-newsletter] failed', toError(err), { userId: input.userId, topic });
    throw err;
  }
}
