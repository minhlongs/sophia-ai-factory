/**
 * Feature Prioritization Engine
 *
 * Multi-framework scorer (RICE/ICE/WSJF), dependency graph resolver,
 * and sprint capacity optimizer for product roadmap planning.
 *
 * @packageDocumentation
 */

/**
 * Feature representation with all scoring parameters
 */
export interface Feature {
  id: string;
  name: string;
  description?: string;
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  ease?: number;
  userBusinessValue: number;
  timeCriticality: number;
  riskReduction: number;
  jobSize: number;
  dependencies?: string[];
}

/**
 * Feature with computed scores attached
 */
export interface ScoredFeature extends Feature {
  riceScore: number;
  iceScore: number;
  wsjfScore: number;
  compositeScore: number;
  priorityRank: number;
  dependencyDepth?: number;
}

/**
 * Dependency graph structure
 */
export interface DependencyGraph {
  nodes: Map<string, { feature: Feature; dependents: string[]; depth: number }>;
  roots: string[];
  leaves: string[];
  cycles: string[][];
}

/**
 * Sprint planning result
 */
export interface SprintPlan {
  features: ScoredFeature[];
  spillover: ScoredFeature[];
  totalEffort: number;
  capacity: number;
  utilization: number;
}

/**
 * Sprint configuration
 */
export interface SprintConfig {
  capacity: number;
  teamSize: number;
  duration: number;
  velocity?: number;
}

/**
 * Framework selection for scoring
 */
export type ScoringFramework = 'RICE' | 'ICE' | 'WSJF' | 'COMPOSITE';

/**
 * Scoring configuration
 */
export interface ScoringConfig {
  framework: ScoringFramework;
  weights?: { rice: number; ice: number; wsjf: number };
}

/**
 * Default sprint configuration
 */
export const DEFAULT_SPRINT_CONFIG: SprintConfig = {
  capacity: 20,
  teamSize: 4,
  duration: 2,
};

/**
 * Default scoring weights for composite framework
 */
export const DEFAULT_WEIGHTS = { rice: 0.4, ice: 0.3, wsjf: 0.3 };

/**
 * Calculate RICE score: (Reach × Impact × Confidence) / Effort
 */
export function calculateRiceScore(feature: Feature): number {
  if (feature.effort === 0) return Infinity;
  return (feature.reach * feature.impact * (feature.confidence / 100)) / feature.effort;
}

/**
 * Calculate ICE score: (Impact × Confidence × Ease) / 3
 * Ease derived from effort if not provided (11 - effort, min 1)
 */
export function calculateIceScore(feature: Feature): number {
  const ease = feature.ease ?? Math.max(1, 11 - feature.effort);
  return (feature.impact * (feature.confidence / 100) * ease) / 3;
}

/**
 * Calculate WSJF score: (User Business Value + Time Criticality + Risk Reduction) / Job Size
 */
export function calculateWsjfScore(feature: Feature): number {
  if (feature.jobSize === 0) return Infinity;
  return (feature.userBusinessValue + feature.timeCriticality + feature.riskReduction) / feature.jobSize;
}

/**
 * Score features using RICE framework
 */
export function scoreFeaturesRice(features: Feature[]): ScoredFeature[] {
  return features
    .map(f => ({
      ...f,
      riceScore: calculateRiceScore(f),
      iceScore: 0,
      wsjfScore: 0,
      compositeScore: 0,
      priorityRank: 0,
    }))
    .sort((a, b) => b.riceScore - a.riceScore)
    .map((f, i) => ({ ...f, priorityRank: i + 1 }));
}

/**
 * Score features using ICE framework
 */
export function scoreFeaturesIce(features: Feature[]): ScoredFeature[] {
  return features
    .map(f => ({
      ...f,
      riceScore: 0,
      iceScore: calculateIceScore(f),
      wsjfScore: 0,
      compositeScore: 0,
      priorityRank: 0,
    }))
    .sort((a, b) => b.iceScore - a.iceScore)
    .map((f, i) => ({ ...f, priorityRank: i + 1 }));
}

