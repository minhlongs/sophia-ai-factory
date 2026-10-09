import { describe, it, expect } from 'vitest';
import { normalizeAudienceRetention } from '../audience-retention-normalizer';

describe('normalizeAudienceRetention', () => {
  it('handles empty or single-point curves gracefully', () => {
    expect(normalizeAudienceRetention([])).toEqual({
      integratedRetentionPct: 0,
      normalizedCompletionScore: 0,
      hookDropoffRate: 0,
      bodySlope: 0,
    });

    expect(normalizeAudienceRetention([{ timePct: 0, retentionPct: 100 }])).toEqual({
      integratedRetentionPct: 0,
      normalizedCompletionScore: 0,
      hookDropoffRate: 0,
      bodySlope: 0,
    });
  });

  it('computes exact area for uniform 100% retention curve', () => {
    const curve = [
      { timePct: 0, retentionPct: 100 },
      { timePct: 50, retentionPct: 100 },
      { timePct: 100, retentionPct: 100 },
    ];
    const res = normalizeAudienceRetention(curve);
    expect(res.integratedRetentionPct).toBe(100);
    expect(res.normalizedCompletionScore).toBe(1);
    expect(res.hookDropoffRate).toBe(0);
    expect(res.bodySlope).toBe(0);
  });

  it('correctly calculates trapezoidal integration for linear decay', () => {
    const curve = [
      { timePct: 0, retentionPct: 100 },
      { timePct: 100, retentionPct: 0 },
    ];
    const res = normalizeAudienceRetention(curve);
    expect(res.integratedRetentionPct).toBe(50);
    expect(res.normalizedCompletionScore).toBe(0.5);
    expect(res.hookDropoffRate).toBe(1); // drops completely to 0 at second point
    expect(res.bodySlope).toBe(-1);
  });

  it('handles out-of-order curve points by sorting them monotonically', () => {
    const curve = [
      { timePct: 100, retentionPct: 40 },
      { timePct: 0, retentionPct: 100 },
      { timePct: 10, retentionPct: 80 },
    ];
    const res = normalizeAudienceRetention(curve);
    expect(res.normalizedCompletionScore).toBeGreaterThan(0);
    expect(res.hookDropoffRate).toBeCloseTo(0.2, 5); // (100 - 80) / 100
  });
});
