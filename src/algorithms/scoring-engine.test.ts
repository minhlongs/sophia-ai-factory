import { describe, it, expect } from 'vitest';
import {
  calculateWeightedScore,
  calculateConcordance,
  calculateDiscordance,
  calculateUtility,
  scoreProposalsWeighted,
  scoreProposalsOutranking,
  scoreProposalsUtility,
  scoreProposalsHybrid,
  validateCriteria,
  normalizeCriteria,
  outrankingRelation,
  scoreProposalsTOPSIS,
  normalizeDecisionMatrix,
  applyWeights,
  findIdealSolutions,
  calculateDistance,
  analyzeTOPSIS,
  DEFAULT_CRITERIA,
  SAMPLE_PROPOSALS,
  DEFAULT_CONFIG,
  type ScoringCriteria,
  type ProposalOption,
  type UtilityConfig,
  type TOPSISResult,
} from './scoring-engine';

describe('Weighted Sum Model', () => {
  const criteria: ScoringCriteria[] = [
    { id: 'c1', name: 'Quality', weight: 0.4, direction: 'benefit' },
    { id: 'c2', name: 'Cost', weight: 0.3, direction: 'cost' },
    { id: 'c3', name: 'Timeline', weight: 0.3, direction: 'benefit' },
  ];

  it('should calculate weighted score correctly', () => {
    const option: ProposalOption = {
      id: 'p1',
      name: 'Test Proposal',
      scores: { c1: 80, c2: 60, c3: 70 },
    };
    const score = calculateWeightedScore(option, criteria);
    // c1: 0.8 * 0.4 = 0.32, c2: 0.4 * 0.3 = 0.12, c3: 0.7 * 0.3 = 0.21 => 0.65
    expect(score).toBeCloseTo(0.65, 2);
  });

  it('should handle missing scores gracefully', () => {
    const option: ProposalOption = {
      id: 'p2',
      name: 'Incomplete Proposal',
      scores: { c1: 80 },
    };
    const score = calculateWeightedScore(option, criteria);
    // Missing scores are treated as 0, but weight sum is still 1.0
    // Score will be lower than complete proposals but not zero
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(0.7);
  });

  it('should normalize cost criteria correctly (lower is better)', () => {
    const costCriteria: ScoringCriteria[] = [
      { id: 'cost', name: 'Cost', weight: 1, direction: 'cost' },
    ];
    const highCostOption: ProposalOption = {
      id: 'p1',
      name: 'Expensive',
      scores: { cost: 90 },
    };
    const lowCostOption: ProposalOption = {
      id: 'p2',
      name: 'Cheap',
      scores: { cost: 20 },
    };
    expect(calculateWeightedScore(highCostOption, costCriteria)).toBeCloseTo(0.1, 2);
    expect(calculateWeightedScore(lowCostOption, costCriteria)).toBeCloseTo(0.8, 2);
  });

  it('should score and rank multiple proposals', () => {
    const options: ProposalOption[] = [
      { id: 'p1', name: 'Low Score', scores: { c1: 30, c2: 30, c3: 30 } },
      { id: 'p2', name: 'High Score', scores: { c1: 90, c2: 90, c3: 90 } },
    ];
    const results = scoreProposalsWeighted(options, criteria);
    expect(results[0].optionId).toBe('p2');
    expect(results[0].rank).toBe(1);
    expect(results[1].optionId).toBe('p1');
    expect(results[1].rank).toBe(2);
  });

  it('should include criterion breakdown in results', () => {
    const options: ProposalOption[] = [SAMPLE_PROPOSALS[0]];
    const results = scoreProposalsWeighted(options, DEFAULT_CRITERIA);
    expect(Object.keys(results[0].criterionBreakdown).length).toBe(DEFAULT_CRITERIA.length);
  });
});

describe('Criteria Validation', () => {
  it('should validate weights sum to 1', () => {
    const validCriteria: ScoringCriteria[] = [
      { id: 'c1', name: 'C1', weight: 0.4, direction: 'benefit' },
      { id: 'c2', name: 'C2', weight: 0.6, direction: 'benefit' },
    ];
    expect(validateCriteria(validCriteria)).toBe(true);
  });

  it('should reject weights not summing to 1', () => {
    const invalidCriteria: ScoringCriteria[] = [
      { id: 'c1', name: 'C1', weight: 0.3, direction: 'benefit' },
      { id: 'c2', name: 'C2', weight: 0.3, direction: 'benefit' },
    ];
    expect(validateCriteria(invalidCriteria)).toBe(false);
  });

  it('should normalize criteria weights', () => {
    const criteria: ScoringCriteria[] = [
      { id: 'c1', name: 'C1', weight: 3, direction: 'benefit' },
      { id: 'c2', name: 'C2', weight: 7, direction: 'benefit' },
    ];
    const normalized = normalizeCriteria(criteria);
    expect(normalized[0].weight).toBeCloseTo(0.3, 2);
    expect(normalized[1].weight).toBeCloseTo(0.7, 2);
    expect(normalized.reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1, 2);
  });
});

