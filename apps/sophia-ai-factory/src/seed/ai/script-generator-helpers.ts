import { Tier } from '@/seed/types';
import { getErrorMessage } from '@/seed/utils/to-error';
import { ProviderQuotaExceededError, ProviderInvalidKeyError } from '@/seed/services/errors';
import type { AffiliateOfferCta, ScriptOutput } from '@/seed/ai/script-prompt-builders';
import type { PriorScriptSteering } from '@/seed/types/growth-triad-v16';

export function selectModelForTier(tier: Tier): string {
  return tier === 'ENTERPRISE' ? 'anthropic/claude-3.5-sonnet' : 'openai/gpt-4o-mini';
}

export interface GenerateScriptInput {
  topic: string;
  audience: string;
  tier: Tier;
  userId?: string;
  licenseKey?: string;
  licenseNonce?: string;
  orgId?: string;
  affiliateOffer?: AffiliateOfferCta;
  steering?: PriorScriptSteering;
}

export type ApiKeyResolver = (
  userId: string | null,
  provider: string,
  fallback?: string,
) => Promise<string | null>;

export interface ScriptGenDeps {
  resolveUserApiKey?: ApiKeyResolver;
  trackUsage?: (data: Record<string, unknown>) => Promise<void>;
  hashLicenseKey?: (key: string) => string;
  startTimer?: () => () => number;
  getUsageContext?: () => { userId?: string; licenseNonce?: string };
}

export async function resolveScriptApiKey(
  resolvedUserId: string | null,
  resolveKey: ApiKeyResolver | null | undefined,
): Promise<string | null> {
  let apiKey: string | null = null;
  if (resolveKey) {
    try {
      apiKey = await resolveKey(resolvedUserId, 'openrouter', process.env.OPENROUTER_API_KEY);
    } catch {
      apiKey = null;
    }
  }
  if (!apiKey) {
    apiKey = process.env.OPENROUTER_API_KEY || null;
  }
  return apiKey;
}

export function validateParsedScriptStructure(parsed: ScriptOutput): ScriptOutput {
  const validated = parsed as unknown as { title: string; scenes: Array<{ narration: string }> };
  if (!validated.title || !Array.isArray(validated.scenes) || validated.scenes.length === 0) {
    throw new Error('Invalid script structure from LLM');
  }
  return parsed;
}

export function rethrowMappedProviderError(error: unknown): never {
  const errorMsg = getErrorMessage(error);
  if (
    errorMsg.includes('quota') ||
    errorMsg.includes('credits') ||
    errorMsg.includes('insufficient')
  ) {
    throw new ProviderQuotaExceededError('openrouter', errorMsg);
  }
  if (
    errorMsg.includes('api key') ||
    errorMsg.includes('invalid key') ||
    errorMsg.includes('unauthorized') ||
    errorMsg.includes('401')
  ) {
    throw new ProviderInvalidKeyError('openrouter', errorMsg);
  }
  throw error;
}