/**
 * Score features using WSJF framework
 */
export function scoreFeaturesWsjf(features: Feature[]): ScoredFeature[] {
  return features
    .map(f => ({
      ...f,
      riceScore: 0,
      iceScore: 0,
      wsjfScore: calculateWsjfScore(f),
      compositeScore: 0,
      priorityRank: 0,
    }))
    .sort((a, b) => b.wsjfScore - a.wsjfScore)
    .map((f, i) => ({ ...f, priorityRank: i + 1 }));
}

/**
 * Score features using composite or single framework
 */
export function scoreFeaturesComposite(features: Feature[], config: ScoringConfig): ScoredFeature[] {
  const weights = config.weights ?? DEFAULT_WEIGHTS;

  return features
    .map(f => {
      const rice = calculateRiceScore(f);
      const ice = calculateIceScore(f);
      const wsjf = calculateWsjfScore(f);

      let composite = 0;
      if (config.framework === 'RICE') composite = rice;
      else if (config.framework === 'ICE') composite = ice;
      else if (config.framework === 'WSJF') composite = wsjf;
      else composite = rice * weights.rice + ice * weights.ice + wsjf * weights.wsjf;

      return {
        ...f,
        riceScore: rice,
        iceScore: ice,
        wsjfScore: wsjf,
        compositeScore: composite,
        priorityRank: 0,
      };
    })
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .map((f, i) => ({ ...f, priorityRank: i + 1 }));
}

/**
 * Build dependency graph from features
 */
export function buildDependencyGraph(features: Feature[]): DependencyGraph {
  const nodes = new Map<string, { feature: Feature; dependents: string[]; depth: number }>();
  const inDegree = new Map<string, number>();

  // Initialize nodes
  features.forEach(f => {
    nodes.set(f.id, { feature: f, dependents: [], depth: 0 });
    inDegree.set(f.id, f.dependencies?.length ?? 0);
  });

  // Build dependents map
  features.forEach(f => {
    f.dependencies?.forEach(depId => {
      nodes.get(depId)?.dependents.push(f.id);
    });
  });

  // Find roots (no dependencies) and leaves (no dependents)
  const roots = features.filter(f => !f.dependencies?.length).map(f => f.id);
  const leaves = features.filter(f => !nodes.get(f.id)?.dependents.length).map(f => f.id);

  // Calculate depths using BFS
  const queue = [...roots];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodes.get(id)!;
    node.dependents.forEach(depId => {
      const depNode = nodes.get(depId)!;
      depNode.depth = Math.max(depNode.depth, node.depth + 1);
      inDegree.set(depId, (inDegree.get(depId) ?? 1) - 1);
      if (inDegree.get(depId) === 0) queue.push(depId);
    });
  }

  // Detect cycles using DFS
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function detectCycle(id: string, path: string[]): void {
    if (recStack.has(id)) {
      const cycleStart = path.indexOf(id);
      cycles.push(path.slice(cycleStart));
      return;
    }
    if (visited.has(id)) return;

    visited.add(id);
    recStack.add(id);
    path.push(id);

    const deps = nodes.get(id)?.feature.dependencies ?? [];
    deps.forEach(depId => detectCycle(depId, [...path]));

    recStack.delete(id);
  }

  features.forEach(f => detectCycle(f.id, []));

  return { nodes, roots, leaves, cycles };
}

/**
 * Topological sort using Kahn's algorithm
 */
