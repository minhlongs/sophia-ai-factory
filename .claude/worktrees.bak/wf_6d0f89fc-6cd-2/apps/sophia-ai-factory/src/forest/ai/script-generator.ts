import { Tier } from "@/seed/types";
import { getErrorMessage } from '@/seed/utils/to-error';
import { trackUsage, hashLicenseKey, startTimer } from '@/forest/usage-metering';
import { getUsageContext } from '@/forest/usage-metering/context';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { ProviderQuotaExceededError, ProviderInvalidKeyError } from '@/seed/services/errors';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import {
  generateMockScript,
  buildScriptUserPrompt,
  SCRIPT_SYSTEM_PROMPT,
  type AffiliateOfferCta,
} from './script-prompt-builders';

export type { ScriptOutput } from './script-prompt-builders';

export function selectModelForTier(tier: Tier): string {
  return tier === 'ENTERPRISE' ? 'anthropic/claude-3.5-sonnet' : 'openai/gpt-4o-mini';
}

interface GenerateScriptInput {
  topic: string;
  audience: string;
  tier: Tier;
  userId?: string;
  licenseKey?: string;
  licenseNonce?: string;
  /** Tenant scope for LLM cache (Phase 4F). Empty/omitted → cache skipped. */
  orgId?: string;
  /** Optional affiliate offer — injects CTA into last scene of generated script. */
  affiliateOffer?: AffiliateOfferCta;
}

/**
 * Generates a video script using OpenRouter API.
 * Falls back to mock if API key is not configured.
 */
export async function generateScript(input: GenerateScriptInput) {
  const { topic, audience, tier, userId, licenseKey, licenseNonce, orgId, affiliateOffer } = input;
  const stopTimer = startTimer();

  const context = getUsageContext();
  const finalUserId = userId || context?.userId || 'unknown';
  const finalLicenseKey = licenseKey || '';
  const finalLicenseNonce = licenseNonce || context?.licenseNonce || 'unknown';
  const licenseKeyHash = hashLicenseKey(finalLicenseKey || 'unknown');

  // Phase 7B: BYOK — prefer user's stored OpenRouter key; fallback to env key.
  const resolvedUserId = finalUserId === 'unknown' ? null : finalUserId;
  const apiKey = await resolveUserApiKey(
    resolvedUserId,
    'openrouter',
    process.env.OPENROUTER_API_KEY,
  );

  if (!apiKey) {
    const mockResult = generateMockScript(topic, audience);
    await trackUsage({
      userId: finalUserId,
      licenseKeyHash: 'mock',
      licenseNonce: finalLicenseNonce,
      service: 'openrouter',
      endpoint: '/mock',
      action: 'chat_completion_mock',
      creditsUsed: 1,
      tierAtRequest: tier,
      statusCode: 200,
      responseTimeMs: stopTimer(),
    });
    return mockResult;
  }

  try {
    const model = selectModelForTier(tier);
    const messages = [
      { role: 'system', content: SCRIPT_SYSTEM_PROMPT },
      { role: 'user',   content: buildScriptUserPrompt(topic, audience, affiliateOffer) },
    ];

    const content = await resilientChatCompletion(
      messages.map(m => `${m.role === 'user' ? 'User' : 'System'}: ${m.content}`).join('\n\n'),
      {
        openRouterKey: apiKey,
        anthropicKey: undefined,
        enableFallback: false,
        model,
      }
    );

    const responseTime = stopTimer();

    // Track basic usage success
    await trackUsage({
      userId: finalUserId,
      licenseKeyHash,
      licenseNonce: finalLicenseNonce,
      service: 'openrouter',
      endpoint: '/chat/completions',
      action: 'chat_completion',
      tierAtRequest: tier,
      statusCode: 200,
      responseTimeMs: responseTime,
      creditsUsed: 1, // rough estimate
    });

    const parsed = JSON.parse(content) as import('./script-prompt-builders').ScriptOutput;

    if (!parsed.title || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      throw new Error('Invalid script format from API');
    }

    return parsed;

  } catch (error) {
    await trackUsage({
      userId: finalUserId,
      licenseKeyHash: licenseKeyHash,
      licenseNonce: finalLicenseNonce,
      service: 'openrouter',
      endpoint: '/chat/completions',
      action: 'chat_completion',
      tierAtRequest: tier,
      errorMessage: getErrorMessage(error),
      responseTimeMs: stopTimer(),
      creditsUsed: 0,
    });

    return generateMockScript(topic, audience);
  }
}
