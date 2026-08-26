/**
 * Production Graph Agent Definitions
 *
 * Registers the three agents used by production graph templates:
 * researcher, editor, and strategist. Shape mirrors builtin-agents.ts
 * exactly; model IDs come from the same pricing-table mapping so cost
 * accounting works.
 *
 * The editor and strategist carry the `publish_content` permission with
 * requiresApproval=true — the executor hard-fails AUTONOMY_DENIED unless
 * the runner supplies the tool id in context.approvedActionIds after an
 * approved approval gate.
 *
 * Layer: tree (domain-specific reusable)
 * @module tree/agent-protocol/graph-agents
 */

import type { AgentDefinition, AgentPermission } from '@/seed/types/creative-domain';
import { agentDefinitionRegistry } from './agent-registry';
import { MODEL_BY_CAPABILITY } from './builtin-agents';

/** Agent slugs referenced by the production graph templates. */
export const GRAPH_AGENT_IDS = {
  researcher: 'sophia-researcher',
  editor: 'sophia-editor',
  strategist: 'sophia-strategist',
} as const;

/** Tool id gated behind approval on publish nodes. */
export const PUBLISH_CONTENT_TOOL = 'publish_content';

const TEXT_PERMISSION: AgentPermission = {
  tool: 'generate_text',
  scopes: [],
  requiresApproval: false,
  maxCostCents: 500,
};

const PUBLISH_PERMISSION: AgentPermission = {
  tool: PUBLISH_CONTENT_TOOL,
  scopes: [],
  requiresApproval: true,
  maxCostCents: 500,
};

const RESEARCHER_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.researcher,
  name: 'Sophia Researcher',
  role: 'You are an expert researcher. Gather and synthesize source material into a structured brief.',
  capabilities: ['generate_text'],
  permissions: [TEXT_PERMISSION],
  defaultAutonomy: 1,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: {
    capability: 'text',
    costPolicy: 'cheap',
    maxCostCents: 500,
    requiredQuality: 0.7,
  },
};

const EDITOR_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.editor,
  name: 'Sophia Editor',
  role: 'You are an expert editor. Draft, polish, and finalize content for publication.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 1,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: {
    capability: 'text',
    costPolicy: 'cheap',
    maxCostCents: 500,
    requiredQuality: 0.7,
  },
};

const STRATEGIST_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.strategist,
  name: 'Sophia Strategist',
  role: 'You are an expert content strategist. Turn briefs into scripts, hooks, and distribution copy.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 1,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: {
    capability: 'text',
    costPolicy: 'cheap',
    maxCostCents: 500,
    requiredQuality: 0.7,
  },
};

/** All graph agent definitions, in registration order. */
export const GRAPH_AGENT_DEFINITIONS: readonly AgentDefinition[] = [
  RESEARCHER_DEFINITION,
  EDITOR_DEFINITION,
  STRATEGIST_DEFINITION,
];

/**
 * Idempotent registration of graph agent definitions.
 *
 * Guards on `has()` so double-import / re-call does not duplicate.
 * Called at module load so the registry is ready before the runner executes.
 */
export function registerGraphAgents(): void {
  for (const definition of GRAPH_AGENT_DEFINITIONS) {
    if (agentDefinitionRegistry.has(definition.id)) continue;
    agentDefinitionRegistry.register(definition);
  }
}

/** Model id used by graph agents for text generation (pricing-table backed). */
export const GRAPH_TEXT_MODEL = MODEL_BY_CAPABILITY.text;

// Auto-register at module load
registerGraphAgents();
