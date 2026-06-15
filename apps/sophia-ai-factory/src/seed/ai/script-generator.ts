import { Tier } from "@/seed/types";
import { getErrorMessage } from '@/seed/utils/to-error';
import { trackUsage, hashLicenseKey, startTimer } from '@/forest/usage-metering';
import { getUsageContext } from '@/forest/usage-metering/context';
import { callWithCache } from '@/land/llm/cache/call-with-cache';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { ProviderQuotaExceededError, ProviderInvalidKeyError } from '@/land/services/errors';
import {
  generateMockScript,
  buildScriptUserPrompt,
  SCRIPT_SYSTEM_PROMPT,
  type AffiliateOfferCta,
  type ScriptOutput,
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
  orgId?: string;
  affiliateOffer?: AffiliateOfferCta;
}

/**
 * Generates a video script using OpenRouter via resilient client.
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

  const model = selectModelForTier(tier);
  const messages = [
    { role: 'system', content: SCRIPT_SYSTEM_PROMPT },
    { role: 'user',   content: buildScriptUserPrompt(topic, audience, affiliateOffer) },
  ];

  try {
    const content = await (await import('@/seed/inference/openrouter-client')).resilientChatCompletion(
      messages.map(m => `${m.role === 'user' ? 'User' : 'System'}: ${m.content}`).join('\n\n'),
      {
        openRouterKey: apiKey,
        anthropicKey: undefined,
        enableFallback: false,
        model,
      }
    );

    const responseTime = stopTimer();

    // Try parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      await trackUsage({
        userId: finalUserId,
        licenseKeyHash,
        licenseNonce: finalLicenseNonce,
        service: 'openrouter',
        endpoint: '/chat/completions',
        action: 'chat_completion',
        tierAtRequest: tier,
        errorMessage: 'JSON parse failed',
        responseTimeMs: responseTime,
        creditsUsed: 0,
      });
      throw new Error('Invalid JSON from LLM');
    }

    // Minimal tracking on success
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

    // Validate structure (type narrowing)
    const validated = parsed as unknown as { title: string; scenes: Array<{ narration: string }> };
    if (!validated.title || !Array.isArray(validated.scenes) || validated.scenes.length === 0) {
      throw new Error('Invalid script format from API');
    }

    return parsed as ScriptOutput;

  } catch (error) {
    const responseTime = stopTimer();
    await trackUsage({
      userId: finalUserId,
      licenseKeyHash,
      licenseNonce: finalLicenseNonce,
      service: 'openrouter',
      endpoint: '/chat/completions',
      action: 'chat_completion',
      tierAtRequest: tier,
      errorMessage: getErrorMessage(error),
      responseTimeMs: responseTime,
      creditsUsed: 0,
    });

    // Determine if we should throw or fallback to mock
    if (error instanceof ProviderInvalidKeyError || error instanceof ProviderQuotaExceededError) {
      throw error; // Let caller handle auth/rate errors
    }
    return generateMockScript(topic, audience);
  }
}
