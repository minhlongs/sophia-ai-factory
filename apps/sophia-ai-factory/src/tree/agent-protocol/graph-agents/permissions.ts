/**
 * Graph Agents Constants & Permission Helpers
 * Layer: tree/agent-protocol/graph-agents
 */

import type { AgentPermission, ModelCapability, CostPolicy, AgentDefinition } from '@/seed/types/creative-domain'

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
} as const

/** Tool id gated behind approval on publish nodes. */
export const PUBLISH_CONTENT_TOOL = 'publish_content'

export const TEXT_PERMISSION: AgentPermission = {
  tool: 'generate_text',
  scopes: [],
  requiresApproval: false,
  maxCostCents: 500,
}

export const PUBLISH_PERMISSION: AgentPermission = {
  tool: PUBLISH_CONTENT_TOOL,
  scopes: [],
  requiresApproval: true,
  maxCostCents: 500,
}

/**
 * Create a standard model policy for text generation agents.
 * All graph agents use the same cheap text model with quality floor.
 */
export function createTextModelPolicy(
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
  }
}
