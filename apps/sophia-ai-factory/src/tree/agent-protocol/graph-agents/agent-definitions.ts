/**
 * Production Graph Agent Definitions
 * Layer: tree/agent-protocol/graph-agents
 */

import type { AgentDefinition } from '@/seed/types/creative-domain'
import {
  GRAPH_AGENT_IDS,
  PUBLISH_CONTENT_TOOL,
  TEXT_PERMISSION,
  PUBLISH_PERMISSION,
  createTextModelPolicy,
} from './permissions'

export const RESEARCHER_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.researcher,
  name: 'Sophia Researcher',
  role: 'You are an expert researcher. Gather and synthesize source material into a structured brief.',
  capabilities: ['generate_text'],
  permissions: [TEXT_PERMISSION],
  defaultAutonomy: 1,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
}

export const SCOUT_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.scout,
  name: 'Sophia Scout',
  role: 'You are a market scout. Identify trending topics, audience gaps, and high-potential content angles.',
  capabilities: ['generate_text'],
  permissions: [TEXT_PERMISSION],
  defaultAutonomy: 1,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
}

export const STRATEGIST_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.strategist,
  name: 'Sophia Strategist',
  role: 'You are an expert content strategist. Turn briefs into scripts, hooks, and distribution copy.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 1,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
}

export const CREATIVE_DIRECTOR_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.creativeDirector,
  name: 'Sophia Creative Director',
  role: 'You are a creative director. Define the visual style, tone, and creative direction for the content.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 2,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
}

export const WRITER_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.writer,
  name: 'Sophia Writer',
  role: 'You are an expert scriptwriter. Write engaging, well-structured scripts following the creative direction.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 2,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
}

export const STORYBOARD_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.storyboard,
  name: 'Sophia Storyboard',
  role: 'You are a storyboard artist. Break scripts into visual scenes with shot descriptions and timing.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 2,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
}

export const PRODUCTION_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.production,
  name: 'Sophia Production',
  role: 'You are a production coordinator. Generate production plans, asset lists, and technical specifications.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 2,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
}

export const QA_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.qa,
  name: 'Sophia QA',
  role: 'You are a quality assurance specialist. Review content for accuracy, brand compliance, and technical correctness.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 2,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
}

export const PROVENANCE_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.provenance,
  name: 'Sophia Provenance',
  role: 'You are a provenance recorder. Generate audit trails, source citations, and chain-of-custody documentation.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 2,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
}

export const DISTRIBUTION_PLAN_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.distributionPlan,
  name: 'Sophia Distribution Plan',
  role: 'You are a distribution strategist. Create multi-channel publishing schedules, platform-specific optimizations, and launch plans.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 2,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
}

export const PERFORMANCE_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.performance,
  name: 'Sophia Performance',
  role: 'You are a performance analyst. Analyze metrics, identify optimization opportunities, and recommend content improvements.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 2,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
}

export const LEARNING_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.learning,
  name: 'Sophia Learning',
  role: 'You are a learning engine. Synthesize performance data into creative insights, pattern recognition, and strategy refinements for future missions.',
  capabilities: ['generate_text'],
  permissions: [TEXT_PERMISSION],
  defaultAutonomy: 2,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
}

export const EDITOR_DEFINITION: AgentDefinition = {
  id: GRAPH_AGENT_IDS.editor,
  name: 'Sophia Editor',
  role: 'You are an expert editor. Draft, polish, and finalize content for publication.',
  capabilities: ['generate_text', PUBLISH_CONTENT_TOOL],
  permissions: [TEXT_PERMISSION, PUBLISH_PERMISSION],
  defaultAutonomy: 1,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: createTextModelPolicy(),
}

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
]
