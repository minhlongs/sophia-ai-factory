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
  durationSec?: number;
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
  /** Validate caller-specific scene requirements before recording billable success. */
  minScenes?: number;
  resolveUserApiKey?: ApiKeyResolver;
  /** Explicit customer funding bypasses platform fallback and demo output. */
  funding?: { fund: 'byok'; apiKey: string };
  /** Explicit bounded provider options (used by private pilot cost containment). */
  model?: string;
  maxTokens?: number;
  maxRetries?: number;
  timeoutMs?: number;
  referer?: string;
  trackUsage?: (data: Record<string, unknown>) => Promise<void>;
  hashLicenseKey?: (key: string) => string;
  startTimer?: () => () => number;
  getUsageContext?: () => { userId?: string; licenseNonce?: string };
}

export async function resolveScriptApiKey(
  resolvedUserId: string | null,
  resolveKey: ApiKeyResolver | null | undefined,
): Promise<string | null> {
  if (!resolveKey) return null;
  try {
    // Fail closed to customer BYOK — never fall back to platform OPENROUTER_API_KEY.
    return await resolveKey(resolvedUserId, 'openrouter');
  } catch {
    return null;
  }
}

export interface ValidateScriptOptions {
  minScenes?: number;
  targetDurationSec?: number;
}

export class InvalidScriptStructureError extends Error {
  constructor(reason: string) {
    super(`Invalid script structure: ${reason}`);
    this.name = 'InvalidScriptStructureError';
  }
}

/**
 * Parses LLM script output into a JSON value, tolerating markdown code fences
 * (` ```json ... ``` `) and brief surrounding prose returned by live models.
 */
export function parseScriptJsonFromLlm(rawContent: string): unknown {
  const trimmed = rawContent.trim();
  if (!trimmed) {
    throw new Error('Invalid JSON from LLM');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through to markdown code-fence / outer-object extraction
  }

  for (const match of trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    const candidate = match[1]?.trim();
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // Try next fenced block
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {
      // Fall through to canonical error
    }
  }

  throw new Error('Invalid JSON from LLM');
}

export function validateParsedScriptStructure(
  parsed: unknown,
  options?: ValidateScriptOptions,
): ScriptOutput {
  if (!parsed || typeof parsed !== 'object') {
    throw new InvalidScriptStructureError('response must be a JSON object');
  }

  const candidate = parsed as Record<string, unknown>;
  const rawTitle = candidate.title;
  if (typeof rawTitle !== 'string' || rawTitle.trim().length === 0) {
    throw new InvalidScriptStructureError('title must be a non-empty string');
  }

  const minScenes = options?.minScenes ?? 1;
  if (!Array.isArray(candidate.scenes) || candidate.scenes.length < minScenes) {
    throw new InvalidScriptStructureError(
      `scenes must be an array with at least ${minScenes} scene(s)`,
    );
  }

  const validatedScenes: ScriptOutput['scenes'] = [];

  for (let i = 0; i < candidate.scenes.length; i++) {
    const rawScene = candidate.scenes[i];
    if (!rawScene || typeof rawScene !== 'object') {
      throw new InvalidScriptStructureError(`scene[${i}] must be an object`);
    }
    const scene = rawScene as Record<string, unknown>;

    const sceneNumber = scene.scene_number;
    if (
      typeof sceneNumber !== 'number' ||
      !Number.isFinite(sceneNumber) ||
      !Number.isInteger(sceneNumber) ||
      sceneNumber < 1
    ) {
      throw new InvalidScriptStructureError(
        `scene[${i}].scene_number must be an integer >= 1`,
      );
    }

    const visualDescription = scene.visual_description;
    if (typeof visualDescription !== 'string' || visualDescription.trim().length === 0) {
      throw new InvalidScriptStructureError(
        `scene[${i}].visual_description must be a non-empty string`,
      );
    }

    const narration = scene.narration;
    if (typeof narration !== 'string' || narration.trim().length === 0) {
      throw new InvalidScriptStructureError(
        `scene[${i}].narration must be a non-empty string`,
      );
    }

    const durationEstimate = scene.duration_estimate;
    if (
      typeof durationEstimate !== 'number' ||
      !Number.isFinite(durationEstimate) ||
      durationEstimate <= 0
    ) {
      throw new InvalidScriptStructureError(
        `scene[${i}].duration_estimate must be a positive finite number`,
      );
    }

    const rawSceneTitle = scene.title;
    let optionalSceneTitle: string | undefined;
    if (rawSceneTitle !== undefined && rawSceneTitle !== null) {
      if (typeof rawSceneTitle !== 'string') {
        throw new InvalidScriptStructureError(`scene[${i}].title must be a string when provided`);
      }
      const trimmedSceneTitle = rawSceneTitle.trim();
      if (trimmedSceneTitle.length > 200) {
        throw new InvalidScriptStructureError(`scene[${i}].title must not exceed 200 characters`);
      }
      if (trimmedSceneTitle.length > 0) {
        optionalSceneTitle = trimmedSceneTitle;
      }
    }

    validatedScenes.push({
      scene_number: sceneNumber,
      ...(optionalSceneTitle ? { title: optionalSceneTitle } : {}),
      visual_description: visualDescription.trim(),
      narration: narration.trim(),
      duration_estimate: durationEstimate,
    });
  }

  const rawTotalDuration = candidate.total_duration;
  if (
    typeof rawTotalDuration !== 'number' ||
    !Number.isFinite(rawTotalDuration) ||
    rawTotalDuration <= 0
  ) {
    throw new InvalidScriptStructureError(
      'total_duration must be a positive finite number',
    );
  }

  if (options?.targetDurationSec !== undefined) {
    const target = options.targetDurationSec;
    if (typeof target !== 'number' || !Number.isFinite(target) || target <= 0) {
      throw new InvalidScriptStructureError('targetDurationSec must be a positive finite number');
    }
    const minDuration = Math.max(5, target * 0.5);
    const maxDuration = target * 1.5;
    if (rawTotalDuration < minDuration || rawTotalDuration > maxDuration) {
      throw new InvalidScriptStructureError(
        `total_duration (${rawTotalDuration}s) is outside allowed range ${minDuration}-${maxDuration}s for target ${target}s`,
      );
    }
  }

  return {
    title: rawTitle.trim(),
    scenes: validatedScenes,
    total_duration: rawTotalDuration,
  };
}

export function rethrowMappedProviderError(error: unknown): never {
  if (error instanceof InvalidScriptStructureError) {
    throw error;
  }
  const errorMsg = getErrorMessage(error);
  const lower = errorMsg.toLowerCase();
  if (
    lower.includes('quota') ||
    lower.includes('credits') ||
    lower.includes('insufficient') ||
    lower.includes('key limit') ||
    lower.includes('http 402')
  ) {
    throw new ProviderQuotaExceededError('openrouter', errorMsg);
  }
  if (
    lower.includes('api key') ||
    lower.includes('invalid key') ||
    lower.includes('unauthorized') ||
    lower.includes('http 401') ||
    lower.includes('http 403')
  ) {
    throw new ProviderInvalidKeyError('openrouter', errorMsg);
  }
  throw error;
}
