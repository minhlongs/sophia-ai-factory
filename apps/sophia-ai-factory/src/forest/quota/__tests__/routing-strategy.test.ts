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
import type { ProviderCandidate, RoutingContext, VideoTaskType, VideoProvider } from '@/seed/config/routing-strategies';
import { PROVIDER_PRIORITY, VIDEO_TASK_TYPES, PROVIDER_COST_PER_UNIT } from '@/seed/config/routing-strategies';

const candidate = (overrides: Partial<ProviderCandidate> = {}): ProviderCandidate => ({
  provider: 'openrouter',
  model: 'openai/gpt-4o-mini',
  hasUserKey: false,
  costPerUnit: 0.002,
  healthScore: 1,
  quotaRemaining: 1000,
  usageCount: 0,
  estimatedCost: 0.02,
  ...overrides,
}) satisfies ProviderCandidate;

const makeContext = (taskType: VideoTaskType): RoutingContext => ({ taskType });

// Helper to get providers with cost data for a task type
function getProvidersWithCost(taskType: VideoTaskType): VideoProvider[] {
  const result: VideoProvider[] = [];
  for (const provider of Object.keys(PROVIDER_COST_PER_UNIT)) {
    const costs = PROVIDER_COST_PER_UNIT[provider as VideoProvider];
    if (costs[taskType] !== undefined) {
      result.push(provider as VideoProvider);
    }
  }
  return result;
}

// Helper to find cheapest provider for a task
function findCheapestProvider(taskType: VideoTaskType): VideoProvider {
  const providers = getProvidersWithCost(taskType);
  return providers.reduce((a, b) =>
    (PROVIDER_COST_PER_UNIT[a][taskType] || Infinity) < (PROVIDER_COST_PER_UNIT[b][taskType] || Infinity) ? a : b
  );
}

describe('PriorityStrategy', () => {
  // Test all 5 VideoTaskTypes - picks first in PROVIDER_PRIORITY order
  VIDEO_TASK_TYPES.forEach((taskType) => {
    const priority = PROVIDER_PRIORITY[taskType];
    if (priority.length < 2) return; // Skip single-provider task types (scripting)

    it(`picks first provider in PROVIDER_PRIORITY for ${taskType}`, () => {
      const pool = priority.slice().reverse().map((p) => candidate({ provider: p }));
      expect(selectWithStrategy(pool, makeContext(taskType), 'priority').provider).toBe(priority[0]);
    });
  });

  it('uses priority when no strategy name is supplied (default strategy)', () => {
    const pool = [
      candidate({ provider: 'd-id' }),
      candidate({ provider: 'heygen' }),
    ];
    // visual priority: ['heygen', 'd-id'], so heygen is first
    expect(selectWithStrategy(pool, makeContext('visual')).provider).toBe('heygen');
  });

  it('throws NoProvidersAvailableError for an empty pool', () => {
    expect(() => selectWithStrategy([], makeContext('visual'), 'priority')).toThrow(
      new NoProvidersAvailableError('visual'),
    );
  });

  it('reports the task type in the empty-pool error', () => {
    expect(() => selectWithStrategy([], makeContext('tts'), 'priority')).toThrow(
      "No AI provider available for task 'tts'",
    );
  });

  it('handles single provider pool', () => {
    const pool = [candidate({ provider: 'openrouter' })];
    expect(selectWithStrategy(pool, makeContext('scripting'), 'priority').provider).toBe('openrouter');
  });
});

