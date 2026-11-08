/**
 * ValidationReceipt — BYOK capability mask and budget cap contracts.
 *
 * A key that authenticates is not necessarily usable for the work a workflow
 * needs: a read-scoped OpenRouter key proves identity at the auth endpoint but
 * cannot complete tool calls the production graph performs. This module names
 * the capabilities a provider must show and the budget a key must have left, so
 * a workflow can refuse a key before it consumes an Inngest step.
 *
 * Pure types and predicates only — no I/O, so the policy can be tested and read
 * without a database or a live provider.
 *
 * @module tree/byok/validation-receipt-types
 */

import type { ByokProvider } from '@/tree/byok/user-api-key-store';

/**
 * What a key must be able to do, not merely what it authenticates against.
 * `json_schema` covers structured output, `tool_call` covers function/tool
 * calling, `vision` covers image input. A provider that cannot do all three is
 * not a substitute for one that can.
 */
export type KeyCapability = 'json_schema' | 'tool_call' | 'vision';

/**
 * The minimum a workflow's model call needs. Workflows declare a requirement
 * rather than consulting a provider's marketing, so the refusal is explicit at
 * the call site.
 */
export type WorkflowCapabilityRequirement =
  | 'text_completion'
  | 'json_schema'
  | 'tool_call'
  | 'vision';

export interface KeyBudgetState {
  /** Cap in USD the user set for this key per calendar month, or null if none. */
  readonly monthlyBudgetUsd: number | null;
  /** USD already spent this calendar month against this key. */
  readonly monthSpentUsd: number;
  /** Unix seconds after which a throttled key resumes, or null when active. */
  readonly cooldownUntil: number | null;
}

export type BudgetVerdict =
  | { readonly outcome: 'within_budget'; readonly remainingUsd: number | null }
  | { readonly outcome: 'no_cap_set' }
  | { readonly outcome: 'budget_exhausted'; readonly remainingUsd: number }
  | { readonly outcome: 'cooldown_active'; readonly resumesAtUnix: number };

export type KeyPolicyStatus = 'found' | 'absent' | 'unreadable';

/**
 * The receipt a validation pass leaves behind: what the provider proved, what
 * the key can do, and what may be spent with it.
 */
export interface ValidationReceipt {
  readonly provider: ByokProvider | string;
  readonly maskedKey: string;
  readonly checkedAtUnix: number;
  /** Capabilities the key demonstrated or that the provider is known to serve. */
  readonly capabilities: readonly KeyCapability[];
  readonly budget: KeyBudgetState;
  readonly verdict: BudgetVerdict;
  /** Whether the key's stored policy row was found, absent, or unreadable. */
  readonly policyStatus?: KeyPolicyStatus;
}

/** Capabilities each provider is known to serve, absent a live capability probe. */
export const PROVIDER_CAPABILITIES: Readonly<Record<string, readonly KeyCapability[]>> = {
  openrouter: ['json_schema', 'tool_call', 'vision'],
  anthropic: ['json_schema', 'tool_call', 'vision'],
  'fal-ai': ['json_schema'],
  elevenlabs: [],
  'd-id': [],
  heygen: [],
  replicate: ['json_schema'],
  muapi: ['json_schema'],
  apollo: [],
  hunter: [],
};

/**
 * Resolves what a month of spend has left under the key's cap. An absent cap
 * means the user has not set one, which is a distinct verdict from a cap that
 * is exhausted: the first is a prompt to set one, the second is a refusal.
 */
export function evaluateBudget(state: KeyBudgetState, nowUnix: number): BudgetVerdict {
  if (state.cooldownUntil !== null && state.cooldownUntil > nowUnix) {
    return { outcome: 'cooldown_active', resumesAtUnix: state.cooldownUntil };
  }
  if (state.monthlyBudgetUsd === null) {
    return { outcome: 'no_cap_set' };
  }
  const remaining = Math.round((state.monthlyBudgetUsd - state.monthSpentUsd) * 100) / 100;
  if (remaining <= 0) {
    return { outcome: 'budget_exhausted', remainingUsd: 0 };
  }
  return { outcome: 'within_budget', remainingUsd: remaining };
}

/**
 * True when the key's capabilities cover what the workflow needs. A text-only
 * need is always covered: refusing it would break providers with no structured
 * output at all, which is a different question from tool calling.
 */
export function capabilitiesSatisfy(
  capabilities: readonly KeyCapability[],
  requirement: WorkflowCapabilityRequirement,
): boolean {
  if (requirement === 'text_completion') return true;
  return capabilities.includes(requirement as KeyCapability);
}

/** The user-facing explanation for a refusal, bilingual per the client profile. */
export function budgetVerdictMessage(verdict: BudgetVerdict): {
  message: string;
  message_vi: string;
} {
  switch (verdict.outcome) {
    case 'budget_exhausted':
      return {
        message: `This key has used its monthly budget ($${verdict.remainingUsd.toFixed(2)} left)`,
        message_vi: 'Khóa này đã dùng hết hạn mức trong tháng',
      };
    case 'cooldown_active':
      return {
        message: 'This key is cooling down after repeated provider errors',
        message_vi: 'Khóa này đang tạm nghỉ sau nhiều lỗi liên tiếp',
      };
    default:
      return {
        message: 'Budget state unavailable for this key',
        message_vi: 'Chưa rõ tình trạng hạn mức của khóa này',
      };
  }
}
