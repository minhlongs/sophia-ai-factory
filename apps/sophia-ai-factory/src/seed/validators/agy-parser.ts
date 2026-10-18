/**
 * Agent Governance YAML (AGY) Parser & Edge Memory Guard
 *
 * Seed Layer: Memory-safe YAML parser using `js-yaml` with a strict 512KB payload size
 * cap to protect Cloudflare Workers V8 isolate memory budgets and prevent ReDoS attacks.
 *
 * @module seed/validators/agy-parser
 */

import yaml from 'js-yaml';
import type { AgentGovernanceYaml } from '@/seed/types/agent-governance';
import {
  validateAgentSection,
  validateComputeSection,
  validatePermissionsSection,
  validateEscalationSection,
} from './agy-section-validators';

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

  if (typeof d.schemaVersion !== 'string' || !d.schemaVersion.trim()) {
    throw new Error('INVALID_SCHEMA: schemaVersion is required');
  }

  return {
    schemaVersion: d.schemaVersion.trim(),
    agent: validateAgentSection(d.agent),
    compute: validateComputeSection(d.compute),
    permissions: validatePermissionsSection(d.permissions),
    escalation: validateEscalationSection(d.escalation),
  };
}

/**
 * Canonical alias for parseAgentGovernanceYaml.
 */
export const parseAgyYaml = parseAgentGovernanceYaml;