describe('Outranking Method', () => {
  const criteria: ScoringCriteria[] = [
    { id: 'c1', name: 'Quality', weight: 0.5, direction: 'benefit' },
    { id: 'c2', name: 'Cost', weight: 0.5, direction: 'cost' },
  ];

  const optionA: ProposalOption = {
    id: 'A',
    name: 'Option A',
    scores: { c1: 80, c2: 70 },
  };

  const optionB: ProposalOption = {
    id: 'B',
    name: 'Option B',
    scores: { c1: 60, c2: 60 },
  };

  it('should calculate concordance index', () => {
    const concordance = calculateConcordance(optionA, optionB, criteria);
    // Concordance should be >= 0.5 (at least tie or better)
    expect(concordance).toBeGreaterThanOrEqual(0.5);
  });

  it('should calculate discordance index', () => {
    const discordance = calculateDiscordance(optionA, optionB, criteria);
    expect(discordance).toBeGreaterThanOrEqual(0);
    expect(discordance).toBeLessThanOrEqual(1);
  });

  it('should determine outranking relation', () => {
    const result = outrankingRelation(optionA, optionB, criteria, 0.5);
    expect(result.optionA).toBe('A');
    expect(result.optionB).toBe('B');
    expect(typeof result.concordance).toBe('number');
    expect(typeof result.discordance).toBe('number');
    expect(typeof result.outranks).toBe('boolean');
  });

  it('should score proposals using outranking', () => {
    const options: ProposalOption[] = [optionA, optionB];
    const results = scoreProposalsOutranking(options, criteria);
    expect(results.length).toBe(2);
    expect(results.every(r => r.rank > 0)).toBe(true);
    expect(results.every(r => r.netOutranking !== undefined)).toBe(true);
  });
});

describe('Utility Theory', () => {
  const criteria: ScoringCriteria[] = [
    { id: 'c1', name: 'Quality', weight: 1, direction: 'benefit' },
  ];

  it('should calculate linear utility (risk neutral)', () => {
    const config: UtilityConfig = { riskAttitude: 'neutral', utilityFunction: 'linear' };
    expect(calculateUtility(50, config)).toBeCloseTo(0.5, 2);
    expect(calculateUtility(100, config)).toBeCloseTo(1, 2);
  });

  it('should calculate exponential utility (risk averse)', () => {
    const config: UtilityConfig = { riskAttitude: 'averse', utilityFunction: 'exponential' };
    expect(calculateUtility(25, config)).toBeCloseTo(0.5, 2);
    expect(calculateUtility(100, config)).toBeCloseTo(1, 2);
  });

  it('should calculate exponential utility (risk seeking)', () => {
    const config: UtilityConfig = { riskAttitude: 'seeking', utilityFunction: 'exponential' };
    expect(calculateUtility(50, config)).toBeLessThan(0.5);
  });

  it('should calculate logarithmic utility', () => {
    const config: UtilityConfig = { riskAttitude: 'neutral', utilityFunction: 'logarithmic' };
    const utility = calculateUtility(100, config);
    expect(utility).toBeGreaterThan(0);
    expect(utility).toBeLessThanOrEqual(1);
  });

  it('should score proposals with utility theory', () => {
    const options: ProposalOption[] = [
      { id: 'p1', name: 'Safe Bet', scores: { c1: 70 } },
      { id: 'p2', name: 'Risky Choice', scores: { c1: 90 } },
    ];
    const config: UtilityConfig = { riskAttitude: 'neutral', utilityFunction: 'linear' };
    const results = scoreProposalsUtility(options, criteria, config);
    expect(results.length).toBe(2);
    expect(results[1].expectedUtility).toBeGreaterThan(results[0].expectedUtility);
  });
});

