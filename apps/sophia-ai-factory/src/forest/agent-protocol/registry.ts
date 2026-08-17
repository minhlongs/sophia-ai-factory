/**
 * AgentRegistry — concrete implementation
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * @module forest/agent-protocol
 */

import { logger } from '@/seed/utils/logger-utility';
import type { AgentProtocol, AgentRegistry } from '@/forest/agent-protocol/types';
import type { AgentDefinition } from '@/seed/types/creative-domain';

export class InMemoryAgentRegistry implements AgentRegistry {
  readonly agents: Map<string, AgentProtocol>;
  readonly definitions: Map<string, AgentDefinition>;

  constructor() {
    this.agents = new Map();
    this.definitions = new Map();
  }

  register(agent: AgentProtocol): void {
    const def = agent.definition;
    if (this.agents.has(def.id)) {
      logger.warn('AgentRegistry.register: duplicate registration', { agentId: def.id });
      return;
    }
    this.agents.set(def.id, agent);
    this.definitions.set(def.id, def);
    logger.info('AgentRegistry: registered agent', { agentId: def.id, name: def.name });
  }

  get(id: string): AgentProtocol | undefined {
    return this.agents.get(id);
  }

  listByCapability(capability: string): AgentDefinition[] {
    const matches: AgentDefinition[] = [];
    for (const agent of this.agents.values()) {
      if (agent.definition.capabilities.includes(capability)) {
        matches.push(agent.definition);
      }
    }
    return matches;
  }

  has(id: string): boolean {
    return this.agents.has(id);
  }
}

export const agentRegistry = new InMemoryAgentRegistry();