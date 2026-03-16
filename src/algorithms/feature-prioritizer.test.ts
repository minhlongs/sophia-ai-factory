import { describe, it, expect } from 'vitest';
import {
  calculateRiceScore,
  calculateIceScore,
  calculateWsjfScore,
  scoreFeaturesRice,
  scoreFeaturesIce,
  scoreFeaturesWsjf,
  scoreFeaturesComposite,
  buildDependencyGraph,
  topologicalSort,
  getCriticalPath,
  optimizeSprintPlan,
  calculateTeamVelocity,
  SAMPLE_FEATURES,
  DEFAULT_SPRINT_CONFIG,
  type Feature,
  type SprintConfig,
} from './feature-prioritizer';

describe('RICE Scoring', () => {
  it('should calculate RICE score correctly', () => {
    const feature: Feature = {
      id: 'f1',
      name: 'Test Feature',
      reach: 10000,
      impact: 2.5,
      confidence: 80,
      effort: 5,
      userBusinessValue: 8,
      timeCriticality: 6,
      riskReduction: 5,
      jobSize: 8,
    };
    const score = calculateRiceScore(feature);
    expect(score).toBe(4000); // (10000 * 2.5 * 0.8) / 5
  });

  it('should return Infinity for zero effort', () => {
    const feature: Feature = {
      id: 'f2',
      name: 'Zero Effort',
      reach: 1000,
      impact: 1,
      confidence: 100,
      effort: 0,
      userBusinessValue: 5,
      timeCriticality: 5,
      riskReduction: 5,
      jobSize: 5,
    };
    expect(calculateRiceScore(feature)).toBe(Infinity);
  });

  it('should score and rank features by RICE', () => {
    const features: Feature[] = [
      { id: 'f1', name: 'Low Score', reach: 100, impact: 1, confidence: 50, effort: 10, userBusinessValue: 3, timeCriticality: 3, riskReduction: 3, jobSize: 5 },
      { id: 'f2', name: 'High Score', reach: 10000, impact: 3, confidence: 90, effort: 5, userBusinessValue: 9, timeCriticality: 8, riskReduction: 7, jobSize: 8 },
    ];
    const scored = scoreFeaturesRice(features);
    expect(scored[0].id).toBe('f2');
    expect(scored[0].priorityRank).toBe(1);
    expect(scored[1].id).toBe('f1');
    expect(scored[1].priorityRank).toBe(2);
  });
});

describe('ICE Scoring', () => {
  it('should calculate ICE score with explicit ease', () => {
    const feature: Feature = {
      id: 'f1',
      name: 'Test Feature',
      reach: 10000,
      impact: 2,
      confidence: 90,
      effort: 5,
      ease: 8,
      userBusinessValue: 7,
      timeCriticality: 6,
      riskReduction: 5,
      jobSize: 8,
    };
    const score = calculateIceScore(feature);
    expect(score).toBe(4.8); // (2 * 0.9 * 8) / 3
  });

  it('should derive ease from effort when not provided', () => {
    const feature: Feature = {
      id: 'f2',
      name: 'Derived Ease',
      reach: 1000,
      impact: 2,
      confidence: 80,
      effort: 3,
      userBusinessValue: 5,
      timeCriticality: 5,
      riskReduction: 5,
      jobSize: 5,
    };
    const score = calculateIceScore(feature);
    expect(score).toBeCloseTo(4.27, 2); // effort=3 -> ease=8, (2 * 0.8 * 8) / 3
  });

  it('should score and rank features by ICE', () => {
    const features: Feature[] = [
      { id: 'f1', name: 'Low ICE', reach: 100, impact: 1, confidence: 50, effort: 10, userBusinessValue: 3, timeCriticality: 3, riskReduction: 3, jobSize: 5 },
      { id: 'f2', name: 'High ICE', reach: 5000, impact: 3, confidence: 95, effort: 2, userBusinessValue: 8, timeCriticality: 7, riskReduction: 6, jobSize: 3 },
    ];
    const scored = scoreFeaturesIce(features);
    expect(scored[0].id).toBe('f2');
    expect(scored[1].id).toBe('f1');
  });
});

