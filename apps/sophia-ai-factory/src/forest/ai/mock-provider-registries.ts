/**
 * Mock Provider Registry Builders for Deterministic Test Scenarios.
 * @module forest/ai/mock-provider-registries
 */

import type { Provider, ProviderId } from '@/seed/ai/provider-interface';
import { ProviderRegistry } from '@/seed/ai/provider-registry';
import { createMockProvider } from './mock-provider';

/**
 * Create a complete mock provider registry with multiple mock providers.
 *
 * Returns a ProviderRegistry pre-populated with healthy mock providers
 * for testing the full graph execution pipeline deterministically.
 */
export function createMockProviderRegistry(
  fallbackOrder: ProviderId[] = ['openrouter', 'anthropic'],
): {
  registry: ProviderRegistry;
  providers: Map<ProviderId, Provider>;
} {
  const registry = new ProviderRegistry(fallbackOrder);
  const providers = new Map<ProviderId, Provider>();

  for (const id of fallbackOrder) {
    const provider = createMockProvider({
      id,
      label: `Mock ${id}`,
      fixedResponse: `Mock response from ${id}`,
      fixedModel: `mock-${id}-v1`,
    });
    providers.set(id, provider);
    registry.register(provider);
  }

  return { registry, providers };
}

/**
 * Create a mock provider registry configured for a specific test scenario.
 */
export function createScenarioMockRegistry(scenario: 'success' | 'failure' | 'mixed'): {
  registry: ProviderRegistry;
  providers: Map<ProviderId, Provider>;
} {
  const registry = new ProviderRegistry(['openrouter', 'anthropic']);
  const providers = new Map<ProviderId, Provider>();

  if (scenario === 'success' || scenario === 'mixed') {
    const successProvider = createMockProvider({
      id: 'openrouter',
      label: 'Mock OpenRouter',
      fixedResponse: 'Success response',
      fixedModel: 'mock-success-v1',
    });
    providers.set('openrouter', successProvider);
    registry.register(successProvider);
  }

  if (scenario === 'failure' || scenario === 'mixed') {
    const failProvider = createMockProvider({
      id: 'anthropic',
      label: 'Mock Anthropic',
      shouldFail: true,
      errorMessage: 'Simulated provider failure',
      fixedModel: 'mock-fail-v1',
    });
    providers.set('anthropic', failProvider);
    registry.register(failProvider);
  }

  return { registry, providers };
}
