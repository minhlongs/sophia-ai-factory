/**
 * Tiered BYOK Model Router — cost-optimized OpenRouter routing with 3-layer resilience.
 * @module tree/byok/tiered-byok-router
 */

import { recordFailure, recordSuccess, shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { FailureKind } from '@/seed/types/failure-kind';
import { failure, success, type Result } from '@/seed/types/result';
import { capabilitiesSatisfy } from './validation-receipt-types';
import {
  BLENDED_COST_PER_1M_USD,
  COMPACT_FALLBACK_MODEL,
  COMPACT_PRIMARY_MODEL,
  DEFAULT_MODEL_LOCKOUT_MS,
  FRONTIER_FALLBACK_MODEL,
  FRONTIER_PRIMARY_MODEL,
  type ByokTierUsed,
  type SanitizeToolChoiceInput,
  type SanitizedToolPayload,
  type SelectTieredByokRouteInput,
  type TieredByokRouteSelection,
  type ToolChoiceRefusalError,
} from './tiered-byok-router-types';

const modelLockouts = new Map<string, number>();
const lockoutKey = (model: string, keyRef = 'default'): string => `${keyRef}::${model}`;

/** Defaults to `true` unless `envFlag` or `ENABLE_TIERED_BYOK_ROUTER` is `'false'` or `'0'`. */
export function isTieredByokRouterEnabled(envFlag?: string): boolean {
  const raw = (envFlag ?? process.env.ENABLE_TIERED_BYOK_ROUTER)?.trim().toLowerCase();
  return raw !== 'false' && raw !== '0';
}

/** Locks out a failing or throttled model for `durationMs` so traffic shifts to secondary. */
export function recordModelLockout(
  model: string,
  durationMs = DEFAULT_MODEL_LOCKOUT_MS,
  keyRef?: string,
  nowMs = Date.now(),
): number {
  const expiresAtMs = nowMs + Math.max(1, durationMs);
  modelLockouts.set(lockoutKey(model, keyRef), expiresAtMs);
  return expiresAtMs;
}

/** True when the given model is currently within an active lockout window. */
export function isModelLockedOut(model: string, keyRef?: string, nowMs = Date.now()): boolean {
  const key = lockoutKey(model, keyRef);
  const expiresAt = modelLockouts.get(key);
  if (expiresAt === undefined) return false;
  if (expiresAt <= nowMs) {
    modelLockouts.delete(key);
    return false;
  }
  return true;
}

/** Clears active model lockouts globally or for a specific `keyRef`. */
export function clearModelLockouts(keyRef?: string): void {
  if (keyRef === undefined) {
    modelLockouts.clear();
    return;
  }
  const prefix = `${keyRef}::`;
  for (const key of modelLockouts.keys()) {
    if (key.startsWith(prefix)) modelLockouts.delete(key);
  }
}

/** Records upstream outcome into both provider circuit breaker and per-model lockout state. */
export function recordTieredRouteOutcome(args: {
  readonly provider?: string;
  readonly keyRef?: string;
  readonly model: string;
  readonly ok: boolean;
  readonly failureKind?: FailureKind;
  readonly lockoutMs?: number;
}): void {
  const provider = args.provider ?? 'openrouter';
  if (args.ok) {
    recordSuccess(provider, args.keyRef);
    return;
  }
  const kind = args.failureKind ?? FailureKind.SERVER_ERROR;
  recordFailure(provider, kind, args.keyRef);
  if (
    kind === FailureKind.RATE_LIMIT ||
    kind === FailureKind.SERVER_ERROR ||
    kind === FailureKind.TIMEOUT ||
    kind === FailureKind.NETWORK
  ) {
    recordModelLockout(args.model, args.lockoutMs ?? DEFAULT_MODEL_LOCKOUT_MS, args.keyRef);
  }
}

function computeCompactSavingsPct(model: string): number {
  const frontierCost = BLENDED_COST_PER_1M_USD[FRONTIER_PRIMARY_MODEL] ?? 6.0;
  const candidateCost = BLENDED_COST_PER_1M_USD[model] ?? 1.8;
  return Math.max(55, Math.min(99, Math.round(((frontierCost - candidateCost) / frontierCost) * 100)));
}

function resolveTierCandidates(input: SelectTieredByokRouteInput, baseline: string) {
  const isCompact = input.taskKind === 'json_extraction' || input.taskKind === 'qa_validation';
  const primary = isCompact ? COMPACT_PRIMARY_MODEL : baseline;
  const secondary = isCompact
    ? COMPACT_FALLBACK_MODEL
    : primary === FRONTIER_PRIMARY_MODEL ? FRONTIER_FALLBACK_MODEL : FRONTIER_PRIMARY_MODEL;
  const tier: ByokTierUsed = isCompact ? 'compact' : 'frontier';
  const cacheHint = !isCompact && input.systemPromptCacheable ? { cacheControl: 'ephemeral' as const } : {};
  return { isCompact, primary, secondary, tier, cacheHint };
}

function resolveTimestamps(input: SelectTieredByokRouteInput): { nowMs: number; nowUnix: number } {
  const wallMs = Date.now();
  const nowMs = input.nowMs ?? (input.nowUnix !== undefined ? input.nowUnix * 1000 : wallMs);
  const nowUnix = input.nowUnix ?? Math.floor(nowMs / 1000);
  return { nowMs, nowUnix };
}

/** Selects the optimal BYOK model tier and fallback while enforcing 3-layer resilience. */
export function selectTieredByokRoute(input: SelectTieredByokRouteInput): TieredByokRouteSelection {
  const baseline = input.baselineModel || FRONTIER_PRIMARY_MODEL;
  if (!isTieredByokRouterEnabled(input.envFlag)) {
    return {
      model: baseline, fallbackModel: null, tierUsed: 'direct_fallback',
      reason: 'router_disabled', resilientAllowed: true, estimatedSavingsPct: 0,
    };
  }

  const { isCompact, primary, secondary, tier, cacheHint } = resolveTierCandidates(input, baseline);
  const { nowMs, nowUnix } = resolveTimestamps(input);

  if (!shouldAllowRequest(input.provider ?? 'openrouter', input.keyRef)) {
    return {
      model: secondary, fallbackModel: null, tierUsed: 'direct_fallback',
      reason: 'circuit_breaker_open', resilientAllowed: false, estimatedSavingsPct: 0, ...cacheHint,
    };
  }
  if (input.budget?.cooldownUntil != null && input.budget.cooldownUntil > nowUnix) {
    return {
      model: secondary, fallbackModel: null, tierUsed: 'direct_fallback',
      reason: 'key_cooldown_active', resilientAllowed: false, estimatedSavingsPct: 0, ...cacheHint,
    };
  }
  if (!isModelLockedOut(primary, input.keyRef, nowMs)) {
    return {
      model: primary, fallbackModel: secondary, tierUsed: tier,
      reason: 'primary_selected', resilientAllowed: true,
      estimatedSavingsPct: isCompact ? computeCompactSavingsPct(primary) : 0, ...cacheHint,
    };
  }

  const secondaryLocked = isModelLockedOut(secondary, input.keyRef, nowMs);
  return {
    model: secondary, fallbackModel: null, tierUsed: tier,
    reason: secondaryLocked ? 'all_candidates_locked_out' : 'primary_locked_out_fallback',
    resilientAllowed: !secondaryLocked,
    estimatedSavingsPct: isCompact ? computeCompactSavingsPct(secondary) : 0, ...cacheHint,
  };
}

/** Enforces `tool_call` capability before sending `tools` / `tool_choice` upstream. */
export function sanitizeToolChoiceForRoute<TTool>(
  input: SanitizeToolChoiceInput<TTool>,
): Result<SanitizedToolPayload<TTool>, ToolChoiceRefusalError> {
  if (!input.tools || input.tools.length === 0) {
    return success({ tools: undefined, toolChoice: undefined, stripped: false });
  }
  const requestedChoice = input.toolChoice ?? 'auto';
  if (requestedChoice === 'none') {
    return success({ tools: undefined, toolChoice: 'none', stripped: false });
  }
  if (capabilitiesSatisfy(input.capabilities, 'tool_call')) {
    return success({ tools: input.tools, toolChoice: requestedChoice, stripped: false });
  }
  if (input.allowToolStrip) {
    return success({ tools: undefined, toolChoice: undefined, stripped: true });
  }
  return failure({
    code: 'TOOL_CALL_UNSUPPORTED',
    message: 'Configured model or API key does not support tool calling',
    message_vi: 'Mô hình hoặc khóa API hiện tại không hỗ trợ gọi công cụ (tool_call)',
  });
}