export function topologicalSort(features: Feature[]): Feature[] {
  const graph = buildDependencyGraph(features);

  if (graph.cycles.length > 0) {
    throw new Error(`Dependency cycles detected: ${graph.cycles.map(c => c.join(' → ')).join(', ')}`);
  }

  const inDegree = new Map<string, number>();
  features.forEach(f => {
    inDegree.set(f.id, f.dependencies?.length ?? 0);
  });

  const queue = features.filter(f => !f.dependencies?.length);
  const result: Feature[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    graph.nodes.get(current.id)?.dependents.forEach(depId => {
      inDegree.set(depId, (inDegree.get(depId) ?? 1) - 1);
      if (inDegree.get(depId) === 0) {
        const dep = features.find(f => f.id === depId);
        if (dep) queue.push(dep);
      }
    });
  }

  // Add any remaining features (disconnected)
  features.forEach(f => {
    if (!result.includes(f)) result.push(f);
  });

  return result;
}

/**
 * Get critical path (longest dependency chain)
 */
export function getCriticalPath(features: Feature[]): Feature[] {
  const graph = buildDependencyGraph(features);

  // Find deepest node
  let maxDepth = 0;
  let deepestId = features[0]?.id;
  graph.nodes.forEach((node, id) => {
    if (node.depth > maxDepth) {
      maxDepth = node.depth;
      deepestId = id;
    }
  });

  // Trace back to root
  const path: Feature[] = [];
  let currentId = deepestId;

  while (currentId) {
    const feature = features.find(f => f.id === currentId);
    if (feature) {
      path.unshift(feature);
      const deps = feature.dependencies ?? [];
      currentId = deps[0];
    } else {
      currentId = '';
    }
  }

  return path;
}

/**
 * Optimize sprint plan with capacity constraints
 */
export function optimizeSprintPlan(features: ScoredFeature[], config: SprintConfig): SprintPlan {
  const capacity = config.velocity ?? config.capacity;
  const sorted = [...features].sort((a, b) => {
    // First by dependency depth (ascending)
    const depthA = a.dependencyDepth ?? 0;
    const depthB = b.dependencyDepth ?? 0;
    if (depthA !== depthB) return depthA - depthB;
    // Then by composite score (descending)
    return b.compositeScore - a.compositeScore;
  });

  const selected: ScoredFeature[] = [];
  const spillover: ScoredFeature[] = [];
  let totalEffort = 0;
  const selectedIds = new Set<string>();

  for (const feature of sorted) {
    const depsSatisfied = !feature.dependencies?.length ||
      feature.dependencies.every(depId => selectedIds.has(depId));

    if (depsSatisfied && totalEffort + feature.effort <= capacity) {
      selected.push(feature);
      totalEffort += feature.effort;
      selectedIds.add(feature.id);
    } else {
      spillover.push(feature);
    }
  }

  return {
    features: selected,
    spillover,
    totalEffort,
    capacity,
    utilization: totalEffort / capacity,
  };
}

/**
 * Calculate team velocity from historical data
 */
export function calculateTeamVelocity(completedPoints: number[], periods = 3): number {
  if (!completedPoints.length) return 0;
  const recent = completedPoints.slice(-periods);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

/**
 * Sample features for testing and demonstration
 */
export const SAMPLE_FEATURES: Feature[] = [
  {
    id: 'f1',
    name: 'User Authentication',
    description: 'OAuth2 + email auth system',
    reach: 10000,
    impact: 3,
    confidence: 95,
    effort: 8,
    userBusinessValue: 10,
    timeCriticality: 9,
    riskReduction: 8,
    jobSize: 13,
    dependencies: [],
  },
  {
    id: 'f2',
    name: 'Analytics Dashboard',
    description: 'Real-time metrics visualization',
    reach: 8000,
    impact: 2.5,
    confidence: 90,
    effort: 12,
    userBusinessValue: 8,
    timeCriticality: 6,
    riskReduction: 5,
    jobSize: 20,
    dependencies: ['f1'],
  },
  {
    id: 'f3',
    name: 'API Rate Limiting',
    description: 'Protection against abuse',
    reach: 5000,
    impact: 2,
    confidence: 85,
    effort: 4,
    userBusinessValue: 7,
    timeCriticality: 8,
    riskReduction: 9,
    jobSize: 5,
    dependencies: [],
  },
];

export default {
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
  DEFAULT_WEIGHTS,
};

