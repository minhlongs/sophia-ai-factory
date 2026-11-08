/**
 * ValidationReceipt policy tests — capability mask and budget cap.
 *
 * The gate exists so a key that authenticates but cannot do the work is refused
 * before an Inngest step is consumed. These tests pin each refusal and, equally
 * important, each case that must still be allowed: a refusal that fires too
 * readily breaks workflows that were working.
 *
 * @module tree/byok/__tests__/key-capability-gate.test
 */

import { describe, it, expect } from 'vitest';

import {
  buildValidationReceipt,
  evaluateKeyForWorkflow,
  gateKeyForWorkflow,
  ALLOWED,
} from '@/tree/byok/key-capability-gate';
import {
  evaluateBudget,
  capabilitiesSatisfy,
  budgetVerdictMessage,
} from '@/tree/byok/validation-receipt-types';
import type { KeyBudgetState, ValidationReceipt } from '@/tree/byok/validation-receipt-types';

const NOW = 1_760_000_000;

function budget(over: Partial<KeyBudgetState> = {}): KeyBudgetState {
  return { monthlyBudgetUsd: null, monthSpentUsd: 0, cooldownUntil: null, ...over };
}

function receipt(over: Partial<ValidationReceipt> = {}): ValidationReceipt {
  const b = over.budget ?? budget({ monthlyBudgetUsd: 50, monthSpentUsd: 10 });
  return {
    provider: 'openrouter',
    maskedKey: '****...abcd',
    checkedAtUnix: NOW,
    capabilities: ['json_schema', 'tool_call', 'vision'],
    budget: b,
    verdict: evaluateBudget(b, NOW),
    ...over,
  };
}

describe('evaluateBudget', () => {
  it('reports the remaining spend under a cap', () => {
    const v = evaluateBudget(budget({ monthlyBudgetUsd: 50, monthSpentUsd: 12.5 }), NOW);
    expect(v).toEqual({ outcome: 'within_budget', remainingUsd: 37.5 });
  });

  it('treats an absent cap as a distinct verdict from an exhausted one', () => {
    expect(evaluateBudget(budget({ monthlyBudgetUsd: null }), NOW).outcome).toBe('no_cap_set');
  });

  it('refuses at exactly zero remaining, not below it', () => {
    const v = evaluateBudget(budget({ monthlyBudgetUsd: 20, monthSpentUsd: 20 }), NOW);
    expect(v).toEqual({ outcome: 'budget_exhausted', remainingUsd: 0 });
  });

  it('rounds to cents rather than leaking float dust', () => {
    const v = evaluateBudget(budget({ monthlyBudgetUsd: 10, monthSpentUsd: 3.333 }), NOW);
    expect(v).toEqual({ outcome: 'within_budget', remainingUsd: 6.67 });
  });

  it('refuses while a cooldown has not yet elapsed', () => {
    const v = evaluateBudget(budget({ cooldownUntil: NOW + 600 }), NOW);
    expect(v).toEqual({ outcome: 'cooldown_active', resumesAtUnix: NOW + 600 });
  });

  it('allows a key once its cooldown has elapsed', () => {
    const v = evaluateBudget(budget({ monthlyBudgetUsd: 50, cooldownUntil: NOW - 1 }), NOW);
    expect(v.outcome).toBe('within_budget');
  });

  it('lets a cooldown take precedence over an exhausted cap', () => {
    const v = evaluateBudget(
      budget({ monthlyBudgetUsd: 10, monthSpentUsd: 99, cooldownUntil: NOW + 60 }),
      NOW,
    );
    expect(v.outcome).toBe('cooldown_active');
  });
});

describe('capabilitiesSatisfy', () => {
  it('always allows a text-only need', () => {
    expect(capabilitiesSatisfy([], 'text_completion')).toBe(true);
  });

  it('allows a need the key covers', () => {
    expect(capabilitiesSatisfy(['json_schema', 'tool_call'], 'tool_call')).toBe(true);
  });

  it('refuses a need the key does not cover', () => {
    expect(capabilitiesSatisfy(['json_schema'], 'tool_call')).toBe(false);
  });
});

describe('buildValidationReceipt', () => {
  it('falls back to the provider capability table when no live signal exists', () => {
    const r = buildValidationReceipt({
      provider: 'anthropic',
      maskedKey: '****...1234',
      budget: budget(),
      nowUnix: NOW,
    });
    expect(r.capabilities).toEqual(['json_schema', 'tool_call', 'vision']);
    expect(r.verdict.outcome).toBe('no_cap_set');
  });

  it('prefers a probed capability list over the table', () => {
    const r = buildValidationReceipt({
      provider: 'openrouter',
      maskedKey: '****...1234',
      probedCapabilities: ['json_schema'],
      budget: budget(),
      nowUnix: NOW,
    });
    expect(r.capabilities).toEqual(['json_schema']);
  });

  it('records a capability-less provider as capability-less, not as all-capable', () => {
    const r = buildValidationReceipt({
      provider: 'elevenlabs',
      maskedKey: '****...1234',
      budget: budget(),
      nowUnix: NOW,
    });
    expect(r.capabilities).toEqual([]);
  });

  it('keeps the masked key and never the plaintext', () => {
    const r = buildValidationReceipt({
      provider: 'openrouter',
      maskedKey: '****...9f2a',
      budget: budget(),
      nowUnix: NOW,
    });
    expect(r.maskedKey).toBe('****...9f2a');
  });
});

