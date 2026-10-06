/**
 * Agent Governance YAML (AGY) Parser & Edge Memory Guard
 *
 * Seed Layer: Memory-safe YAML parser using `js-yaml` with a strict 512KB payload size
 * cap to protect Cloudflare Workers V8 isolate memory budgets and prevent ReDoS attacks.
 *
 * @module seed/validators/agy-parser
 */

import yaml from 'js-yaml';
import type {
  AutonomyLevel,
  AgentGovernanceYaml,
} from '@/seed/types/agent-governance';

/**
 * 512 KB maximum payload size threshold for Cloudflare Workers edge environment.
 */
export const MAX_AGY_YAML_BYTES = 512 * 1024;

/**
 * Computes exact UTF-8 byte length across both Node and Cloudflare Worker runtimes.
 */
function getByteLength(input: string): number {
  if (typeof Buffer !== 'undefined') {
    return Buffer.byteLength(input, 'utf8');
  }
  return new TextEncoder().encode(input).length;
}

/**
 * Validates and safely parses an Agent Governance YAML document.
 *
 * Enforces:
 * 1. 512KB payload size cap
 * 2. YAML syntax correctness
 * 3. Strict structural schema verification
 *
 * @param yamlString Raw YAML document string
 * @param maxBytes Optional byte threshold (defaults to MAX_AGY_YAML_BYTES)
 * @returns Strongly typed AgentGovernanceYaml
 */
export function parseAgentGovernanceYaml(
  yamlString: string,
  maxBytes: number = MAX_AGY_YAML_BYTES,
): AgentGovernanceYaml {
  if (typeof yamlString !== 'string') {
    throw new Error('INVALID_SCHEMA: Input must be a valid string');
  }

  const byteLength = getByteLength(yamlString);
  if (byteLength > maxBytes) {
    throw new Error(
      `PAYLOAD_TOO_LARGE: YAML document (${byteLength} bytes) exceeds limit of ${maxBytes} bytes`,
    );
  }

  let doc: unknown;
  try {
    doc = yaml.load(yamlString, { json: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`YAML_SYNTAX_ERROR: ${errorMsg}`);
  }

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error('INVALID_SCHEMA: AGY root must be an object');
  }

  const d = doc as Record<string, unknown>;

  // 1. schemaVersion validation
  if (typeof d.schemaVersion !== 'string' || !d.schemaVersion.trim()) {
    throw new Error('INVALID_SCHEMA: schemaVersion is required');
  }

  // 2. agent section validation
  const agent = d.agent as Record<string, unknown> | undefined;
  if (!agent || typeof agent !== 'object' || Array.isArray(agent)) {
    throw new Error('INVALID_SCHEMA: agent section is required');
  }

  if (typeof agent.id !== 'string' || !agent.id.trim()) {
    throw new Error('INVALID_SCHEMA: agent.id is required');
  }
  if (typeof agent.name !== 'string' || !agent.name.trim()) {
    throw new Error('INVALID_SCHEMA: agent.name is required');
  }
  if (typeof agent.role !== 'string' || !agent.role.trim()) {
    throw new Error('INVALID_SCHEMA: agent.role is required');
  }

  const maxAutonomy = agent.maxAutonomyLevel as string;
  const validAutonomies: AutonomyLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4'];
  if (!validAutonomies.includes(maxAutonomy as AutonomyLevel)) {
    throw new Error(
      `INVALID_SCHEMA: agent.maxAutonomyLevel must be one of L0, L1, L2, L3, L4 (received ${maxAutonomy})`,
    );
  }

  // 3. compute section validation
  const compute = d.compute as Record<string, unknown> | undefined;
  if (!compute || typeof compute !== 'object' || Array.isArray(compute)) {
    throw new Error('INVALID_SCHEMA: compute section is required');
  }
  if (
    typeof compute.maxTokensPerRun !== 'number' ||
    compute.maxTokensPerRun <= 0 ||
    !Number.isFinite(compute.maxTokensPerRun)
  ) {
    throw new Error('INVALID_SCHEMA: compute.maxTokensPerRun must be a positive integer');
  }
  if (
    typeof compute.maxComputeUnitsMcu !== 'number' ||
    compute.maxComputeUnitsMcu <= 0 ||
    !Number.isFinite(compute.maxComputeUnitsMcu)
  ) {
    throw new Error('INVALID_SCHEMA: compute.maxComputeUnitsMcu must be a positive integer');
  }

  // 4. permissions section validation
  const permissions = d.permissions as Record<string, unknown> | undefined;
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    throw new Error('INVALID_SCHEMA: permissions section is required');
  }
  if (!Array.isArray(permissions.allow)) {
    throw new Error('INVALID_SCHEMA: permissions.allow must be an array');
  }
  if (!Array.isArray(permissions.deny)) {
    throw new Error('INVALID_SCHEMA: permissions.deny must be an array');
  }

  // 5. escalation section validation
  const escalation = d.escalation as Record<string, unknown> | undefined;
  if (!escalation || typeof escalation !== 'object' || Array.isArray(escalation)) {
    throw new Error('INVALID_SCHEMA: escalation section is required');
  }
  if (!['halt', 'request_approval'].includes(escalation.onQuotaExceeded as string)) {
    throw new Error('INVALID_SCHEMA: escalation.onQuotaExceeded must be halt or request_approval');
  }
  if (!['halt', 'escalate_human'].includes(escalation.onDisallowedAction as string)) {
    throw new Error('INVALID_SCHEMA: escalation.onDisallowedAction must be halt or escalate_human');
  }

  return {
    schemaVersion: d.schemaVersion.trim(),
    agent: {
      id: agent.id.trim(),
      name: agent.name.trim(),
      role: agent.role.trim(),
      maxAutonomyLevel: maxAutonomy as AutonomyLevel,
    },
    compute: {
      maxTokensPerRun: Math.floor(compute.maxTokensPerRun),
      maxComputeUnitsMcu: Math.floor(compute.maxComputeUnitsMcu),
    },
    permissions: {
      allow: permissions.allow.map((p) => String(p).trim()).filter(Boolean),
      deny: permissions.deny.map((p) => String(p).trim()).filter(Boolean),
    },
    escalation: {
      onQuotaExceeded: escalation.onQuotaExceeded as 'halt' | 'request_approval',
      onDisallowedAction: escalation.onDisallowedAction as 'halt' | 'escalate_human',
    },
  };
}

/**
 * Canonical alias for parseAgentGovernanceYaml.
 */
export const parseAgyYaml = parseAgentGovernanceYaml;
