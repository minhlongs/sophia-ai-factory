/**
 * Direct unit tests for the synchronous routing strategies.
 *
 * These tests exercise strategy ranking independently from provider-pool
 * construction, key resolution, quota reads, and Inngest orchestration.
 */

import { describe, expect, it } from 'vitest';
import {
  NoProvidersAvailableError,
  getStrategy,
  listStrategies,
  selectWithStrategy,
} from '@/forest/quota/routing-strategy';
import type { ProviderCandidate, RoutingContext } from '@/seed/config/routing-strategies';

const context: RoutingContext = { taskType: 'visual' };

function candidate(overrides: Partial<ProviderCandidate> = {}): ProviderCandidate {
  return {
    provider: 'heygen',
    model: 'v2',
    hasUserKey: true,
    costPerUnit: 0.02,
    healthScore: 1,
    quotaRemaining: 100,
    usageCount: 0,
    estimatedCost: 0.2,
    ...overrides,
  };
}

describe('routing strategies', () => {
  describe('priority strategy', () => {
    it('selects providers in the configured task priority order', () => {
      const pool = [
        candidate({ provider: 'd-id', model: 'd-id-studio' }),
        candidate({ provider: 'heygen', model: 'v2' }),
      ];

      const decision = selectWithStrategy(pool, context, 'priority');

      expect(decision.provider).toBe('heygen');
      expect(decision.model).toBe('v2');
      expect(decision.strategy).toBe('priority');
      expect(decision.candidatesConsidered).toBe(2);
      expect(decision.reason).toContain('first in priority order');
    });

    it('keeps the original pool order when providers have equal priority', () => {
      const pool = [
        candidate({ provider: 'openrouter', model: 'openai/gpt-4o-mini' }),
        candidate({ provider: 'elevenlabs', model: 'elevenlabs-multilingual-v2' }),
      ];

      const decision = selectWithStrategy(pool, { taskType: 'scripting' }, 'priority');

      expect(decision.provider).toBe('openrouter');
    });
  });

  describe('cost-optimized strategy', () => {
    it('selects the candidate with the lowest estimated cost', () => {
      const pool = [
        candidate({ provider: 'heygen', estimatedCost: 0.2 }),
        candidate({ provider: 'd-id', estimatedCost: 0.05 }),
      ];

      const decision = selectWithStrategy(pool, context, 'cost-optimized');

      expect(decision.provider).toBe('d-id');
      expect(decision.strategy).toBe('cost-optimized');
      expect(decision.reason).toContain('$0.0500');
    });

    it('uses the existing pool order to break equal-cost ties', () => {
      const pool = [
        candidate({ provider: 'd-id', estimatedCost: 0.1 }),
        candidate({ provider: 'heygen', estimatedCost: 0.1 }),
      ];

      const decision = selectWithStrategy(pool, context, 'cost-optimized');

      expect(decision.provider).toBe('d-id');
    });
  });

  describe('least-used strategy', () => {
    it('selects the candidate with the lowest usage count', () => {
      const pool = [
        candidate({ provider: 'heygen', usageCount: 8 }),
        candidate({ provider: 'd-id', usageCount: 2 }),
      ];

      const decision = selectWithStrategy(pool, context, 'least-used');

      expect(decision.provider).toBe('d-id');
      expect(decision.strategy).toBe('least-used');
      expect(decision.reason).toContain('2 this window');
    });

    it('uses the existing pool order to break equal-usage ties', () => {
      const pool = [
        candidate({ provider: 'd-id', usageCount: 2 }),
        candidate({ provider: 'heygen', usageCount: 2 }),
      ];

      const decision = selectWithStrategy(pool, context, 'least-used');

      expect(decision.provider).toBe('d-id');
    });
  });

  it('falls back to priority for an unknown strategy name', () => {
    const pool = [
      candidate({ provider: 'd-id' }),
      candidate({ provider: 'heygen' }),
    ];

    const decision = selectWithStrategy(pool, context, 'not-registered');

    expect(decision.provider).toBe('heygen');
    expect(decision.strategy).toBe('priority');
  });

  it('uses priority when no strategy name is supplied', () => {
    const pool = [
      candidate({ provider: 'd-id' }),
      candidate({ provider: 'heygen' }),
    ];

    expect(selectWithStrategy(pool, context).provider).toBe('heygen');
  });

  it('throws NoProvidersAvailableError for an empty pool', () => {
    expect(() => selectWithStrategy([], context, 'priority')).toThrow(
      new NoProvidersAvailableError('visual'),
    );
  });

  it('reports the task type in the empty-pool error', () => {
    expect(() => selectWithStrategy([], { taskType: 'tts' }, 'least-used')).toThrow(
      "No AI provider available for task 'tts'",
    );
  });

  it('exposes all built-in strategies in the registry', () => {
    expect(listStrategies().map(({ name }) => name)).toEqual([
      'priority',
      'cost-optimized',
      'least-used',
    ]);
    expect(getStrategy('priority').name).toBe('priority');
  });
});
