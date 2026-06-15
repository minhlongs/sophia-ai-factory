/**
 * SOP Agents YAML Parser
 *
 * Parses the Tier 1 HDR agents.yaml format into typed ParsedAgent map.
 * Expected format:
 *
 *   agents:
 *     agent_name:
 *       role: string
 *       goal: string
 *       tools:
 *         - command:name
 *       backstory?: string
 */

import yaml from 'js-yaml';
import type { ParsedAgent, ParsedAgentMap } from './types';

/** Type guard: validates a raw agent definition has required fields */
function isValidAgentDef(v: unknown): v is ParsedAgent {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  if (typeof obj.role !== 'string' || !obj.role.trim()) return false;
  if (typeof obj.goal !== 'string' || !obj.goal.trim()) return false;
  if (!Array.isArray(obj.tools)) return false;
  return true;
}

/**
 * Parse agents.yaml string into typed agent map.
 * Throws descriptive errors on invalid format.
 */
export function parseAgentsYaml(src: string): ParsedAgentMap {
  let parsed: unknown;
  try {
    parsed = yaml.load(src);
  } catch (e) {
    throw new Error(`agents.yaml YAML parse error: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('agents.yaml must be a YAML object');
  }

  const root = parsed as Record<string, unknown>;

  // Support both top-level { agents: {...} } and flat { agent_name: {...} }
  const agentsMap: Record<string, unknown> =
    root.agents && typeof root.agents === 'object'
      ? (root.agents as Record<string, unknown>)
      : root;

  if (Object.keys(agentsMap).length === 0) {
    throw new Error('agents.yaml contains no agent definitions');
  }

  const result: ParsedAgentMap = {};

  for (const [name, def] of Object.entries(agentsMap)) {
    if (!isValidAgentDef(def)) {
      throw new Error(
        `Agent "${name}" is missing required fields (role, goal, tools[]). Got: ${JSON.stringify(def)}`,
      );
    }

    result[name] = {
      role: def.role.trim(),
      goal: def.goal.trim(),
      tools: (def.tools as unknown[]).map(t => String(t).trim()),
      backstory: typeof def.backstory === 'string' ? def.backstory.trim() : undefined,
    };
  }

  return result;
}
