import { logger } from '@/seed/utils/logger-utility';
import { enforceCharCap } from '../channel-caption-rules';
import type { TranslateCaptionInput, TranslateCaptionResult } from './types';
import { TranslateCaptionInputSchema, CACHE_TTL_SECONDS } from './types';
import { sha256Hex, getKv } from './kv-cache';
import { translateWithOpenRouter } from './openrouter-translator';

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
  const parsed = TranslateCaptionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      caption: enforceCharCap(input.source ?? '', input.charCap ?? 0),
      fromCache: false,
      translated: false,
      warning: `Invalid input: ${parsed.error.message}`,
    };
  }

  const { source, targetLocale, charCap, byokKey } = parsed.data;

  // No BYOK key → skip translation, apply char cap, warn
  if (!byokKey) {
    return {
      caption: enforceCharCap(source, charCap),
      fromCache: false,
      translated: false,
      warning: 'BYOK_KEY_MISSING: translation skipped, using original caption',
    };
  }

  // Build cache key
  const hash = await sha256Hex(source);
  const cacheKey = `translation:${hash}:${targetLocale}`;

  // Check KV cache
  const kv = await getKv();
  if (kv) {
    try {
      const cached = await kv.get(cacheKey);
      if (cached) {
        return {
          caption: enforceCharCap(cached, charCap),
          fromCache: true,
          translated: true,
        };
      }
    } catch (err) {
      logger.warn(
        `[caption-translator] KV get failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Call OpenRouter
  const translated = await translateWithOpenRouter(source, targetLocale, byokKey);

  if (!translated) {
    return {
      caption: enforceCharCap(source, charCap),
      fromCache: false,
      translated: false,
      warning: 'TRANSLATION_FAILED: OpenRouter returned no result, using original caption',
    };
  }

  // Write to KV cache (fire-and-forget; don't block publish on cache write failure)
  if (kv) {
    kv.put(cacheKey, translated, { expirationTtl: CACHE_TTL_SECONDS }).catch((err: unknown) => {
      logger.warn(
        `[caption-translator] KV put failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  return {
    caption: enforceCharCap(translated, charCap),
    fromCache: false,
    translated: true,
  };
}
