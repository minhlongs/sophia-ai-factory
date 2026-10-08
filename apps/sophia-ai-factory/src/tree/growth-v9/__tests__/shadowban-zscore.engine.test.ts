import { describe, it, expect } from 'vitest';
import { evaluateShadowbanRisk, TelemetryPoint } from '../shadowban-zscore.engine';

describe('Shadowban Z-Score Engine', () => {
  it('identifies an anomaly when current point drops significantly below historical mean', () => {
    const history: TelemetryPoint[] = [
      { timestampMs: 1, viewVelocity: 1000, engagementRate: 0.1 },
      { timestampMs: 1, viewVelocity: 1100, engagementRate: 0.11 },
      { timestampMs: 1, viewVelocity: 950, engagementRate: 0.09 },
      { timestampMs: 1, viewVelocity: 1050, engagementRate: 0.1 },
    ];

    const current: TelemetryPoint = {
      timestampMs: 2,
      viewVelocity: 150, // Massive drop
      engagementRate: 0.01, // Massive drop
    };

    const result = evaluateShadowbanRisk(history, current, -2.0);

    expect(result.velocityZScore).toBeLessThan(-2.0);
    expect(result.engagementZScore).toBeLessThan(-2.0);
    expect(result.isAnomalous).toBe(true);
  });

  it('does not flag normal variations', () => {
    const history: TelemetryPoint[] = [
      { timestampMs: 1, viewVelocity: 1000, engagementRate: 0.1 },
      { timestampMs: 1, viewVelocity: 1100, engagementRate: 0.11 },
      { timestampMs: 1, viewVelocity: 950, engagementRate: 0.09 },
      { timestampMs: 1, viewVelocity: 1050, engagementRate: 0.1 },
    ];

    const current: TelemetryPoint = {
      timestampMs: 2,
      viewVelocity: 900,
      engagementRate: 0.08,
    };

    const result = evaluateShadowbanRisk(history, current, -2.0);

    expect(result.isAnomalous).toBe(false);
  });

  it('handles empty history gracefully', () => {
    const current: TelemetryPoint = { timestampMs: 1, viewVelocity: 100, engagementRate: 0.05 };
    const result = evaluateShadowbanRisk([], current);
    expect(result.isAnomalous).toBe(false);
    expect(result.velocityZScore).toBe(0);
  });
});
