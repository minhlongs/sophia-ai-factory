import { Tier } from "@/seed/types";
import { getErrorMessage } from '@/seed/utils/to-error';
import { trackUsage, hashLicenseKey, calculateCredits, startTimer } from '@/forest/usage-metering';
import { getUsageContext } from '@/forest/usage-metering/context';
import { callWithCache } from '@/lib/llm/cache/call-with-cache';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { ProviderQuotaExceededError, ProviderInvalidKeyError } from '@/lib/services/errors';
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

    const cached = await callWithCache(
      { provider: 'openrouter', model, messages, orgId: orgId ?? '' },
      async () => {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network',
            'X-Title':      'Sophia AI Factory',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens:  1000,
          }),
        });

        const responseTime = stopTimer();

        if (!response.ok) {
          const errorText = await response.text();
          await trackUsage({
            userId:         finalUserId,
            licenseKeyHash,
            licenseNonce:   finalLicenseNonce,
            service:        'openrouter',
            endpoint:       '/chat/completions',
            action:         'chat_completion',
            tierAtRequest:  tier,
            statusCode:     response.status,
            errorMessage:   errorText,
            responseTimeMs: responseTime,
            creditsUsed:    0,
          });
          if (response.status === 401 || response.status === 403) {
            throw new ProviderInvalidKeyError('openrouter', errorText);
          }
          if (response.status === 429 || response.status === 402) {
            throw new ProviderQuotaExceededError('openrouter', errorText);
          }
          throw new Error(`OpenRouter API failed: ${response.status}`);
        }

        const data = await response.json() as {
          choices?: { message?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
          model?: string;
          id?: string;
        };
        const content = data.choices?.[0]?.message?.content;

        if (!content) throw new Error('No content in OpenRouter response');

        const usage = data.usage;
        const tokensTotal = (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0);

        await trackUsage({
          userId:         finalUserId,
          licenseKeyHash,
          licenseNonce:   finalLicenseNonce,
          service:        'openrouter',
          endpoint:       '/chat/completions',
          action:         'chat_completion',
          tokensInput:    usage?.prompt_tokens     ?? 0,
          tokensOutput:   usage?.completion_tokens ?? 0,
          creditsUsed:    calculateCredits('openrouter', 'chatCompletion', tokensTotal, tier),
          modelName:      data.model,
          requestId:      data.id,
          tierAtRequest:  tier,
          statusCode:     response.status,
          responseTimeMs: responseTime,
        });

        return {
          response:     content as string,
          inputTokens:  usage?.prompt_tokens     ?? 0,
          outputTokens: usage?.completion_tokens ?? 0,
        };
      },
    );

    const parsed = JSON.parse(cached.response) as import('./script-prompt-builders').ScriptOutput;

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
