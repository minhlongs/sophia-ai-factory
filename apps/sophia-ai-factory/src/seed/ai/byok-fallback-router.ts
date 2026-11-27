/**
 * BYOK Multi-Provider LLM Fallback Router & Pre-Call Token-Budget Guard.
 *
 * Clean-room pure-TS engine (MIT/Apache-2.0 patterns from Portkey-AI/gateway,
 * Stackbilt-dev/llm-providers, and niieani/gpt-tokenizer):
 * - Estimates pre-call token spend deterministically before hitting BYOK keys.
 * - Selects the highest-priority healthy provider while skipping open circuits
 *   and enforcing hard per-tenant daily USD caps in integer cents.
 *
 * Layer: seed/ai (pure deterministic routing & budget math, zero deps)
 *
 * @module seed/ai/byok-fallback-router
 */

export type ByokLlmProvider = 'openrouter' | 'openai' | 'anthropic' | 'gemini';

export interface ProviderHealthEntry {
  readonly provider: ByokLlmProvider;
  readonly hasKey: boolean;
  readonly circuitOpen: boolean;
  readonly authInvalid: boolean;
  /** Estimated cost per 1M input+output tokens in integer USD cents. */
  readonly costPerMillionTokensCents: number;
}

export interface BudgetRoutingDecision {
  readonly allowed: boolean;
  readonly selectedProvider: ByokLlmProvider | null;
  readonly estimatedCostCents: number;
  readonly reason: string;
}

export function estimateTokensRough(text: string): number {
  const clean = text.trim();
  if (!clean) return 0;
  // Conservative ~3.5 chars/token estimate covering EN + VI diacritics
  return Math.ceil(clean.length / 3.5);
}

export function routeByokLlmWithBudgetGuard(args: {
  readonly promptText: string;
  readonly expectedOutputTokens: number;
  readonly dailySpentCents: number;
  readonly dailyCapCents: number;
  readonly providers: readonly ProviderHealthEntry[];
}): BudgetRoutingDecision {
  const totalTokens = estimateTokensRough(args.promptText) + Math.max(0, args.expectedOutputTokens);

  for (const p of args.providers) {
    if (!p.hasKey || p.authInvalid || p.circuitOpen) continue;
    const estCents = Math.max(1, Math.ceil((totalTokens * p.costPerMillionTokensCents) / 1_000_000));

    if (args.dailySpentCents + estCents > args.dailyCapCents) {
      return {
        allowed: false,
        selectedProvider: null,
        estimatedCostCents: estCents,
        reason: `Daily BYOK budget cap exceeded (${args.dailySpentCents + estCents}c > ${args.dailyCapCents}c)`,
      };
    }

    return {
      allowed: true,
      selectedProvider: p.provider,
      estimatedCostCents: estCents,
      reason: `Routed to ${p.provider} (~${totalTokens} tokens, ~${estCents}c)`,
    };
  }

  return {
    allowed: false,
    selectedProvider: null,
    estimatedCostCents: 0,
    reason: 'No healthy BYOK LLM provider available (all missing, auth-invalid, or circuit-open)',
  };
}
