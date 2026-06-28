/**
 * Tests: playbook-parser.ts
 */

import { describe, it, expect } from 'vitest';
import { parsePlaybook } from './playbook-parser';

const VALID_PLAYBOOK = `
# Daily Content Factory Playbook

## Step 1: analytics:report
\`\`\`yaml
period: today
limit: 3
\`\`\`

## Step 2: video:create
\`\`\`yaml
topic: "{{step_1.output.topics[0]}}"
avatar_id: default
\`\`\`

## Step 3: email:campaign
\`\`\`yaml
subject: "Daily Digest"
template: daily_digest
\`\`\`
`.trim();

const NO_ARGS_PLAYBOOK = `
## Step 1: analytics:report
## Step 2: email:campaign
`.trim();

describe('parsePlaybook', () => {
  it('parses 3 steps from valid playbook', () => {
    const steps = parsePlaybook(VALID_PLAYBOOK);
    expect(steps).toHaveLength(3);
    expect(steps[0].order).toBe(1);
    expect(steps[0].command).toBe('analytics:report');
    expect(steps[1].order).toBe(2);
    expect(steps[1].command).toBe('video:create');
    expect(steps[2].order).toBe(3);
    expect(steps[2].command).toBe('email:campaign');
  });

  it('parses YAML args from code fences', () => {
    const steps = parsePlaybook(VALID_PLAYBOOK);
    expect(steps[0].args.period).toBe('today');
    expect(steps[0].args.limit).toBe(3);
    expect(steps[1].args.topic).toBe('{{step_1.output.topics[0]}}');
    expect(steps[1].args.avatar_id).toBe('default');
  });

  it('returns empty args when no code fence present', () => {
    const steps = parsePlaybook(NO_ARGS_PLAYBOOK);
    expect(steps[0].args).toEqual({});
    expect(steps[1].args).toEqual({});
  });

  it('sorts steps by order', () => {
    const reversed = `
## Step 3: email:campaign
\`\`\`yaml
subject: test
\`\`\`

## Step 1: analytics:report
## Step 2: video:create
`.trim();
    const steps = parsePlaybook(reversed);
    expect(steps.map(s => s.order)).toEqual([1, 2, 3]);
  });

  it('throws when no steps found', () => {
    expect(() => parsePlaybook('# Just a heading\n\nNo steps here.')).toThrow(/no valid.*Step/);
  });

  it('throws on invalid YAML in code fence', () => {
    const badYaml = `
## Step 1: analytics:report
\`\`\`yaml
: invalid: {yaml
\`\`\`
`.trim();
    expect(() => parsePlaybook(badYaml)).toThrow(/YAML args parse error/);
  });
});