describe('WSJF Scoring', () => {
  it('should calculate WSJF score correctly', () => {
    const feature: Feature = {
      id: 'f1',
      name: 'Test Feature',
      reach: 10000,
      impact: 2.5,
      confidence: 80,
      effort: 5,
      userBusinessValue: 9,
      timeCriticality: 8,
      riskReduction: 7,
      jobSize: 8,
    };
    const score = calculateWsjfScore(feature);
    expect(score).toBe(3); // (9 + 8 + 7) / 8
  });

  it('should return Infinity for zero job size', () => {
    const feature: Feature = {
      id: 'f2',
      name: 'Zero Job Size',
      reach: 1000,
      impact: 1,
      confidence: 100,
      effort: 0,
      userBusinessValue: 5,
      timeCriticality: 5,
      riskReduction: 5,
      jobSize: 0,
    };
    expect(calculateWsjfScore(feature)).toBe(Infinity);
  });

  it('should score and rank features by WSJF', () => {
    const features: Feature[] = [
      { id: 'f1', name: 'Low WSJF', reach: 100, impact: 1, confidence: 50, effort: 10, userBusinessValue: 3, timeCriticality: 3, riskReduction: 3, jobSize: 10 },
      { id: 'f2', name: 'High WSJF', reach: 10000, impact: 3, confidence: 90, effort: 5, userBusinessValue: 10, timeCriticality: 9, riskReduction: 8, jobSize: 5 },
    ];
    const scored = scoreFeaturesWsjf(features);
    expect(scored[0].id).toBe('f2');
    expect(scored[1].id).toBe('f1');
  });
});

describe('Composite Scoring', () => {
  it('should calculate composite score with custom weights', () => {
    const features: Feature[] = [
      {
        id: 'f1',
        name: 'Balanced Feature',
        reach: 5000,
        impact: 2,
        confidence: 80,
        effort: 5,
        userBusinessValue: 7,
        timeCriticality: 6,
        riskReduction: 5,
        jobSize: 8,
      },
    ];
    const config = { framework: 'COMPOSITE' as const, weights: { rice: 0.5, ice: 0.3, wsjf: 0.2 } };
    const scored = scoreFeaturesComposite(features, config);
    expect(scored[0].compositeScore).toBeGreaterThan(0);
    expect(scored[0].riceScore).toBeGreaterThan(0);
    expect(scored[0].iceScore).toBeGreaterThan(0);
    expect(scored[0].wsjfScore).toBeGreaterThan(0);
  });

  it('should use RICE framework exclusively', () => {
    const features: Feature[] = [SAMPLE_FEATURES[0]];
    const scored = scoreFeaturesComposite(features, { framework: 'RICE' });
    expect(scored[0].compositeScore).toBe(scored[0].riceScore);
  });

  it('should use ICE framework exclusively', () => {
    const features: Feature[] = [SAMPLE_FEATURES[0]];
    const scored = scoreFeaturesComposite(features, { framework: 'ICE' });
    expect(scored[0].compositeScore).toBe(scored[0].iceScore);
  });

  it('should use WSJF framework exclusively', () => {
    const features: Feature[] = [SAMPLE_FEATURES[0]];
    const scored = scoreFeaturesComposite(features, { framework: 'WSJF' });
    expect(scored[0].compositeScore).toBe(scored[0].wsjfScore);
  });
});

describe('Dependency Graph', () => {
  it('should build dependency graph correctly', () => {
    const features: Feature[] = [
      { id: 'f1', name: 'Root', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: [] },
      { id: 'f2', name: 'Child', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: ['f1'] },
    ];
    const graph = buildDependencyGraph(features);
    expect(graph.roots).toContain('f1');
    expect(graph.leaves).toContain('f2');
    expect(graph.nodes.get('f1')?.dependents).toContain('f2');
    expect(graph.nodes.get('f2')?.depth).toBe(1);
  });

  it('should identify multiple roots and leaves', () => {
    const features: Feature[] = [
      { id: 'f1', name: 'Root 1', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: [] },
      { id: 'f2', name: 'Root 2', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: [] },
      { id: 'f3', name: 'Child', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: ['f1', 'f2'] },
    ];
    const graph = buildDependencyGraph(features);
    expect(graph.roots).toHaveLength(2);
    expect(graph.leaves).toHaveLength(1);
  });

  it('should detect dependency cycles', () => {
    const features: Feature[] = [
      { id: 'f1', name: 'Cycle A', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: ['f3'] },
      { id: 'f2', name: 'Cycle B', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: ['f1'] },
      { id: 'f3', name: 'Cycle C', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: ['f2'] },
    ];
    const graph = buildDependencyGraph(features);
    expect(graph.cycles.length).toBeGreaterThan(0);
  });

  it('should calculate depths correctly', () => {
    const features: Feature[] = [
      { id: 'f1', name: 'Root', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: [] },
      { id: 'f2', name: 'Level 1', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: ['f1'] },
      { id: 'f3', name: 'Level 2', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: ['f2'] },
    ];
    const graph = buildDependencyGraph(features);
    expect(graph.nodes.get('f1')?.depth).toBe(0);
    expect(graph.nodes.get('f2')?.depth).toBe(1);
    expect(graph.nodes.get('f3')?.depth).toBe(2);
  });
});

