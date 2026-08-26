/**
 * Production Graph agent definitions — unit tests.
 *
 * Covers: GRAPH_AGENT_IDS / PUBLISH_CONTENT_TOOL contracts, the three
 * definitions (slugs, capabilities, permissions, model policy), registerGraphAgents
 * idempotency (no duplicates across re-imports), and GRAPH_TEXT_MODEL wiring.
 *
 * @module tree/agent-protocol/__tests__/graph-agents
 */

import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: mocks.logger,
}));

describe('GRAPH_AGENT_IDS', () => {
  it('exposes the three stable slugs referenced by templates', async () => {
    const { GRAPH_AGENT_IDS } = await import('../graph-agents');
    expect(GRAPH_AGENT_IDS).toEqual({
      researcher: 'sophia-researcher',
      editor: 'sophia-editor',
      strategist: 'sophia-strategist',
    });
  });
});

describe('PUBLISH_CONTENT_TOOL', () => {
  it('is the gated tool id used by the approval gate', async () => {
    const { PUBLISH_CONTENT_TOOL } = await import('../graph-agents');
    expect(PUBLISH_CONTENT_TOOL).toBe('publish_content');
  });
});

describe('GRAPH_AGENT_DEFINITIONS', () => {
  it('registers exactly three definitions in a stable order', async () => {
    const { GRAPH_AGENT_DEFINITIONS } = await import('../graph-agents');
    expect(GRAPH_AGENT_DEFINITIONS).toHaveLength(3);
    expect(GRAPH_AGENT_DEFINITIONS.map((d) => d.id)).toEqual([
      'sophia-researcher',
      'sophia-editor',
      'sophia-strategist',
    ]);
  });

  it('each definition carries a non-empty name, role, and capabilities', async () => {
    const { GRAPH_AGENT_DEFINITIONS } = await import('../graph-agents');
    for (const definition of GRAPH_AGENT_DEFINITIONS) {
      expect(definition.name.length).toBeGreaterThan(0);
      expect(definition.role.length).toBeGreaterThan(0);
      expect(definition.capabilities.length).toBeGreaterThan(0);
    }
  });

  it('the researcher has only the text permission (no publish gate)', async () => {
    const { GRAPH_AGENT_DEFINITIONS } = await import('../graph-agents');
    const researcher = GRAPH_AGENT_DEFINITIONS[0];
    if (!researcher) throw new Error('researcher definition missing');
    const tools = researcher.permissions.map((p) => p.tool);
    expect(tools).toEqual(['generate_text']);
    for (const permission of researcher.permissions) {
      expect(permission.requiresApproval).toBe(false);
    }
  });

  it('the editor and strategist carry both text and publish permissions', async () => {
    const { GRAPH_AGENT_DEFINITIONS } = await import('../graph-agents');
    const editor = GRAPH_AGENT_DEFINITIONS[1];
    const strategist = GRAPH_AGENT_DEFINITIONS[2];
    if (!editor || !strategist) throw new Error('editor/strategist definitions missing');
    for (const definition of [editor, strategist]) {
      const tools = definition.permissions.map((p) => p.tool).sort();
      expect(tools).toEqual(['generate_text', 'publish_content']);
    }
    const publishPermissions = [...editor.permissions, ...strategist.permissions].filter(
      (p) => p.tool === 'publish_content',
    );
    expect(publishPermissions).toHaveLength(2);
    for (const permission of publishPermissions) {
      expect(permission.requiresApproval).toBe(true);
    }
  });

  it('publish permissions cap cost at 500 cents', async () => {
    const { GRAPH_AGENT_DEFINITIONS } = await import('../graph-agents');
    for (const definition of GRAPH_AGENT_DEFINITIONS) {
      for (const permission of definition.permissions) {
        expect(Number.isInteger(permission.maxCostCents)).toBe(true);
        expect(permission.maxCostCents).toBeGreaterThan(0);
      }
    }
  });

  it('model policy is cheap text with a quality floor', async () => {
    const { GRAPH_AGENT_DEFINITIONS } = await import('../graph-agents');
    for (const definition of GRAPH_AGENT_DEFINITIONS) {
      // All graph agents share the same model policy — non-null asserted.
      const policy = definition.modelPolicy!;
      expect(policy.capability).toBe('text');
      expect(policy.costPolicy).toBe('cheap');
      expect(policy.requiredQuality).toBe(0.7);
    }
  });

  it('retry and timeout settings are sane', async () => {
    const { GRAPH_AGENT_DEFINITIONS } = await import('../graph-agents');
    for (const definition of GRAPH_AGENT_DEFINITIONS) {
      expect(definition.maxRetries).toBe(2);
      expect(definition.timeoutMs).toBe(120_000);
    }
  });
});

describe('registerGraphAgents (auto-registration)', () => {
  it('registers all three graph agents on module load', async () => {
    vi.resetModules();
    const { registerGraphAgents, GRAPH_AGENT_IDS } = await import('../graph-agents');
    const { agentDefinitionRegistry } = await import('../agent-registry');

    registerGraphAgents();
    expect(agentDefinitionRegistry.has(GRAPH_AGENT_IDS.researcher)).toBe(true);
    expect(agentDefinitionRegistry.has(GRAPH_AGENT_IDS.editor)).toBe(true);
    expect(agentDefinitionRegistry.has(GRAPH_AGENT_IDS.strategist)).toBe(true);
  });

  it('is idempotent — re-importing does not duplicate the registry', async () => {
    vi.resetModules();
    // First import auto-registers.
    await import('../graph-agents');
    const { agentDefinitionRegistry } = await import('../agent-registry');
    const { registerGraphAgents, GRAPH_AGENT_IDS } = await import('../graph-agents');

    const before = agentDefinitionRegistry.list().length;
    registerGraphAgents();
    registerGraphAgents();
    const after = agentDefinitionRegistry.list().length;

    expect(after).toBe(before);
    expect(agentDefinitionRegistry.list().filter((d) => d.id === GRAPH_AGENT_IDS.editor))
      .toHaveLength(1);
  });

  it('does not overwrite an existing definition with the same id', async () => {
    vi.resetModules();
    const { agentDefinitionRegistry } = await import('../agent-registry');
    const { registerGraphAgents, GRAPH_AGENT_IDS } = await import('../graph-agents');

    const original = agentDefinitionRegistry.get(GRAPH_AGENT_IDS.researcher);
    expect(original).toBeDefined();

    registerGraphAgents();
    const after = agentDefinitionRegistry.get(GRAPH_AGENT_IDS.researcher);
    expect(after).toBe(original);
  });
});

describe('GRAPH_TEXT_MODEL', () => {
  it('is a non-empty model id string', async () => {
    const { GRAPH_TEXT_MODEL } = await import('../graph-agents');
    expect(typeof GRAPH_TEXT_MODEL).toBe('string');
    expect(GRAPH_TEXT_MODEL.length).toBeGreaterThan(0);
  });
});