describe('CostOptimizedStrategy', () => {
  // Test all 5 VideoTaskTypes - picks lowest estimatedCost
  VIDEO_TASK_TYPES.forEach((taskType) => {
    const providersWithCost = getProvidersWithCost(taskType);
    if (providersWithCost.length < 2) return; // Need at least 2 to test selection

    it(`picks lowest estimatedCost for ${taskType}`, () => {
      // Create pool with realistic costs - expensive first, cheapest last
      const pool = providersWithCost
        .slice()
        .sort((a, b) => (PROVIDER_COST_PER_UNIT[b][taskType] || 0) - (PROVIDER_COST_PER_UNIT[a][taskType] || 0))
        .map((p) => candidate({
          provider: p,
          estimatedCost: PROVIDER_COST_PER_UNIT[p][taskType] || 0,
        }));

      const cheapest = findCheapestProvider(taskType);
      expect(selectWithStrategy(pool, makeContext(taskType), 'cost-optimized').provider).toBe(cheapest);
    });
  });

  it('preserves buildProviderPool priority order on cost ties', () => {
    const pool = [
      candidate({ provider: 'd-id', estimatedCost: 0.03 }),
      candidate({ provider: 'heygen', estimatedCost: 0.03 }),
    ];
    // Both have same cost, stable sort preserves original pool order, so d-id (first in pool) wins
    expect(selectWithStrategy(pool, makeContext('visual'), 'cost-optimized').provider).toBe('d-id');
  });

  it('throws NoProvidersAvailableError for an empty pool', () => {
    expect(() => selectWithStrategy([], makeContext('visual'), 'cost-optimized')).toThrow(
      new NoProvidersAvailableError('visual'),
    );
  });

  it('reports the task type in the empty-pool error', () => {
    expect(() => selectWithStrategy([], makeContext('compose'), 'cost-optimized')).toThrow(
      "No AI provider available for task 'compose'",
    );
  });

  it('handles single provider pool', () => {
    const pool = [candidate({ provider: 'elevenlabs', estimatedCost: 0.0003 })];
    expect(selectWithStrategy(pool, makeContext('tts'), 'cost-optimized').provider).toBe('elevenlabs');
  });
});

describe('LeastUsedStrategy', () => {
  // Test all 5 VideoTaskTypes - picks lowest usageCount
  VIDEO_TASK_TYPES.forEach((taskType) => {
    const providers = PROVIDER_PRIORITY[taskType].filter((p): p is VideoProvider => true);
    if (providers.length < 2) return;

    it(`picks lowest usageCount for ${taskType}`, () => {
      // Create pool where the LAST provider in priority order has lowest usage
      // to verify it picks by usageCount, not priority
      const pool = providers
        .map((p, i) => candidate({ provider: p as VideoProvider, usageCount: (providers.length - i) * 10 }));
      // Lowest usage is the last one
      expect(selectWithStrategy(pool, makeContext(taskType), 'least-used').provider).toBe(providers[providers.length - 1]);
    });
  });

  it('preserves buildProviderPool priority order on usage ties', () => {
    const pool = [
      candidate({ provider: 'd-id', usageCount: 5 }),
      candidate({ provider: 'heygen', usageCount: 5 }),
    ];
    // Both have same usage, stable sort preserves pool order -> d-id wins
    expect(selectWithStrategy(pool, makeContext('visual'), 'least-used').provider).toBe('d-id');
  });

  it('throws NoProvidersAvailableError for an empty pool', () => {
    expect(() => selectWithStrategy([], makeContext('visual'), 'least-used')).toThrow(
      new NoProvidersAvailableError('visual'),
    );
  });

  it('reports the task type in the empty-pool error', () => {
    expect(() => selectWithStrategy([], makeContext('publish'), 'least-used')).toThrow(
      "No AI provider available for task 'publish'",
    );
  });

  it('handles single provider pool', () => {
    const pool = [candidate({ provider: 'heygen', usageCount: 100 })];
    expect(selectWithStrategy(pool, makeContext('publish'), 'least-used').provider).toBe('heygen');
  });
});

describe('Strategy Registry', () => {
  it('exposes all built-in strategies in the registry', () => {
    expect(listStrategies().map(({ name }) => name)).toEqual([
      'priority',
      'cost-optimized',
      'least-used',
    ]);
    expect(getStrategy('priority').name).toBe('priority');
  });
});