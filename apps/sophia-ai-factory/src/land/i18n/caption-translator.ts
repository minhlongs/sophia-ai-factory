/**
 * caption-translator.ts — Geo-aware caption translation per channel
 *
 * Responsibilities:
 *   1. Check KV cache (key: translation:{sha256(source)}:{targetLocale})
 *   2. Call OpenRouter (BYOK key) if cache miss
 *   3. Apply channel char cap after translation
 *   4. Fallback to original caption on any failure — never blocks publish
 *
 * Cost model: BYOK-only. No pooled Sophia LLM costs.
 * Cache TTL: 30 days (2_592_000 seconds).
 *
 * @module lib/i18n/caption-translator
 */

import { z } from 'zod'
import { withTimeout } from '@/tree/byok/with-timeout'
import { logger } from '@/seed/utils/logger-utility'
import { enforceCharCap } from './channel-caption-rules'
import { resilientChatCompletion } from '@/seed/inference/openrouter-client'

// ---------------------------------------------------------------------------
// Schema + Types
// ---------------------------------------------------------------------------

export const TranslateCaptionInputSchema = z.object({
  /** Original caption text (source language). */
  source: z.string().min(1),
  /** BCP-47 target locale, e.g. 'vi', 'en', 'zh', 'ja'. */
  targetLocale: z.string().min(2),
  /** Channel char cap — 0 = no cap. Applied after translation. */
  charCap: z.number().int().min(0).default(0),
  /** User's BYOK OpenRouter API key. */
  byokKey: z.string().optional(),
})

export type TranslateCaptionInput = z.infer<typeof TranslateCaptionInputSchema>

export interface TranslateCaptionResult {
  /** Final translated (or fallback) caption. */
  caption: string
  /** true = translation was served from KV cache. */
  fromCache: boolean
  /** true = translation was successful. false = fell back to original. */
  translated: boolean
  /** Warning message if fallback was triggered. */
  warning?: string
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const CACHE_TTL_SECONDS = 2_592_000 // 30 days
// Use haiku for cost efficiency; openrouter/auto also acceptable
const TRANSLATION_MODEL = 'anthropic/claude-haiku-4-5'

// BCP-47 → human-readable locale name for prompt clarity
const LOCALE_NAMES: Record<string, string> = {
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
}

function localeName(locale: string): string {
  return LOCALE_NAMES[locale] ?? locale
}

// ---------------------------------------------------------------------------
// SHA-256 (edge-safe, Web Crypto)
// ---------------------------------------------------------------------------

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  )
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ---------------------------------------------------------------------------
// KV access
// ---------------------------------------------------------------------------

async function getKv(): Promise<KVNamespace | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const ctx = await getCloudflareContext()
    const env = ctx.env as Record<string, unknown>
    return (env.EXPERIMENT_KV as KVNamespace) ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Translation via resilient client
// ---------------------------------------------------------------------------

async function translateWithOpenRouter(
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
      }
    );
    return content.trim() || null;
  } catch (err) {
    logger.warn(
      `[caption-translator] Translation failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Translate a caption to the target locale, applying channel char cap.
 *
 * - Returns original caption (with char cap) if:
 *   - targetLocale === source locale assumed (en → en, no-op shortcut not done here, caller decides)
 *   - BYOK key is missing
 *   - OpenRouter call fails
 * - Never throws — all errors are soft fallbacks with warnings.
 */
export async function translateCaption(
  input: TranslateCaptionInput,
): Promise<TranslateCaptionResult> {
  const parsed = TranslateCaptionInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      caption: enforceCharCap(input.source ?? '', input.charCap ?? 0),
      fromCache: false,
      translated: false,
      warning: `Invalid input: ${parsed.error.message}`,
    }
  }

  const { source, targetLocale, charCap, byokKey } = parsed.data

  // No BYOK key → skip translation, apply char cap, warn
  if (!byokKey) {
    return {
      caption: enforceCharCap(source, charCap),
      fromCache: false,
      translated: false,
      warning: 'BYOK_KEY_MISSING: translation skipped, using original caption',
    }
  }

  // Build cache key
  const hash = await sha256Hex(source)
  const cacheKey = `translation:${hash}:${targetLocale}`

  // Check KV cache
  const kv = await getKv()
  if (kv) {
    try {
      const cached = await kv.get(cacheKey)
      if (cached) {
        return {
          caption: enforceCharCap(cached, charCap),
          fromCache: true,
          translated: true,
        }
      }
    } catch (err) {
      logger.warn(`[caption-translator] KV get failed: ${err instanceof Error ? err.message : String(err)}`)
      // Continue to LLM path
    }
  }

  // Call OpenRouter
  const translated = await translateWithOpenRouter(source, targetLocale, byokKey)

  if (!translated) {
    return {
      caption: enforceCharCap(source, charCap),
      fromCache: false,
      translated: false,
      warning: 'TRANSLATION_FAILED: OpenRouter returned no result, using original caption',
    }
  }

  // Write to KV cache (fire-and-forget; don't block publish on cache write failure)
  if (kv) {
    kv.put(cacheKey, translated, { expirationTtl: CACHE_TTL_SECONDS }).catch((err: unknown) => {
      logger.warn(`[caption-translator] KV put failed: ${err instanceof Error ? err.message : String(err)}`)
    })
  }

  return {
    caption: enforceCharCap(translated, charCap),
    fromCache: false,
    translated: true,
  }
}