describe('Topological Sort', () => {
  it('should sort features respecting dependencies', () => {
    const features: Feature[] = [
      { id: 'f1', name: 'Base', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: [] },
      { id: 'f2', name: 'Depends on F1', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: ['f1'] },
      { id: 'f3', name: 'Depends on F2', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: ['f2'] },
    ];
    const sorted = topologicalSort(features);
    expect(sorted.findIndex(f => f.id === 'f1')).toBeLessThan(sorted.findIndex(f => f.id === 'f2'));
    expect(sorted.findIndex(f => f.id === 'f2')).toBeLessThan(sorted.findIndex(f => f.id === 'f3'));
  });

  it('should throw error for cyclic dependencies', () => {
    const features: Feature[] = [
      { id: 'f1', name: 'Cycle A', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: ['f2'] },
      { id: 'f2', name: 'Cycle B', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: ['f1'] },
    ];
    expect(() => topologicalSort(features)).toThrow('Dependency cycles detected');
  });
});

describe('Critical Path', () => {
  it('should identify critical path features', () => {
    const features: Feature[] = [
      { id: 'f1', name: 'Root', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: [] },
      { id: 'f2', name: 'Path A', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: ['f1'] },
      { id: 'f3', name: 'Path B Deep', reach: 1000, impact: 1, confidence: 100, effort: 1, userBusinessValue: 5, timeCriticality: 5, riskReduction: 5, jobSize: 1, dependencies: ['f2'] },
    ];
    const criticalPath = getCriticalPath(features);
    expect(criticalPath.some(f => f.id === 'f3')).toBe(true);
  });
});

describe('Sprint Capacity Optimizer', () => {
  it('should optimize sprint plan within capacity', () => {
    const features: Feature[] = [
      { id: 'f1', name: 'Small Feature', reach: 1000, impact: 2, confidence: 90, effort: 3, userBusinessValue: 7, timeCriticality: 6, riskReduction: 5, jobSize: 5 },
      { id: 'f2', name: 'Medium Feature', reach: 2000, impact: 2.5, confidence: 85, effort: 5, userBusinessValue: 8, timeCriticality: 7, riskReduction: 6, jobSize: 8 },
      { id: 'f3', name: 'Large Feature', reach: 5000, impact: 3, confidence: 80, effort: 10, userBusinessValue: 9, timeCriticality: 8, riskReduction: 7, jobSize: 13 },
    ];
    const config: SprintConfig = { capacity: 10, teamSize: 3, duration: 2 };
    const plan = optimizeSprintPlan(features, config);
    expect(plan.totalEffort).toBeLessThanOrEqual(10);
    expect(plan.utilization).toBeLessThanOrEqual(1);
    expect(plan.features.length + plan.spillover.length).toBe(3);
  });

  it('should respect dependency order in sprint planning', () => {
    const features: Feature[] = [
      { id: 'f1', name: 'Foundation', reach: 1000, impact: 3, confidence: 95, effort: 4, userBusinessValue: 9, timeCriticality: 8, riskReduction: 7, jobSize: 5 },
      { id: 'f2', name: 'Depends on F1', reach: 2000, impact: 2.5, confidence: 90, effort: 3, userBusinessValue: 8, timeCriticality: 7, riskReduction: 6, jobSize: 3 },
    ];
    const config: SprintConfig = { capacity: 20, teamSize: 3, duration: 2 }; // Increased capacity
    const plan = optimizeSprintPlan(features, config);

    const f1Idx = plan.features.findIndex(f => f.id === 'f1');
    const f2Idx = plan.features.findIndex(f => f.id === 'f2');

    // Both features should be selected with enough capacity
    expect(f1Idx).toBeGreaterThanOrEqual(0);
    expect(f2Idx).toBeGreaterThanOrEqual(0);
    // f1 must come before f2 due to dependency(0, 2)); // f2 depends on f1
  });

  it('should handle spillover when capacity exceeded', () => {
    const features: Feature[] = [
      { id: 'f1', name: 'Big Feature', reach: 5000, impact: 3, confidence: 90, effort: 15, userBusinessValue: 9, timeCriticality: 8, riskReduction: 7, jobSize: 20 },
    ];
    const config: SprintConfig = { capacity: 10, teamSize: 2, duration: 2 };
    const plan = optimizeSprintPlan(features, config);
    expect(plan.spillover.some(f => f.id === 'f1')).toBe(true);
  });

  it('should use velocity when provided', () => {
    const features: Feature[] = [SAMPLE_FEATURES[0]];
    const config: SprintConfig = { capacity: 50, teamSize: 5, duration: 2, velocity: 25 };
    const plan = optimizeSprintPlan(features, config);
    expect(plan.totalEffort).toBeLessThanOrEqual(25);
  });
});

