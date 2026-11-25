import {
  generateMockScript,
  buildScriptUserPrompt,
  SCRIPT_SYSTEM_PROMPT,
  type ScriptOutput,
} from '@/seed/ai/script-prompt-builders';
import {
  selectModelForTier,
  resolveScriptApiKey,
  parseScriptJsonFromLlm,
  validateParsedScriptStructure,
  rethrowMappedProviderError,
  type GenerateScriptInput,
  type ApiKeyResolver,
  type ScriptGenDeps,
} from './script-generator-helpers';

export type { ScriptOutput } from './script-prompt-builders';
export {
  selectModelForTier,
  parseScriptJsonFromLlm,
  validateParsedScriptStructure,
  InvalidScriptStructureError,
  type GenerateScriptInput,
  type ApiKeyResolver,
  type ValidateScriptOptions,
} from './script-generator-helpers';

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
  const {
    topic,
    audience,
    tier,
    durationSec,
    userId,
    licenseKey,
    licenseNonce,
    orgId: _orgId,
    affiliateOffer,
    steering,
  } = input;
  const stopTimer = deps?.startTimer?.();

  const context = deps?.getUsageContext?.();
  const finalUserId = userId || context?.userId || 'unknown';
  const finalLicenseKey = licenseKey || '';
  const finalLicenseNonce = licenseNonce || context?.licenseNonce || 'unknown';
  const licenseKeyHash = deps?.hashLicenseKey?.(finalLicenseKey || 'unknown') || 'unknown';

  const resolvedUserId = finalUserId === 'unknown' ? null : finalUserId;
  const resolveKey = deps?.resolveUserApiKey ?? globalApiKeyResolver;
  const apiKey = deps?.funding
    ? deps.funding.apiKey.trim()
    : await resolveScriptApiKey(resolvedUserId, resolveKey);
  if (deps?.funding && !apiKey) {
    throw new Error('Customer OpenRouter key is required');
  }

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

  const model = deps?.model ?? selectModelForTier(tier);
  const messages = [
    { role: 'system', content: SCRIPT_SYSTEM_PROMPT },
    { role: 'user',   content: buildScriptUserPrompt(topic, audience, affiliateOffer, steering, durationSec) },
  ];

  try {
    const content = await (await import('@/seed/inference/openrouter-client')).resilientChatCompletion(
      messages.map(m => `${m.role === 'user' ? 'User' : 'System'}: ${m.content}`).join('\n\n'),
      {
        openRouterKey: apiKey,
        anthropicKey: undefined,
        enableFallback: false,
        model,
        maxTokens: deps?.maxTokens,
        maxRetries: deps?.maxRetries,
        timeoutMs: deps?.timeoutMs,
        referer: deps?.referer,
        circuitKeyRef: deps?.funding?.fund === 'byok' ? `byok:${finalUserId}` : undefined,
      },
    );

    const responseTime = stopTimer?.() ?? 0;

    let parsed: unknown;
    try {
      parsed = parseScriptJsonFromLlm(content);
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

    let validated: ScriptOutput;
    try {
      validated = validateParsedScriptStructure(parsed, {
        minScenes: deps?.minScenes,
        targetDurationSec: durationSec,
      });
    } catch (validationError) {
      if (deps?.trackUsage) {
        await deps.trackUsage({
          userId: finalUserId,
          licenseKeyHash,
          licenseNonce: finalLicenseNonce,
          service: 'openrouter',
          endpoint: '/chat/completions',
          action: 'chat_completion',
          tierAtRequest: tier,
          errorMessage:
            validationError instanceof Error
              ? validationError.message
              : 'Invalid script structure',
          responseTimeMs: responseTime,
          creditsUsed: 0,
        });
      }
      throw validationError;
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

    return validated;
  } catch (error) {
    rethrowMappedProviderError(error);
  }
}
