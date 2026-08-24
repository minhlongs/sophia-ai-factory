/**
 * Builtin agent registration tests.
 *
 * Proves registerBuiltinAgents() is idempotent: the has() guard
 * short-circuits before register() runs, so repeated calls (double
 * import / re-invocation) never duplicate entries in the
 * agentDefinitionRegistry.
 *
 * Also drift-guards MODEL_BY_CAPABILITY against the seed pricing
 * table so cost accounting keeps working when models change.
 *
 * @module tree/agent-protocol/__tests__/builtin-agents
 */

import { describe, it, expect, vi } from 'vitest';
import { agentDefinitionRegistry } from '@/tree/agent-protocol/agent-registry';
import {
  MODEL_BY_CAPABILITY,
  registerBuiltinAgents,
  resolveModelForCapability,
} from '@/tree/agent-protocol/builtin-agents';
import { getModelPricing } from '@/seed/ai/cost-estimator';

describe('registerBuiltinAgents — idempotency', () => {
  it('calling twice does not re-register or duplicate definitions', () => {
    // Module load already auto-called registerBuiltinAgents(), so the
    // definition exists before this spy is attached. If the guard were
    // missing, either call below would invoke register() again.
    const registerSpy = vi.spyOn(agentDefinitionRegistry, 'register');

    expect(() => {
      registerBuiltinAgents();
      registerBuiltinAgents();
    }).not.toThrow();

    expect(registerSpy).not.toHaveBeenCalled();

    const writers = agentDefinitionRegistry
      .list()
      .filter((definition) => definition.id === 'sophia-content-writer');
    expect(writers).toHaveLength(1);
    expect(agentDefinitionRegistry.has('sophia-content-writer')).toBe(true);

    registerSpy.mockRestore();
  });

  it('registered definition resolves its model through the capability map', () => {
    const definition = agentDefinitionRegistry.get('sophia-content-writer');
    expect(definition).toBeDefined();
    expect(definition?.modelPolicy?.capability).toBe('text');
    expect(resolveModelForCapability('text')).toBe(MODEL_BY_CAPABILITY.text);
  });
});

describe('MODEL_BY_CAPABILITY — pricing table drift guard', () => {
  it('every mapped model exists in the seed cost estimator pricing table', () => {
    for (const [capability, model] of Object.entries(MODEL_BY_CAPABILITY)) {
      const pricing = getModelPricing(model, 'openrouter');
      expect(pricing, `model for capability "${capability}" missing from pricing table`).toBeDefined();
    }
  });
});
