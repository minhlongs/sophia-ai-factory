/**
 * @module seed/ai/context-window-enforcer
 *
 * ContextWindowEnforcer — Centralized authority for LLM context window health.
 * Monitors token levels and triggers compression/trimming before overflow occurs.
 *
 * Layer rule: seed only.
 */
import { estimateTokens, checkBudget, enforceHardCeiling, trimToBudget, } from './token-budget-guard';
import { ContextWindow } from './context-window';
import { logger } from '@/seed/utils/logger-utility';
import type { ChatMessage } from './provider-interface';

// ── Singleton ──────────────────────────────────────────────────────────────────

/** Shared ContextWindow instance for per-model limit lookups. */
const ctx = new ContextWindow();

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Threshold to trigger a warning during logging.
 */
export const WARNING_THRESHOLD = 200_000;

/**
 * Threshold to trigger critical warnings and proactive compression.
 */
export const CRITICAL_THRESHOLD = 230_000;

/**
 * Default safety buffer for typical requests.
 */
export const DEFAULT_SAFETY_BUFFER = 20_000;

// Kept for backward compatibility — prefer dynamic limit via ctx.getLimit(model).
/** Legacy hard ceiling. Use ctx.getLimit(model).contextLimit for new code. */
export const HARD_CEILING = 240_000;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ContextHealth {
  tokens: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OVERFLOW';
  healthScore: number; // 0-100
}

// ── Implementation ───────────────────────────────────────────────────────────

/**
 * Validates the current context budget.
 *
 * @param messages — The messages to check.
 * @param model — Model identifier for dynamic limit lookup (defaults to conservative fallback).
 * @returns BudgetCheckResult a safety check.
 */
export function checkContextBudget(
  messages: ChatMessage[],
  model: string = 'gpt-4o-mini',
) {
  const totalTokens = tokenCounterEstimate(messages);
  const budget = ctx.getLimit(model).contextLimit;
  return checkBudget(totalTokens, budget, DEFAULT_SAFETY_BUFFER);
}

/**
 * Proactively manages conversation length to prevent overflow.
 * If tokens > CRITICAL_THRESHOLD, it trims the history.
 *
 * @param messages — The chat history.
 * @param model — Model identifier for dynamic limit lookup.
 * @returns The adjusted message array.
 */
export function compressIfNeeded(messages: ChatMessage[], model: string = 'gpt-4o-mini'): ChatMessage[] {
  const tokens = tokenCounterEstimate(messages);
  const limit = ctx.getLimit(model).contextLimit;
  const threshold = Math.min(CRITICAL_THRESHOLD, limit * 0.9);

  if (tokens > threshold) {
    logger.warn('[ContextWindowEnforcer] Critical threshold reached. Proactively trimming context.', undefined, {
      tokens,
      threshold,
      model,
    });
    return trimToBudget(messages, threshold - 5000);
  }
  return messages;
}

/**
 * Returns a health report of the current context window.
 */
export function getContextHealth(messages: ChatMessage[], model: string = 'gpt-4o-mini'): ContextHealth {
  const tokens = tokenCounterEstimate(messages);
  const limit = ctx.getLimit(model).contextLimit;
  let status: ContextHealth['status'] = 'HEALTHY';
  if (tokens > limit) status = 'OVERFLOW';
  else if (tokens > CRITICAL_THRESHOLD) status = 'CRITICAL';
  else if (tokens > WARNING_THRESHOLD) status = 'WARNING';

  const healthScore = Math.max(0, Math.min(100, 100 - ((tokens / limit) * 100)));

  return {
    tokens,
    status,
    healthScore,
  };
}

/**
 * Final safety check before sending to the AI provider.
 * Throws if tokens exceed the model's context limit.
 */
export function verifyFinalContext(messages: ChatMessage[], model: string = 'gpt-4o-mini'): void {
  const tokens = tokenCounterEstimate(messages);
  const limit = ctx.getLimit(model).contextLimit;
  enforceHardCeiling(tokens, limit);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Internal helper to estimate tokens for a message array.
 * Integrates with the seed/ai/token-counter.
 */
function tokenCounterEstimate(messages: ChatMessage[]): number {
  // We use a simple additive estimation based on content + overhead
  return messages.reduce((acc, msg) => {
    return acc + estimateTokens(msg.content) + 4;
  }, 0);
}

// (tokenCounter integration via token-budget-guard)
