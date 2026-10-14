/**
 * Prompt builder, markdown fence stripper, and timeout helper for LLM Fallback Generator.
 * @module tree/landing/llm-fallback-helpers
 */

import { NICHE_LABELS, type NicheSlug } from '@/seed/config/niche-list';

export const LLM_TIMEOUT_MS = 20000;
export const DEFAULT_MODEL = 'openai/gpt-4o-mini';

export function buildUserPrompt(nicheSlug: string): string {
  const label = NICHE_LABELS[nicheSlug as NicheSlug];
  const nicheName = label ? `${label.en} / ${label.vi}` : nicheSlug.replace(/-/g, ' ');

  return `Create a bilingual landing page for the niche: ${nicheName} (slug: ${nicheSlug}).

The page promotes using AI-generated videos for this specific industry.

Return a JSON object with this exact structure:
{
  "heroTitleEn": "...",
  "heroTitleVi": "...",
  "heroSubEn": "...",
  "heroSubVi": "...",
  "features": [
    { "icon": "icon-name", "title_en": "...", "title_vi": "...", "desc_en": "...", "desc_vi": "..." }
  ],
  "faq": [
    { "question_en": "...", "question_vi": "...", "answer_en": "...", "answer_vi": "..." }
  ],
  "metaTitleEn": "...",
  "metaTitleVi": "...",
  "metaDescEn": "...",
  "metaDescVi": "..."
}`;
}

export function stripMarkdownFences(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