describe('evaluateKeyForWorkflow', () => {
  it('allows a key that covers the requirement and has budget', () => {
    expect(evaluateKeyForWorkflow(receipt(), 'tool_call', NOW)).toEqual(ALLOWED);
  });

  it('refuses a tool-calling workflow on a key with no tool_call capability', () => {
    const d = evaluateKeyForWorkflow(receipt({ capabilities: ['json_schema'] }), 'tool_call', NOW);
    expect(d.allowed).toBe(false);
    expect(d.refusal).toEqual({ kind: 'capability_missing', requirement: 'tool_call' });
  });

  it('refuses a vision workflow on a text-only key', () => {
    const d = evaluateKeyForWorkflow(receipt({ capabilities: ['json_schema', 'tool_call'] }), 'vision', NOW);
    expect(d.refusal?.kind).toBe('capability_missing');
  });

  it('still allows a text-only workflow on a text-only key', () => {
    expect(evaluateKeyForWorkflow(receipt({ capabilities: [] }), 'text_completion', NOW)).toEqual(ALLOWED);
  });

  it('refuses an exhausted budget even when capabilities cover the need', () => {
    const d = evaluateKeyForWorkflow(
      receipt({ budget: budget({ monthlyBudgetUsd: 10, monthSpentUsd: 25 }) }),
      'tool_call',
      NOW,
    );
    expect(d.allowed).toBe(false);
    expect(d.refusal).toEqual({ kind: 'budget_exhausted' });
  });

  it('refuses while a cooldown is active', () => {
    const d = evaluateKeyForWorkflow(
      receipt({ budget: budget({ monthlyBudgetUsd: 50, cooldownUntil: NOW + 900 }) }),
      'tool_call',
      NOW,
    );
    expect(d.refusal).toEqual({ kind: 'cooldown_active', resumesAtUnix: NOW + 900 });
  });

  it('lets a capability failure win over a budget failure so the message is actionable', () => {
    const d = evaluateKeyForWorkflow(
      receipt({
        capabilities: ['json_schema'],
        budget: budget({ monthlyBudgetUsd: 1, monthSpentUsd: 9 }),
      }),
      'tool_call',
      NOW,
    );
    expect(d.refusal?.kind).toBe('capability_missing');
  });

  it('refuses with key_unreadable when the key policy row is absent in D1', () => {
    const d = evaluateKeyForWorkflow(receipt({ policyStatus: 'absent' }), 'tool_call', NOW);
    expect(d.allowed).toBe(false);
    expect(d.refusal).toEqual({ kind: 'key_unreadable' });
  });

  it('stays fail-open when the policy read itself failed transiently (unreadable)', () => {
    const d = evaluateKeyForWorkflow(receipt({ policyStatus: 'unreadable' }), 'tool_call', NOW);
    expect(d).toEqual(ALLOWED);
  });

  it('evaluates capabilities and budget normally when the policy row is found', () => {
    const d = evaluateKeyForWorkflow(receipt({ policyStatus: 'found' }), 'tool_call', NOW);
    expect(d).toEqual(ALLOWED);
  });
});

describe('gateKeyForWorkflow', () => {
  it('allows without logging a refusal', () => {
    expect(gateKeyForWorkflow({
      userId: 'u1', provider: 'openrouter', receipt: receipt(),
      requirement: 'tool_call', nowUnix: NOW, logTag: 'test',
    })).toEqual(ALLOWED);
  });

  it('returns the same refusal the pure evaluator produces', () => {
    const d = gateKeyForWorkflow({
      userId: 'u1', provider: 'openrouter', receipt: receipt({ capabilities: [] }),
      requirement: 'tool_call', nowUnix: NOW, logTag: 'test',
    });
    expect(d.allowed).toBe(false);
    expect(d.refusal).toEqual({ kind: 'capability_missing', requirement: 'tool_call' });
  });

  it('gates a budget refusal too', () => {
    const d = gateKeyForWorkflow({
      userId: 'u1', provider: 'openrouter',
      receipt: receipt({ budget: budget({ monthlyBudgetUsd: 1, monthSpentUsd: 5 }) }),
      requirement: 'tool_call', nowUnix: NOW, logTag: 'test',
    });
    expect(d.refusal).toEqual({ kind: 'budget_exhausted' });
  });
});

describe('budgetVerdictMessage', () => {
  it('carries both languages for an exhausted cap', () => {
    const m = budgetVerdictMessage({ outcome: 'budget_exhausted', remainingUsd: 0 });
    expect(m.message).toContain('$0.00');
    expect(m.message_vi).toContain('hạn mức');
  });

  it('carries both languages for a cooldown', () => {
    const m = budgetVerdictMessage({ outcome: 'cooldown_active', resumesAtUnix: NOW });
    expect(m.message).toContain('cooling down');
    expect(m.message_vi).toContain('tạm nghỉ');
  });
});