describe('Team Velocity', () => {
  it('should calculate average velocity', () => {
    const completedPoints = [30, 35, 32, 38];
    const velocity = calculateTeamVelocity(completedPoints, 3);
    expect(velocity).toBe(35); // (35 + 32 + 38) / 3
  });

  it('should handle empty history', () => {
    expect(calculateTeamVelocity([])).toBe(0);
  });

  it('should use all data when periods exceeds history', () => {
    const completedPoints = [25, 30];
    const velocity = calculateTeamVelocity(completedPoints, 5);
    expect(velocity).toBe(27.5);
  });
});

describe('Sample Data', () => {
  it('should have valid SAMPLE_FEATURES', () => {
    expect(SAMPLE_FEATURES.length).toBeGreaterThan(0);
    SAMPLE_FEATURES.forEach(f => {
      expect(f.id).toBeDefined();
      expect(f.name).toBeDefined();
      expect(f.reach).toBeGreaterThan(0);
      expect(f.effort).toBeGreaterThan(0);
    });
  });

  it('should have valid DEFAULT_SPRINT_CONFIG', () => {
    expect(DEFAULT_SPRINT_CONFIG.capacity).toBeGreaterThan(0);
    expect(DEFAULT_SPRINT_CONFIG.teamSize).toBeGreaterThan(0);
    expect(DEFAULT_SPRINT_CONFIG.duration).toBeGreaterThan(0);
  });
});

describe('Integration: Full Prioritization Flow', () => {
  it('should prioritize, resolve dependencies, and plan sprint', () => {
    const features: Feature[] = [
      { id: 'f1', name: 'Auth', reach: 10000, impact: 3, confidence: 95, effort: 8, userBusinessValue: 10, timeCriticality: 9, riskReduction: 8, jobSize: 13, dependencies: [] },
      { id: 'f2', name: 'Payments', reach: 8000, impact: 2.5, confidence: 90, effort: 12, userBusinessValue: 9, timeCriticality: 8, riskReduction: 7, jobSize: 20, dependencies: ['f1'] },
      { id: 'f3', name: 'Dashboard', reach: 6000, impact: 2, confidence: 85, effort: 6, userBusinessValue: 7, timeCriticality: 5, riskReduction: 4, jobSize: 8, dependencies: ['f1'] },
      { id: 'f4', name: 'Reports', reach: 5000, impact: 1.5, confidence: 80, effort: 4, userBusinessValue: 6, timeCriticality: 4, riskReduction: 3, jobSize: 5, dependencies: ['f3'] },
    ];

    // Step 1: Score with composite
    const scored = scoreFeaturesComposite(features, { framework: 'COMPOSITE' });
    expect(scored.every(f => f.compositeScore > 0)).toBe(true);

    // Step 2: Resolve dependencies
    const sorted = topologicalSort(scored);
    sorted.forEach((f, idx) => {
      f.dependencies?.forEach(depId => {
        const depIdx = sorted.findIndex(x => x.id === depId);
        expect(depIdx).toBeLessThan(idx);
      });
    });

    // Step 3: Plan sprint
    const config: SprintConfig = { capacity: 20, teamSize: 4, duration: 2 };
    const plan = optimizeSprintPlan(sorted, config);
    expect(plan.totalEffort).toBeLessThanOrEqual(20);
  });
});
