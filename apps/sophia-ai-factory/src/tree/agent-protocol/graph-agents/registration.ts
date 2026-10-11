/**
 * Production Graph Agent Registration
 * Layer: tree/agent-protocol/graph-agents
 */

import { agentDefinitionRegistry } from '../agent-registry'
import { MODEL_BY_CAPABILITY } from '../builtin-agents'
import { GRAPH_AGENT_DEFINITIONS } from './agent-definitions'

/**
 * Idempotent registration of graph agent definitions.
 *
 * Guards on `has()` so double-import / re-call does not duplicate.
 * Called at module load so the registry is ready before the runner executes.
 */
export function registerGraphAgents(): void {
  for (const definition of GRAPH_AGENT_DEFINITIONS) {
    if (agentDefinitionRegistry.has(definition.id)) continue
    agentDefinitionRegistry.register(definition)
  }
}

/** Model id used by graph agents for text generation (pricing-table backed). */
export const GRAPH_TEXT_MODEL = MODEL_BY_CAPABILITY.text

// Auto-register at module load
registerGraphAgents()
