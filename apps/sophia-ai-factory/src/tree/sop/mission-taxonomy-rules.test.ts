import { describe, expect, it } from 'vitest';
import { getDispatchRule, RULES } from './mission-taxonomy-rules';

describe('mission taxonomy dispatch rules', () => {
  it('provides a fleet for known mission types and leaves unknown work unassigned', () => {
    expect(getDispatchRule('content')?.agentFleet).toEqual(['copywriter', 'seo-reviewer']);
    expect(getDispatchRule('unknown')).toBeUndefined();
    expect(RULES).toHaveLength(9);
  });
});