describe('Hybrid Method', () => {
  const criteria: ScoringCriteria[] = DEFAULT_CRITERIA;
  const options: ProposalOption[] = SAMPLE_PROPOSALS;

  it('should use weighted method when specified', () => {
    const config = { method: 'weighted' as const };
    const results = scoreProposalsHybrid(options, criteria, config);
    expect(results.length).toBe(options.length);
  });

  it('should use outranking method when specified', () => {
    const config = { method: 'outranking' as const, outrankingThreshold: 0.6 };
    const results = scoreProposalsHybrid(options, criteria, config);
    expect(results.length).toBe(options.length);
  });

  it('should use utility method when specified', () => {
    const config = {
      method: 'utility' as const,
      utilityConfig: { riskAttitude: 'neutral' as const, utilityFunction: 'linear' as const },
    };
    const results = scoreProposalsHybrid(options, criteria, config);
    expect(results.length).toBe(options.length);
  });

  it('should use hybrid method by default', () => {
    const results = scoreProposalsHybrid(options, criteria, DEFAULT_CONFIG);
    expect(results.length).toBe(options.length);
    expect(results.every(r => r.rank > 0)).toBe(true);
  });
});

describe('Sample Data', () => {
  it('should have valid DEFAULT_CRITERIA', () => {
    expect(DEFAULT_CRITERIA.length).toBeGreaterThan(0);
    expect(validateCriteria(DEFAULT_CRITERIA)).toBe(true);
    DEFAULT_CRITERIA.forEach(c => {
      expect(c.id).toBeDefined();
      expect(c.name).toBeDefined();
      expect(c.weight).toBeGreaterThan(0);
      expect(c.weight).toBeLessThanOrEqual(1);
    });
  });

  it('should have valid SAMPLE_PROPOSALS', () => {
    expect(SAMPLE_PROPOSALS.length).toBeGreaterThan(0);
    SAMPLE_PROPOSALS.forEach(p => {
      expect(p.id).toBeDefined();
      expect(p.name).toBeDefined();
      expect(Object.keys(p.scores).length).toBeGreaterThan(0);
    });
  });

  it('should have valid DEFAULT_CONFIG', () => {
    expect(DEFAULT_CONFIG.method).toBeDefined();
    expect(DEFAULT_CONFIG.outrankingThreshold).toBeDefined();
    expect(DEFAULT_CONFIG.utilityConfig).toBeDefined();
  });
});

