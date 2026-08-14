import { Tier } from "@/seed/types";
import { getErrorMessage } from '@/seed/utils/to-error';
import { ProviderQuotaExceededError, ProviderInvalidKeyError } from '@/seed/services/errors';
import {
  generateMockScript,
  buildScriptUserPrompt,
  SCRIPT_SYSTEM_PROMPT,
  type AffiliateOfferCta,
  type ScriptOutput,
} from '@/seed/ai/script-prompt-builders';

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

interface ScriptGenDeps {
  resolveUserApiKey?: (userId: string | null, provider: string, fallback?: string) => Promise<string | null>;
  trackUsage?: (data: Record<string, unknown>) => Promise<void>;
  hashLicenseKey?: (key: string) => string;
  startTimer?: () => () => number;
  getUsageContext?: () => { userId?: string; licenseNonce?: string };
}

/**
 * Generates a video script using OpenRouter via resilient client.
 * Falls back to mock if API key is not configured.
 *
 * @param deps - Injected dependencies to avoid static layer-boundary imports.
 */
export async function generateScript(input: GenerateScriptInput, deps?: ScriptGenDeps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured from GenerateScriptInput
  const { topic, audience, tier, userId, licenseKey, licenseNonce, orgId, affiliateOffer } = input;
  const stopTimer = deps?.startTimer?.();

  const context = deps?.getUsageContext?.();
  const finalUserId = userId || context?.userId || 'unknown';
  const finalLicenseKey = licenseKey || '';
  const finalLicenseNonce = licenseNonce || context?.licenseNonce || 'unknown';
  const licenseKeyHash = deps?.hashLicenseKey?.(finalLicenseKey || 'unknown') || 'unknown';

  const resolvedUserId = finalUserId === 'unknown' ? null : finalUserId;
  const apiKey = deps?.resolveUserApiKey
    ? await deps.resolveUserApiKey(resolvedUserId, 'openrouter', process.env.OPENROUTER_API_KEY)
    : await import('@/tree/byok/resolve-user-api-key').then(m =>
        m.resolveUserApiKey(resolvedUserId, 'openrouter', process.env.OPENROUTER_API_KEY)
      );

  if (!apiKey) {
    const mockResult = generateMockScript(topic, audience);
    if (deps?.trackUsage) {
      await deps.trackUsage({
        userId: finalUserId,
        licenseKeyHash: 'mock',
        licenseNonce: finalLicenseNonce,
        service: 'openrouter',
        endpoint: '/mock',
        action: 'chat_completion_mock',
        creditsUsed: 1,
        tierAtRequest: tier,
        statusCode: 200,
        responseTimeMs: stopTimer?.(),
      });
    }
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

    const responseTime = stopTimer?.() ?? 0;

    let parsed: ScriptOutput;
    try {
      parsed = JSON.parse(content) as ScriptOutput;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- catch block for JSON parse failure
    } catch (e) {
      if (deps?.trackUsage) {
        await deps.trackUsage({
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
      }
      throw new Error('Invalid JSON from LLM');
    }

    if (deps?.trackUsage) {
      await deps.trackUsage({
        userId: finalUserId,
        licenseKeyHash,
        licenseNonce: finalLicenseNonce,
        service: 'openrouter',
        endpoint: '/chat/completions',
        action: 'chat_completion',
        tierAtRequest: tier,
        statusCode: 200,
        responseTimeMs: responseTime,
        creditsUsed: 1,
      });
    }

    const validated = parsed as unknown as { title: string; scenes: Array<{ narration: string }> };
    if (!validated.title || !Array.isArray(validated.scenes) || validated.scenes.length === 0) {
      throw new Error('Invalid script format from API');
    }

    return parsed as ScriptOutput;

  } catch (error) {
    const responseTime = stopTimer?.() ?? 0;
    if (deps?.trackUsage) {
      await deps.trackUsage({
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
    }

    if (error instanceof ProviderInvalidKeyError || error instanceof ProviderQuotaExceededError) {
      throw error;
    }
    return generateMockScript(topic, audience);
  }
}
