import { describe, it, expect } from 'vitest';
import {
  SOC2_CONTROLS,
  evaluateSOC2Readiness,
  getSoc2Report,
} from '@/seed/compliance/soc2';

describe('SOC 2 Compliance Prep', () => {
  it('exposes all 11 SOC 2 Type I controls', () => {
    expect(SOC2_CONTROLS.length).toBe(11);
  });

  it('evaluates readiness for MASTER tier', () => {
    const res = evaluateSOC2Readiness('MASTER');
    expect(res.tier).toBe('MASTER');
    expect(res.totalControls).toBe(11);
    expect(res.findings.length).toBe(11);
    expect(typeof res.score).toBe('number');
  });

  it('evaluates readiness for BASIC tier', () => {
    const res = evaluateSOC2Readiness('BASIC');
    expect(res.tier).toBe('BASIC');
    expect(res.score).toBeLessThanOrEqual(100);
  });

  it('generates a human-readable report string', () => {
    const report = getSoc2Report('MASTER');
    expect(report).toContain('SOC 2 Type I Readiness Report');
    expect(report).toContain('Tier: MASTER');
  });
});
