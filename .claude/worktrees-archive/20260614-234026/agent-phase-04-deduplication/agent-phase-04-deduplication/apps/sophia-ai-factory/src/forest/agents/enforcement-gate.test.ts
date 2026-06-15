/**
 * Enforcement Gate — Vitest suite.
 * Table-driven tests covering every (role, tier) pair.
 */

import { describe, it, expect } from 'vitest';
import { assertTierAllowsAgent, AgentTierBlockedError, getAgentRoleTierMap } from './enforcement-gate';

describe('assertTierAllowsAgent', () => {
  // Cases that SHOULD be allowed
  const allowedCases: [string, string][] = [
    ['PREMIUM', 'CEO'],
    ['PREMIUM', 'Developer'],
    ['ENTERPRISE', 'CEO'],
    ['ENTERPRISE', 'Developer'],
    ['MASTER', 'CEO'],
    ['MASTER', 'Developer'],
    // MASTER bypasses even unknown roles
    ['MASTER', 'UnknownRole'],
  ];

  for (const [tier, role] of allowedCases) {
    it(`allows tier=${tier} to run role=${role}`, () => {
      expect(() => assertTierAllowsAgent(tier, role)).not.toThrow();
    });
  }

  // Cases that SHOULD be blocked
  const blockedCases: [string, string][] = [
    ['BASIC', 'CEO'],
    ['BASIC', 'Developer'],
    ['BASIC', 'UnknownRole'],
    ['PREMIUM', 'UnknownRole'], // Unknown roles default to ENTERPRISE
  ];

  for (const [tier, role] of blockedCases) {
    it(`blocks tier=${tier} from running role=${role}`, () => {
      expect(() => assertTierAllowsAgent(tier, role)).toThrow(AgentTierBlockedError);
    });
  }

  it('throws AgentTierBlockedError with correct metadata', () => {
    try {
      assertTierAllowsAgent('BASIC', 'CEO');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AgentTierBlockedError);
      const gateErr = err as AgentTierBlockedError;
      expect(gateErr.agentRole).toBe('CEO');
      expect(gateErr.requiredTier).toBe('PREMIUM');
      expect(gateErr.userTier).toBe('BASIC');
      expect(gateErr.errorClass).toBe('tier_blocked');
    }
  });

  it('AgentTierBlockedError has correct name', () => {
    const err = new AgentTierBlockedError('Developer', 'PREMIUM', 'BASIC');
    expect(err.name).toBe('AgentTierBlockedError');
    expect(err.message).toContain('Developer');
    expect(err.message).toContain('PREMIUM');
  });

  it('treats unknown tier as blocked', () => {
    // 'STARTER' is not a valid tier
    expect(() => assertTierAllowsAgent('STARTER', 'CEO')).toThrow(AgentTierBlockedError);
  });
});

describe('getAgentRoleTierMap', () => {
  it('returns a map with CEO and Developer entries', () => {
    const map = getAgentRoleTierMap();
    expect(map).toHaveProperty('CEO');
    expect(map).toHaveProperty('Developer');
    expect(map.CEO).toBe('PREMIUM');
    expect(map.Developer).toBe('PREMIUM');
  });

  it('is a copy — mutations do not affect gate logic', () => {
    const map = getAgentRoleTierMap();
    map.CEO = 'BASIC'; // mutate the copy
    // Gate should still block BASIC→CEO
    expect(() => assertTierAllowsAgent('BASIC', 'CEO')).toThrow(AgentTierBlockedError);
  });
});
