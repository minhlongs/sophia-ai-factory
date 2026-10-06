/**
 * AGY Parser & Schema Validator Unit Tests
 *
 * Tests:
 * - Parsing valid YAML specifications
 * - Edge 512KB payload threshold protection
 * - Malformed syntax error handling
 * - Comprehensive schema invariant validations (agent, compute, permissions, escalation)
 * - Unicode and multi-byte encoding stability
 *
 * @module seed/validators/__tests__/agy-parser.test
 */

import { describe, it, expect } from 'vitest';
import {
  parseAgentGovernanceYaml,
  parseAgyYaml,
  MAX_AGY_YAML_BYTES,
} from '@/seed/validators/agy-parser';

describe('AGY Parser & Schema Validator (Seed Layer)', () => {
  const validSampleYaml = `
schemaVersion: "1.0"
agent:
  id: "agent_video_gen"
  name: "Autonomous Video Creator"
  role: "video_creator"
  maxAutonomyLevel: "L2"
compute:
  maxTokensPerRun: 8192
  maxComputeUnitsMcu: 50
permissions:
  allow:
    - "video:generate"
    - "video:export"
    - "render:*"
  deny:
    - "billing:*"
    - "system:reconfigure"
escalation:
  onQuotaExceeded: "halt"
  onDisallowedAction: "escalate_human"
`;

  it('parses valid AGY document into strongly-typed object', () => {
    const parsed = parseAgentGovernanceYaml(validSampleYaml);
    expect(parsed.schemaVersion).toBe('1.0');
    expect(parsed.agent.id).toBe('agent_video_gen');
    expect(parsed.agent.name).toBe('Autonomous Video Creator');
    expect(parsed.agent.role).toBe('video_creator');
    expect(parsed.agent.maxAutonomyLevel).toBe('L2');
    expect(parsed.compute.maxTokensPerRun).toBe(8192);
    expect(parsed.compute.maxComputeUnitsMcu).toBe(50);
    expect(parsed.permissions.allow).toContain('video:generate');
    expect(parsed.permissions.deny).toContain('billing:*');
    expect(parsed.escalation.onQuotaExceeded).toBe('halt');
    expect(parsed.escalation.onDisallowedAction).toBe('escalate_human');
  });

  it('supports parseAgyYaml alias identically', () => {
    const parsed = parseAgyYaml(validSampleYaml);
    expect(parsed.agent.id).toBe('agent_video_gen');
  });

  it('enforces 512KB payload size cap', () => {
    const padding = '# ' + 'A'.repeat(MAX_AGY_YAML_BYTES + 100);
    const oversizedYaml = validSampleYaml + '\n' + padding;
    expect(() => parseAgentGovernanceYaml(oversizedYaml)).toThrow('PAYLOAD_TOO_LARGE');
  });

  it('allows document right at or below the 512KB threshold', () => {
    const baseLength = Buffer.byteLength(validSampleYaml, 'utf8');
    const allowedPadding = '# ' + 'B'.repeat(MAX_AGY_YAML_BYTES - baseLength - 10);
    const allowedYaml = validSampleYaml + '\n' + allowedPadding;
    const parsed = parseAgentGovernanceYaml(allowedYaml);
    expect(parsed.agent.id).toBe('agent_video_gen');
  });

  it('handles multi-byte Unicode strings seamlessly (Vietnamese & Japanese)', () => {
    const unicodeYaml = `
schemaVersion: "1.0"
agent:
  id: "agent_da_ngon_ngu"
  name: "Đại Lý Video Thông Minh Việt Nam (高度AIエージェント)"
  role: "nguoi_tao_video"
  maxAutonomyLevel: "L3"
compute:
  maxTokensPerRun: 16000
  maxComputeUnitsMcu: 100
permissions:
  allow:
    - "video:tạo"
    - "phát:*"
  deny:
    - "thanh_toán:*"
escalation:
  onQuotaExceeded: "request_approval"
  onDisallowedAction: "escalate_human"
`;
    const parsed = parseAgentGovernanceYaml(unicodeYaml);
    expect(parsed.agent.name).toContain('Đại Lý Video');
    expect(parsed.agent.name).toContain('高度AIエージェント');
    expect(parsed.permissions.allow).toContain('video:tạo');
  });

  it('throws YAML_SYNTAX_ERROR on malformed YAML syntax', () => {
    const brokenYaml = `
schemaVersion: "1.0"
agent:
  id: [broken syntax bracket
`;
    expect(() => parseAgentGovernanceYaml(brokenYaml)).toThrow('YAML_SYNTAX_ERROR');
  });

  it('throws INVALID_SCHEMA when root is not an object (e.g. empty, array, primitive)', () => {
    expect(() => parseAgentGovernanceYaml('')).toThrow('INVALID_SCHEMA');
    expect(() => parseAgentGovernanceYaml('   ')).toThrow('INVALID_SCHEMA');
    expect(() => parseAgentGovernanceYaml('- item1\n- item2')).toThrow('INVALID_SCHEMA');
    expect(() => parseAgentGovernanceYaml('"just a string"')).toThrow('INVALID_SCHEMA');
    expect(() => parseAgentGovernanceYaml('42')).toThrow('INVALID_SCHEMA');
  });

  it('validates schemaVersion is non-empty string', () => {
    const missingVer = validSampleYaml.replace('schemaVersion: "1.0"', 'schemaVersion: ""');
    expect(() => parseAgentGovernanceYaml(missingVer)).toThrow('INVALID_SCHEMA: schemaVersion is required');
  });

  it('validates agent identity attributes', () => {
    const missingAgent = validSampleYaml.replace(/agent:[\s\S]*?compute:/, 'compute:');
    expect(() => parseAgentGovernanceYaml(missingAgent)).toThrow('INVALID_SCHEMA: agent section is required');

    const missingId = validSampleYaml.replace('id: "agent_video_gen"', 'id: ""');
    expect(() => parseAgentGovernanceYaml(missingId)).toThrow('INVALID_SCHEMA: agent.id is required');

    const missingRole = validSampleYaml.replace('role: "video_creator"', 'role: ""');
    expect(() => parseAgentGovernanceYaml(missingRole)).toThrow('INVALID_SCHEMA: agent.role is required');

    const invalidAutonomy = validSampleYaml.replace('maxAutonomyLevel: "L2"', 'maxAutonomyLevel: "L9"');
    expect(() => parseAgentGovernanceYaml(invalidAutonomy)).toThrow('INVALID_SCHEMA: agent.maxAutonomyLevel must be one of L0, L1, L2, L3, L4');
  });

  it('validates compute budget constraints', () => {
    const missingCompute = validSampleYaml.replace(/compute:[\s\S]*?permissions:/, 'permissions:');
    expect(() => parseAgentGovernanceYaml(missingCompute)).toThrow('INVALID_SCHEMA: compute section is required');

    const negativeTokens = validSampleYaml.replace('maxTokensPerRun: 8192', 'maxTokensPerRun: -500');
    expect(() => parseAgentGovernanceYaml(negativeTokens)).toThrow('INVALID_SCHEMA: compute.maxTokensPerRun must be a positive integer');

    const negativeMcu = validSampleYaml.replace('maxComputeUnitsMcu: 50', 'maxComputeUnitsMcu: 0');
    expect(() => parseAgentGovernanceYaml(negativeMcu)).toThrow('INVALID_SCHEMA: compute.maxComputeUnitsMcu must be a positive integer');
  });

  it('validates permissions format', () => {
    const missingPerms = validSampleYaml.replace(/permissions:[\s\S]*?escalation:/, 'escalation:');
    expect(() => parseAgentGovernanceYaml(missingPerms)).toThrow('INVALID_SCHEMA: permissions section is required');

    const invalidAllow = validSampleYaml.replace(/allow:[\s\S]*?deny:/, 'allow: "not-an-array"\n  deny:');
    expect(() => parseAgentGovernanceYaml(invalidAllow)).toThrow('INVALID_SCHEMA: permissions.allow must be an array');
  });

  it('validates escalation rules', () => {
    const missingEscalation = validSampleYaml.replace(/escalation:[\s\S]*/, '');
    expect(() => parseAgentGovernanceYaml(missingEscalation)).toThrow('INVALID_SCHEMA: escalation section is required');

    const invalidQuotaAction = validSampleYaml.replace('onQuotaExceeded: "halt"', 'onQuotaExceeded: "ignore"');
    expect(() => parseAgentGovernanceYaml(invalidQuotaAction)).toThrow('INVALID_SCHEMA: escalation.onQuotaExceeded must be halt or request_approval');

    const invalidDisallowedAction = validSampleYaml.replace('onDisallowedAction: "escalate_human"', 'onDisallowedAction: "allow_anyway"');
    expect(() => parseAgentGovernanceYaml(invalidDisallowedAction)).toThrow('INVALID_SCHEMA: escalation.onDisallowedAction must be halt or escalate_human');
  });
});
