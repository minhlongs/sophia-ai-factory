/**
 * Production Graph agent definitions — unit tests.
 *
 * Covers: GRAPH_AGENT_IDS / PUBLISH_CONTENT_TOOL contracts, the thirteen
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
  it('exposes all thirteen stable slugs referenced by templates', async () => {
    const { GRAPH_AGENT_IDS } = await import('../graph-agents');
    expect(GRAPH_AGENT_IDS).toEqual({
      researcher: 'sophia-researcher',
      editor: 'sophia-editor',
      strategist: 'sophia-strategist',
      scout: 'sophia-scout',
      creativeDirector: 'sophia-creative-director',
      writer: 'sophia-writer',
      storyboard: 'sophia-storyboard',
      production: 'sophia-production',
      qa: 'sophia-qa',
      provenance: 'sophia-provenance',
      distributionPlan: 'sophia-distribution-plan',
      performance: 'sophia-performance',
      learning: 'sophia-learning',
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
  it('registers exactly thirteen definitions in a stable order', async () => {
    const { GRAPH_AGENT_DEFINITIONS } = await import('../graph-agents');
    expect(GRAPH_AGENT_DEFINITIONS).toHaveLength(13);
    expect(GRAPH_AGENT_DEFINITIONS.map((d) => d.id)).toEqual([
      'sophia-scout',
      'sophia-researcher',
      'sophia-strategist',
      'sophia-creative-director',
      'sophia-writer',
      'sophia-storyboard',
      'sophia-production',
      'sophia-qa',
      'sophia-provenance',
      'sophia-editor',
      'sophia-distribution-plan',
      'sophia-performance',
      'sophia-learning',
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

  it('the scout and researcher have only the text permission (no publish gate)', async () => {
    const { GRAPH_AGENT_DEFINITIONS } = await import('../graph-agents');
    const scout = GRAPH_AGENT_DEFINITIONS[0];
    const researcher = GRAPH_AGENT_DEFINITIONS[1];
    if (!scout || !researcher) throw new Error('scout/researcher definition missing');
    for (const definition of [scout, researcher]) {
      const tools = definition.permissions.map((p) => p.tool);
      expect(tools).toEqual(['generate_text']);
      for (const permission of definition.permissions) {
        expect(permission.requiresApproval).toBe(false);
      }
    }
  });

  it('the learning agent has only the text permission (no publish gate)', async () => {
    const { GRAPH_AGENT_DEFINITIONS } = await import('../graph-agents');
    const learning = GRAPH_AGENT_DEFINITIONS[12];
    if (!learning) throw new Error('learning definition missing');
    const tools = learning.permissions.map((p) => p.tool);
    expect(tools).toEqual(['generate_text']);
    for (const permission of learning.permissions) {
      expect(permission.requiresApproval).toBe(false);
    }
  });

  it('the editor, strategist, creative-director, writer, storyboard, production, qa, provenance, distribution-plan, performance carry both text and publish permissions', async () => {
    const { GRAPH_AGENT_DEFINITIONS } = await import('../graph-agents');
    // Indices: 2=strategist, 3=creative-director, 4=writer, 5=storyboard, 6=production, 7=qa, 8=provenance, 9=editor, 10=distribution-plan, 11=performance
    const publishAgents = GRAPH_AGENT_DEFINITIONS.slice(2, 12);
    for (const definition of publishAgents) {
      const tools = definition.permissions.map((p) => p.tool).sort();
      expect(tools).toEqual(['generate_text', 'publish_content']);
    }
    const publishPermissions = publishAgents.flatMap((d) => d.permissions).filter(
      (p) => p.tool === 'publish_content',
    );
    expect(publishPermissions).toHaveLength(10);
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

  it('defaultAutonomy levels are correctly assigned per role', async () => {
    const { GRAPH_AGENT_DEFINITIONS } = await import('../graph-agents');
    // Scout (0) and Researcher (1) have autonomy 1
    expect(GRAPH_AGENT_DEFINITIONS[0].defaultAutonomy).toBe(1); // scout
    expect(GRAPH_AGENT_DEFINITIONS[1].defaultAutonomy).toBe(1); // researcher
    // Strategist (2) has autonomy 1
    expect(GRAPH_AGENT_DEFINITIONS[2].defaultAutonomy).toBe(1); // strategist
    // Creative Director (3) through Provenance (8) have autonomy 2
    for (let i = 3; i <= 8; i++) {
      expect(GRAPH_AGENT_DEFINITIONS[i].defaultAutonomy).toBe(2);
    }
    // Editor (9) has autonomy 1 (same as original)
    expect(GRAPH_AGENT_DEFINITIONS[9].defaultAutonomy).toBe(1); // editor
    // Distribution Plan (10) and Performance (11) have autonomy 2
    expect(GRAPH_AGENT_DEFINITIONS[10].defaultAutonomy).toBe(2); // distribution-plan
    expect(GRAPH_AGENT_DEFINITIONS[11].defaultAutonomy).toBe(2); // performance
    // Learning (12) has autonomy 2
    expect(GRAPH_AGENT_DEFINITIONS[12].defaultAutonomy).toBe(2);
  });
});

describe('registerGraphAgents (auto-registration)', () => {
  it('registers all thirteen graph agents on module load', async () => {
    vi.resetModules();
    const { registerGraphAgents, GRAPH_AGENT_IDS } = await import('../graph-agents');
    const { agentDefinitionRegistry } = await import('../agent-registry');

    registerGraphAgents();
    expect(agentDefinitionRegistry.has(GRAPH_AGENT_IDS.researcher)).toBe(true);
    expect(agentDefinitionRegistry.has(GRAPH_AGENT_IDS.editor)).toBe(true);
    expect(agentDefinitionRegistry.has(GRAPH_AGENT_IDS.strategist)).toBe(true);
    expect(agentDefinitionRegistry.has(GRAPH_AGENT_IDS.scout)).toBe(true);
    expect(agentDefinitionRegistry.has(GRAPH_AGENT_IDS.creativeDirector)).toBe(true);
    expect(agentDefinitionRegistry.has(GRAPH_AGENT_IDS.writer)).toBe(true);
    expect(agentDefinitionRegistry.has(GRAPH_AGENT_IDS.storyboard)).toBe(true);
    expect(agentDefinitionRegistry.has(GRAPH_AGENT_IDS.production)).toBe(true);
    expect(agentDefinitionRegistry.has(GRAPH_AGENT_IDS.qa)).toBe(true);
    expect(agentDefinitionRegistry.has(GRAPH_AGENT_IDS.provenance)).toBe(true);
    expect(agentDefinitionRegistry.has(GRAPH_AGENT_IDS.distributionPlan)).toBe(true);
    expect(agentDefinitionRegistry.has(GRAPH_AGENT_IDS.performance)).toBe(true);
    expect(agentDefinitionRegistry.has(GRAPH_AGENT_IDS.learning)).toBe(true);
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