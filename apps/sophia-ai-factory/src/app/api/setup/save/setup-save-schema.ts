/**
 * Setup Wizard Save Schema, Provider Mapping, and Persistence Helpers
 */

import { z } from 'zod';
import { setUserApiKey, type ByokProvider } from '@/tree/byok/user-api-key-store';
import { validateProviderKey, sanitizeCredential } from '@/tree/byok/key-format-validators';
import type { ValidatorProvider } from '@/tree/byok/key-format-validators';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

/** Map Zod config field names -> BYOK provider identifiers */
export const PROVIDER_MAP: Record<string, ByokProvider> = {
  OPENROUTER_API_KEY: 'openrouter',
  ANTHROPIC_API_KEY: 'anthropic',
  ELEVENLABS_API_KEY: 'elevenlabs',
  DID_API_KEY: 'd-id',
  MUAPI_API_KEY: 'muapi',
  APOLLO_API_KEY: 'apollo',
  HUNTER_API_KEY: 'hunter',
  REPLICATE_API_KEY: 'replicate',
};

const optionalSanitizedKey = () =>
  z.preprocess(
    (val) => (typeof val === 'string' ? sanitizeCredential(val) : val),
    z.string().optional(),
  );

export const setupSaveSchema = z
  .object({
    config: z.object({
      OPENROUTER_API_KEY: optionalSanitizedKey(),
      ANTHROPIC_API_KEY: optionalSanitizedKey(),
      ELEVENLABS_API_KEY: optionalSanitizedKey(),
      DID_API_KEY: optionalSanitizedKey(),
      MUAPI_API_KEY: optionalSanitizedKey(),
      APOLLO_API_KEY: optionalSanitizedKey(),
      HUNTER_API_KEY: optionalSanitizedKey(),
      REPLICATE_API_KEY: optionalSanitizedKey(),
    }),
  })
  .refine(
    (data) =>
      Boolean(data.config.OPENROUTER_API_KEY) ||
      Boolean(data.config.ANTHROPIC_API_KEY),
    {
      message: 'At least one LLM provider key required (OpenRouter or Anthropic)',
      path: ['config', 'OPENROUTER_API_KEY'],
    },
  )
  .superRefine((data, ctx) => {
    for (const [field, provider] of Object.entries(PROVIDER_MAP)) {
      const val = data.config[field as keyof typeof data.config];
      if (val && val.length > 0) {
        const validation = validateProviderKey(provider as ValidatorProvider, val);
        if (!validation.ok) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['config', field],
            message: `Invalid format for ${provider}`,
          });
        }
      }
    }
  });

export type SetupConfigInput = z.infer<typeof setupSaveSchema>['config'];

export async function persistConfiguredApiKeys(
  userId: string,
  config: SetupConfigInput,
): Promise<string[]> {
  const saved: string[] = [];
  for (const [field, provider] of Object.entries(PROVIDER_MAP)) {
    const value = config[field as keyof SetupConfigInput];
    if (value && value.length > 0) {
      const validation = validateProviderKey(provider as ValidatorProvider, value);
      const finalValue = validation.ok && validation.autoEncoded ? validation.autoEncoded : value;
      await setUserApiKey(userId, provider, finalValue);
      saved.push(provider);
    }
  }
  return saved;
}

export async function markSetupOnboardingComplete(userId: string): Promise<void> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    const nowMs = Date.now();
    await db.prepare('UPDATE user_profiles SET onboarding_completed_at = ? WHERE user_id = ?')
      .bind(nowMs, userId)
      .run();
    await db.prepare('UPDATE user_sop_installations SET enabled = 1 WHERE user_id = ? AND enabled = 0')
      .bind(userId)
      .run();
  } catch (dbErr) {
    logger.warn('[SetupSave] Failed to set onboarding_completed_at in DB', { error: dbErr });
    // D1 onboarding state is best-effort; the response cookie remains the fallback gate.
  }
}
