/**
 * AgentDefinitionRegistry — in-memory registry of AgentDefinition instances.
 *
 * Layer: tree (domain-specific reusable)
 *
 * Replaces the deprecated forest/agent-protocol InMemoryAgentRegistry for
 * agent lookup by id. Stores AgentDefinition directly (no AgentProtocol
 * wrapper) so executeAgent can consume it without adaptation.
 *
 * @module tree/agent-protocol
 */

import type { AgentDefinition } from '@/seed/types/creative-domain';

// ─── Registry ─────────────────────────────────────────────────────────────────

export interface AgentDefinitionRegistry {
  /** Register a new agent definition. */
  register(definition: AgentDefinition): void;
  /** Fetch by id. */
  get(agentId: string): AgentDefinition | undefined;
  /** List all registered agents. */
  list(): AgentDefinition[];
  /** Check whether an agent is registered. */
  has(agentId: string): boolean;
}

export class InMemoryAgentDefinitionRegistry implements AgentDefinitionRegistry {
  readonly #store = new Map<string, AgentDefinition>();

  register(definition: AgentDefinition): void {
    this.#store.set(definition.id, definition);
  }

  get(agentId: string): AgentDefinition | undefined {
    return this.#store.get(agentId);
  }

  list(): AgentDefinition[] {
    return Array.from(this.#store.values());
  }

  has(agentId: string): boolean {
    return this.#store.has(agentId);
  }
}

export const agentDefinitionRegistry = new InMemoryAgentDefinitionRegistry();