describe('TOPSIS Method', () => {
  const criteria: ScoringCriteria[] = [
    { id: 'c1', name: 'Quality', weight: 0.4, direction: 'benefit' },
    { id: 'c2', name: 'Cost', weight: 0.3, direction: 'cost' },
    { id: 'c3', name: 'Timeline', weight: 0.3, direction: 'benefit' },
  ];

  const options: ProposalOption[] = [
    { id: 'p1', name: 'Proposal 1', scores: { c1: 80, c2: 60, c3: 70 } },
    { id: 'p2', name: 'Proposal 2', scores: { c1: 90, c2: 50, c3: 80 } },
    { id: 'p3', name: 'Proposal 3', scores: { c1: 70, c2: 80, c3: 60 } },
  ];

  it('should normalize decision matrix correctly', () => {
    const normalized = normalizeDecisionMatrix(options, criteria);
    expect(normalized.length).toBe(3);
    expect(normalized[0].length).toBe(3);
    // Each column should be normalized (sum of squares = 1)
    for (let j = 0; j < 3; j++) {
      const colSum = normalized.reduce((sum, row) => sum + row[j] * row[j], 0);
      expect(colSum).toBeCloseTo(1, 5);
    }
  });

  it('should apply weights to normalized matrix', () => {
    const normalized = normalizeDecisionMatrix(options, criteria);
    const weighted = applyWeights(normalized, criteria);
    expect(weighted.length).toBe(3);
    expect(weighted[0].length).toBe(3);
    // Verify weight application
    expect(weighted[0][0]).toBeCloseTo(normalized[0][0] * 0.4, 5);
    expect(weighted[0][1]).toBeCloseTo(normalized[0][1] * 0.3, 5);
    expect(weighted[0][2]).toBeCloseTo(normalized[0][2] * 0.3, 5);
  });

  it('should find ideal and anti-ideal solutions', () => {
    const normalized = normalizeDecisionMatrix(options, criteria);
    const weighted = applyWeights(normalized, criteria);
    const { positive, negative } = findIdealSolutions(weighted, criteria);
    expect(positive.length).toBe(3);
    expect(negative.length).toBe(3);
    // Positive ideal should be max of each column
    for (let j = 0; j < 3; j++) {
      const colMax = Math.max(...weighted.map(row => row[j]));
      const colMin = Math.min(...weighted.map(row => row[j]));
      expect(positive[j]).toBeCloseTo(colMax, 5);
      expect(negative[j]).toBeCloseTo(colMin, 5);
    }
  });

  it('should calculate Euclidean distance correctly', () => {
    const normalized = normalizeDecisionMatrix(options, criteria);
    const weighted = applyWeights(normalized, criteria);
    const { positive } = findIdealSolutions(weighted, criteria);
    const distances = calculateDistance(weighted, positive);
    expect(distances.length).toBe(3);
    distances.forEach(d => {
      expect(d).toBeGreaterThanOrEqual(0);
    });
  });

  it('should score proposals using TOPSIS', () => {
    const results = scoreProposalsTOPSIS(options, criteria);
    expect(results.length).toBe(3);
    results.forEach(r => {
      expect(r.optionId).toBeDefined();
      expect(r.optionName).toBeDefined();
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
      expect(r.rank).toBeGreaterThan(0);
      expect(r.distanceToIdeal).toBeGreaterThanOrEqual(0);
      expect(r.distanceToAntiIdeal).toBeGreaterThanOrEqual(0);
      expect(r.criterionScores).toBeDefined();
    });
    // Scores should be ranked
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('should handle empty inputs gracefully', () => {
    expect(scoreProposalsTOPSIS([], criteria)).toEqual([]);
    expect(scoreProposalsTOPSIS(options, [])).toEqual([]);
  });

  it('should analyze proposals with full matrix details', () => {
    const analysis = analyzeTOPSIS(options, criteria);
    expect(analysis.results.length).toBe(3);
    expect(analysis.matrix.normalized.length).toBe(3);
    expect(analysis.matrix.weighted.length).toBe(3);
    expect(analysis.matrix.positiveIdeal.length).toBe(3);
    expect(analysis.matrix.negativeIdeal.length).toBe(3);
  });

  it('should rank best option with highest relative closeness', () => {
    const results = scoreProposalsTOPSIS(options, criteria);
    const bestOption = results[0];
    expect(bestOption.rank).toBe(1);
    expect(bestOption.score).toBeGreaterThan(0);
  });
});

describe('Integration: Full Proposal Evaluation', () => {
  it('should complete proposal evaluation workflow', () => {
    const criteria = normalizeCriteria([
      { id: 'technical', name: 'Technical', weight: 0.3, direction: 'benefit' },
      { id: 'cost', name: 'Cost', weight: 0.3, direction: 'cost' },
      { id: 'quality', name: 'Quality', weight: 0.2, direction: 'benefit' },
      { id: 'risk', name: 'Risk', weight: 0.2, direction: 'cost' },
    ]);

    const options: ProposalOption[] = [
      {
        id: 'vendor-a',
        name: 'Vendor A',
        scores: { technical: 85, cost: 70, quality: 90, risk: 80 },
        cost: 100000,
      },
      {
        id: 'vendor-b',
        name: 'Vendor B',
        scores: { technical: 75, cost: 90, quality: 80, risk: 85 },
        cost: 60000,
      },
      {
        id: 'vendor-c',
        name: 'Vendor C',
        scores: { technical: 95, cost: 50, quality: 95, risk: 60 },
        cost: 200000,
      },
    ];

    // Step 1: Validate criteria
    expect(validateCriteria(criteria)).toBe(true);

    // Step 2: Weighted scoring
    const weightedResults = scoreProposalsWeighted(options, criteria);
    expect(weightedResults.length).toBe(3);

    // Step 3: Outranking analysis
    const outrankingResults = scoreProposalsOutranking(options, criteria);
    expect(outrankingResults.length).toBe(3);

    // Step 4: Utility analysis
    const utilityConfig: UtilityConfig = { riskAttitude: 'neutral', utilityFunction: 'linear' };
    const utilityResults = scoreProposalsUtility(options, criteria, utilityConfig);
    expect(utilityResults.length).toBe(3);

    // Step 5: Hybrid final scoring
    const hybridResults = scoreProposalsHybrid(options, criteria, {
      method: 'hybrid',
      outrankingThreshold: 0.6,
      utilityConfig,
    });
    expect(hybridResults.length).toBe(3);
    expect(hybridResults[0].rank).toBe(1);
  });
});
