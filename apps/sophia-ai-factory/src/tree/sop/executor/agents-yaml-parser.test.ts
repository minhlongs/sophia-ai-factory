/**
 * Tests: agents-yaml-parser.ts
 */

import { describe, it, expect } from 'vitest';
import { parseAgentsYaml } from '@/seed/sop/executor/agents-yaml-parser';

const VALID_YAML = `
agents:
  content_planner:
    role: Content Planner
    goal: Plan 3 daily content topics
    tools:
      - analytics:report
      - video:create
    backstory: Expert strategist

  email_publisher:
    role: Email Publisher
    goal: Send digest
    tools:
      - email:campaign
`.trim();

const FLAT_YAML = `
content_planner:
  role: Content Planner
  goal: Plan topics
  tools:
    - analytics:report
`.trim();

describe('parseAgentsYaml', () => {
  it('parses valid nested agents.yaml', () => {
    const result = parseAgentsYaml(VALID_YAML);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result.content_planner.role).toBe('Content Planner');
    expect(result.content_planner.tools).toContain('analytics:report');
    expect(result.content_planner.backstory).toBe('Expert strategist');
    expect(result.email_publisher.tools).toContain('email:campaign');
  });

  it('parses flat (no top-level agents: key) format', () => {
    const result = parseAgentsYaml(FLAT_YAML);
    expect(result.content_planner.goal).toBe('Plan topics');
  });

  it('throws on invalid YAML syntax', () => {
    expect(() => parseAgentsYaml(': invalid: yaml: {{')).toThrow(/YAML parse error/);
  });

  it('throws when agents is empty', () => {
    expect(() => parseAgentsYaml('agents: {}')).toThrow(/no agent definitions/);
  });

  it('throws when agent is missing required role', () => {
    const yaml = `
agents:
  bad_agent:
    goal: Missing role
    tools: []
`.trim();
    expect(() => parseAgentsYaml(yaml)).toThrow(/missing required fields/);
  });

  it('throws when agent is missing goal', () => {
    const yaml = `
agents:
  bad_agent:
    role: Has Role
    tools: []
`.trim();
    expect(() => parseAgentsYaml(yaml)).toThrow(/missing required fields/);
  });

  it('throws when tools is not an array', () => {
    const yaml = `
agents:
  bad_agent:
    role: Role
    goal: Goal
    tools: "not-an-array"
`.trim();
    expect(() => parseAgentsYaml(yaml)).toThrow(/missing required fields/);
  });
});
