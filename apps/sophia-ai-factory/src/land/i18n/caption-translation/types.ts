import { z } from 'zod';

export const TranslateCaptionInputSchema = z.object({
  /** Original caption text (source language). */
  source: z.string().min(1),
  /** BCP-47 target locale, e.g. 'vi', 'en', 'zh', 'ja'. */
  targetLocale: z.string().min(2),
  /** Channel char cap — 0 = no cap. Applied after translation. */
  charCap: z.number().int().min(0).default(0),
  /** User's BYOK OpenRouter API key. */
  byokKey: z.string().optional(),
});

export type TranslateCaptionInput = z.infer<typeof TranslateCaptionInputSchema>;

export interface TranslateCaptionResult {
  /** Final translated (or fallback) caption. */
  caption: string;
  /** true = translation was served from KV cache. */
  fromCache: boolean;
  /** true = translation was successful. false = fell back to original. */
  translated: boolean;
  /** Warning message if fallback was triggered. */
  warning?: string;
}

export const CACHE_TTL_SECONDS = 2_592_000; // 30 days
export const TRANSLATION_MODEL = 'anthropic/claude-haiku-4-5';

export const LOCALE_NAMES: Record<string, string> = {
  vi: 'Vietnamese',
  en: 'English',
  zh: 'Chinese (Simplified)',
  ja: 'Japanese',
  ko: 'Korean',
  th: 'Thai',
  id: 'Indonesian',
  ms: 'Malay',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  pt: 'Portuguese',
};

export function localeName(locale: string): string {
  return LOCALE_NAMES[locale] ?? locale;
}
