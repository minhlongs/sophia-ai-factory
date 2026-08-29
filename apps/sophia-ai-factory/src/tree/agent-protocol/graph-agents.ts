/**
 * Production Graph Agent Definitions
 *
 * Registers the thirteen agents used by production graph templates:
 * researcher, editor, strategist (existing) + scout, creative-director, writer,
 * storyboard, production, qa, provenance, distribution-plan, performance, learning.
 * Shape mirrors builtin-agents.ts exactly; model IDs come from the same pricing-table
 * mapping so cost accounting works.
 *
 * The editor, strategist, writer, storyboard, production, qa, provenance,
 * distribution-plan, and performance carry the `publish_content` permission with
 * requiresApproval=true — the executor hard-fails AUTONOMY_DENIED unless
 * the runner supplies the tool id in context.approvedActionIds after an
 * approved approval gate.
 *
 * Layer: tree (domain-specific reusable)
 * @module tree/agent-protocol/graph-agents
 */

import type { AgentDefinition, AgentPermission, ModelCapability, CostPolicy } from '@/seed/types/creative-domain';
import { agentDefinitionRegistry } from './agent-registry';
import { MODEL_BY_CAPABILITY } from './builtin-agents';

/** Agent slugs referenced by the production graph templates. */
export const GRAPH_AGENT_IDS = {
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

/**
 * Create a standard model policy for text generation agents.
 * All graph agents use the same cheap text model with quality floor.
 */
function createTextModelPolicy(
  capability: ModelCapability = 'text',
  costPolicy: CostPolicy = 'cheap',
  maxCostCents = 500,
  requiredQuality = 0.7,
): AgentDefinition['modelPolicy'] {
  return {
    capability,
    costPolicy,
    maxCostCents,
    requiredQuality,
  };
}

const RESEARCHER_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.researcher,
  name: 'Sophia Researcher',
  role: 'You are an expert researcher. Gather and synthesize source material into a structured brief.',
  capabilities: ['generate_text'],
  permissions: [TEXT_PERMISSION],
  defaultAutonomy: 1,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
};

const SCOUT_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.scout,
  name: 'Sophia Scout',
  role: 'You are a market scout. Identify trending topics, audience gaps, and high-potential content angles.',
  capabilities: ['generate_text'],
  permissions: [TEXT_PERMISSION],
  defaultAutonomy: 1,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
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
  modelPolicy: createTextModelPolicy(),
};

const CREATIVE_DIRECTOR_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.creativeDirector,
  name: 'Sophia Creative Director',
  role: 'You are a creative director. Define the visual style, tone, and creative direction for the content.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 2,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
};

const WRITER_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.writer,
  name: 'Sophia Writer',
  role: 'You are an expert scriptwriter. Write engaging, well-structured scripts following the creative direction.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 2,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
};

const STORYBOARD_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.storyboard,
  name: 'Sophia Storyboard',
  role: 'You are a storyboard artist. Break scripts into visual scenes with shot descriptions and timing.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 2,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
};

const PRODUCTION_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.production,
  name: 'Sophia Production',
  role: 'You are a production coordinator. Generate production plans, asset lists, and technical specifications.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 2,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
};

const QA_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.qa,
  name: 'Sophia QA',
  role: 'You are a quality assurance specialist. Review content for accuracy, brand compliance, and technical correctness.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 2,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
};

const PROVENANCE_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.provenance,
  name: 'Sophia Provenance',
  role: 'You are a provenance recorder. Generate audit trails, source citations, and chain-of-custody documentation.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 2,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
};

const DISTRIBUTION_PLAN_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.distributionPlan,
  name: 'Sophia Distribution Plan',
  role: 'You are a distribution strategist. Create multi-channel publishing schedules, platform-specific optimizations, and launch plans.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 2,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
};

const PERFORMANCE_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.performance,
  name: 'Sophia Performance',
  role: 'You are a performance analyst. Analyze metrics, identify optimization opportunities, and recommend content improvements.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 2,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
};

const LEARNING_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.learning,
  name: 'Sophia Learning',
  role: 'You are a learning engine. Synthesize performance data into creative insights, pattern recognition, and strategy refinements for future missions.',
  capabilities: ['generate_text'],
  permissions: [TEXT_PERMISSION],
  defaultAutonomy: 2,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
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
  modelPolicy: createTextModelPolicy(),
};

/** All graph agent definitions, in registration order matching the 13-stage pipeline. */
export const GRAPH_AGENT_DEFINITIONS: readonly AgentDefinition[] = [
  SCOUT_DEFINITION,
  RESEARCHER_DEFINITION,
  STRATEGIST_DEFINITION,
  CREATIVE_DIRECTOR_DEFINITION,
  WRITER_DEFINITION,
  STORYBOARD_DEFINITION,
  PRODUCTION_DEFINITION,
  QA_DEFINITION,
  PROVENANCE_DEFINITION,
  EDITOR_DEFINITION,
  DISTRIBUTION_PLAN_DEFINITION,
  PERFORMANCE_DEFINITION,
  LEARNING_DEFINITION,
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