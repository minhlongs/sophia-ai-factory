/**
 * Post-production, QA, provenance, distribution, performance, and learning graph agent definitions.
 * @module tree/agent-protocol/graph-agents/post-production-agent-definitions
 */

import type { AgentDefinition } from '@/seed/types/creative-domain';
import {
  GRAPH_AGENT_IDS,
  PUBLISH_CONTENT_TOOL,
  TEXT_PERMISSION,
  PUBLISH_PERMISSION,
  createTextModelPolicy,
} from './permissions';

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
};

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
};

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
};

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
};

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
};

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
};
