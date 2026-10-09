/**
 * @module forest/ai/providers/key-resolver
 * API key resolution logic with BYOK-first strategy.
 *
 * Layer: forest — imports seed and tree only.
 */

import type { ByokProvider } from '@/tree/byok/user-api-key-store';
import { resolveUserApiKey, isByokEnabled } from '@/tree/byok/resolve-user-api-key';
import { logger } from '@/seed/utils/logger-utility';
import type { SupportedProviderId } from './types';

const BYOK_SUPPORTED: ByokProvider[] = [
  'openrouter',
  'anthropic',
  'elevenlabs',
  'fal-ai',
  'replicate',
  'd-id',
  'heygen',
  'muapi',
  'apollo',
  'hunter',
];

/**
 * Resolve the API key for a provider using BYOK-first strategy.
 *
 * Order:
 * 1. BYOK store (user key) — only when BYOK_ENABLED=1 and userId is set
 * 2. Platform fallback key from config
 *
 * @returns Resolved key or null if none available.
 */
export async function resolveApiKey(
  userId: string | null | undefined,
  providerId: SupportedProviderId | string,
  platformFallback?: string,
): Promise<string | null> {
  const byokProvider = providerId as ByokProvider;

  if (userId && isByokEnabled()) {
    try {
      const lookupProvider =
        providerId === 'kling' || providerId === 'kling-video'
          ? 'fal-ai'
          : providerId === 'hunyuan' || providerId === 'hunyuan-video'
          ? 'replicate'
          : BYOK_SUPPORTED.includes(byokProvider)
          ? byokProvider
          : null;

      if (lookupProvider) {
        const userKey = await resolveUserApiKey(userId, lookupProvider);
        if (userKey) {
          logger.debug('[ProviderFactory] Resolved BYOK key', undefined, {
            providerId,
            userId,
          });
          return userKey;
        }
      }
    } catch (err) {
      logger.warn('[ProviderFactory] BYOK key resolution failed — using fallback', undefined, {
        providerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Platform fallback
  if (platformFallback) {
    logger.debug('[ProviderFactory] Using platform API key', undefined, { providerId });
    return platformFallback;
  }

  return null;
}
