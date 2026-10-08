import { describe, it, expect } from 'vitest';
import {
  MAB_CONFIG,
  DELIBERATION_CONFIG,
  SHAPLEY_CONFIG,
} from '../bandit-weights';

describe('Growth Triad v13 Config & Constants', () => {
  it('verifies MAB configuration sanity', () => {
    expect(MAB_CONFIG.MIN_EXPLORATION_TRAFFIC_WEIGHT).toBeGreaterThan(0);
    expect(MAB_CONFIG.MAX_EXPLOITATION_TRAFFIC_WEIGHT).toBeLessThanOrEqual(1.0);
    expect(MAB_CONFIG.CONFIDENCE_CONVERGENCE_THRESHOLD).toBe(0.95);
    expect(MAB_CONFIG.UCB1_EXPLORATION_FACTOR).toBeCloseTo(1.414, 2);
  });

  it('verifies deliberation weights sum to 1.0', () => {
    const totalWeight =
      DELIBERATION_CONFIG.WEIGHT_HOOK_ANALYST +
      DELIBERATION_CONFIG.WEIGHT_RETENTION_CRITIC +
      DELIBERATION_CONFIG.WEIGHT_COMPLIANCE_GUARD;
    expect(totalWeight).toBeCloseTo(1.0, 5);
    expect(DELIBERATION_CONFIG.COMPLIANCE_HARD_FLOOR).toBe(70.0);
  });

  it('verifies Shapley configuration sanity', () => {
    expect(SHAPLEY_CONFIG.MAX_TOUCHPOINTS_PER_JOURNEY).toBe(8);
    expect(SHAPLEY_CONFIG.TIME_DECAY_HALF_LIFE_DAYS).toBe(7);
  });
});
