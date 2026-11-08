/**
 * Key capability gate — refuses a BYOK key before an Inngest step consumes it.
 *
 * A workflow that needs tool calling and receives a key whose receipt shows
 * only text completion will fail mid-run, after the step has been charged and
 * retried. This gate turns that into a refusal at the boundary, where the
 * caller can fall back to a platform key or surface a Setup Wizard prompt.
 *
 * @module tree/byok/key-capability-gate
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  capabilitiesSatisfy,
  evaluateBudget,
  budgetVerdictMessage,
  PROVIDER_CAPABILITIES,
  type KeyBudgetState,
  type ValidationReceipt,
  type WorkflowCapabilityRequirement,
} from '@/tree/byok/validation-receipt-types';

export type KeyGateRefusal =
  | { readonly kind: 'capability_missing'; readonly requirement: WorkflowCapabilityRequirement }
  | { readonly kind: 'budget_exhausted' }
  | { readonly kind: 'cooldown_active'; readonly resumesAtUnix: number };

export interface KeyGateDecision {
  readonly allowed: boolean;
  readonly refusal?: KeyGateRefusal;
}

/** Reason-free form so callers that only log can pass it straight through. */
export const ALLOWED: KeyGateDecision = { allowed: true };

/**
 * Builds the receipt a validation pass leaves behind. The capability list comes
 * from the provider table when the probe showed no live capability signal, so
 * an unprobed provider never reads as capability-less.
 */
export function buildValidationReceipt(args: {
  provider: string;
  maskedKey: string;
  probedCapabilities?: readonly string[];
  budget: KeyBudgetState;
  nowUnix: number;
}): ValidationReceipt {
  const probed = args.probedCapabilities as
    | readonly ('json_schema' | 'tool_call' | 'vision')[]
    | undefined;
  const capabilities = probed ?? PROVIDER_CAPABILITIES[args.provider] ?? [];
  return {
    provider: args.provider,
    maskedKey: args.maskedKey,
    checkedAtUnix: args.nowUnix,
    capabilities,
    budget: args.budget,
    verdict: evaluateBudget(args.budget, args.nowUnix),
  };
}

/**
 * Decides whether a key may be used for a workflow's model call. Both a missing
 * capability and an exhausted budget refuse, because either one fails the run
 * in the same way after the same sunk cost.
 */
export function evaluateKeyForWorkflow(
  receipt: ValidationReceipt,
  requirement: WorkflowCapabilityRequirement,
  nowUnix: number,
): KeyGateDecision {
  if (!capabilitiesSatisfy(receipt.capabilities, requirement)) {
    return { allowed: false, refusal: { kind: 'capability_missing', requirement } };
  }
  const verdict = evaluateBudget(receipt.budget, nowUnix);
  if (verdict.outcome === 'budget_exhausted') {
    return { allowed: false, refusal: { kind: 'budget_exhausted' } };
  }
  if (verdict.outcome === 'cooldown_active') {
    return {
      allowed: false,
      refusal: { kind: 'cooldown_active', resumesAtUnix: verdict.resumesAtUnix },
    };
  }
  return ALLOWED;
}

/**
 * Runs the gate and logs a refusal, returning the decision for the caller to
 * act on. Logging here keeps every call site from restating the same line.
 */
export function gateKeyForWorkflow(args: {
  userId: string | null | undefined;
  provider: string;
  receipt: ValidationReceipt;
  requirement: WorkflowCapabilityRequirement;
  nowUnix: number;
  logTag: string;
}): KeyGateDecision {
  const decision = evaluateKeyForWorkflow(args.receipt, args.requirement, args.nowUnix);
  if (decision.allowed) {
    return decision;
  }
  const refusal = decision.refusal;
  if (!refusal) {
    return decision;
  }
  if (refusal.kind === 'capability_missing') {
    logger.warn(`[${args.logTag}] BYOK key refused: missing capability`, {
      userId: args.userId,
      provider: args.provider,
      requirement: refusal.requirement,
      capabilities: args.receipt.capabilities,
    });
    return decision;
  }
  const bilingual = budgetVerdictMessage(args.receipt.verdict);
  logger.warn(`[${args.logTag}] BYOK key refused: budget state`, {
    userId: args.userId,
    provider: args.provider,
    outcome: args.receipt.verdict.outcome,
  });
  logger.debug(`[${args.logTag}] ${bilingual.message} / ${bilingual.message_vi}`);
  return decision;
}
