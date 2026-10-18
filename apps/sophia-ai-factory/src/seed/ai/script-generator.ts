import {
  generateMockScript,
  buildScriptUserPrompt,
  SCRIPT_SYSTEM_PROMPT,
  type ScriptOutput,
} from '@/seed/ai/script-prompt-builders';
import {
  selectModelForTier,
  resolveScriptApiKey,
  validateParsedScriptStructure,
  rethrowMappedProviderError,
  type GenerateScriptInput,
  type ApiKeyResolver,
  type ScriptGenDeps,
} from './script-generator-helpers';

export type { ScriptOutput } from './script-prompt-builders';
export { selectModelForTier, type GenerateScriptInput, type ApiKeyResolver } from './script-generator-helpers';

let globalApiKeyResolver: ApiKeyResolver | null = null;

export function registerApiKeyResolver(resolver: ApiKeyResolver | null): void {
  globalApiKeyResolver = resolver;
}

/**
 * Generates a video script using OpenRouter via resilient client.
 * Falls back to mock if API key is not configured.
 *
 * @param deps - Injected dependencies to avoid static layer-boundary imports.
 */
export async function generateScript(input: GenerateScriptInput, deps?: ScriptGenDeps) {
  const { topic, audience, tier, userId, licenseKey, licenseNonce, orgId: _orgId, affiliateOffer, steering } = input;
  const stopTimer = deps?.startTimer?.();

  const context = deps?.getUsageContext?.();
  const finalUserId = userId || context?.userId || 'unknown';
  const finalLicenseKey = licenseKey || '';
  const finalLicenseNonce = licenseNonce || context?.licenseNonce || 'unknown';
  const licenseKeyHash = deps?.hashLicenseKey?.(finalLicenseKey || 'unknown') || 'unknown';

  const resolvedUserId = finalUserId === 'unknown' ? null : finalUserId;
  const resolveKey = deps?.resolveUserApiKey ?? globalApiKeyResolver;
  const apiKey = await resolveScriptApiKey(resolvedUserId, resolveKey);

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
    { role: 'user',   content: buildScriptUserPrompt(topic, audience, affiliateOffer, steering) },
  ];

  try {
    const content = await (await import('@/seed/inference/openrouter-client')).resilientChatCompletion(
      messages.map(m => `${m.role === 'user' ? 'User' : 'System'}: ${m.content}`).join('\n\n'),
      {
        openRouterKey: apiKey,
        anthropicKey: undefined,
        enableFallback: false,
        model,
      },
    );

    const responseTime = stopTimer?.() ?? 0;

    let parsed: ScriptOutput;
    try {
      parsed = JSON.parse(content) as ScriptOutput;
    } catch {
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

    return validateParsedScriptStructure(parsed);
  } catch (error) {
    rethrowMappedProviderError(error);
  }
}
