/**
 * Competitive Moat Analyzer Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeMoat,
  calculateSwitchingCostScore,
  calculateNetworkEffectScore,
  calculateBrandStrengthScore,
  calculateDataAdvantageScore,
  determineMoatRating,
  determineCompetitivePosition,
  generateStrengths,
  generateWeaknesses,
  generateRecommendedActions,
  determineMoatTrend,
  DEFAULT_WEIGHTS,
  SAMPLE_DATA,
  type SwitchingCosts,
  type NetworkEffects,
  type BrandStrength,
  type DataAdvantage,
  type MoatComponentScores,
} from './moat-analyzer';

const mockSwitchingCosts: SwitchingCosts = {
  financialCost: 70,
  timeCost: 65,
  emotionalCost: 50,
  disruptionRisk: 75,
  dataMigrationComplexity: 80,
  learningCurve: 60,
  contractLockIn: 18,
  integrationDependencies: 6,
};

const mockNetworkEffects: NetworkEffects = {
  totalUsers: 250000,
  monthlyActiveUsers: 175000,
  userGrowthRate: 12,
  engagementRate: 0.7,
  isMultiSided: true,
  crossSideStrength: 70,
  sameSideStrength: 50,
  viralCoefficient: 0.9,
  dataNetworkEffects: 65,
};

const mockBrandStrength: BrandStrength = {
  awareness: 75,
  nps: 60,
  recall: 70,
  premiumPricing: 65,
  ltvRatio: 3.5,
  shareOfVoice: 0.25,
  socialFollowing: 150000,
  mediaMentions: 100,
  sentiment: 0.75,
};

const mockDataAdvantage: DataAdvantage = {
  dataVolume: 25,
  dataUniqueness: 75,
  dataVelocity: 2500000,
  proprietaryDataRatio: 0.7,
  dataAge: 4,
  modelAccuracyAdvantage: 70,
  dataSwitchingBarrier: 65,
  realTimeCapability: 80,
};

describe('calculateSwitchingCostScore', () => {
  it('should calculate switching cost score for high costs', () => {
    const score = calculateSwitchingCostScore(mockSwitchingCosts);
    expect(score).toBeGreaterThan(60);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should return low score for zero costs', () => {
    const emptyCosts: SwitchingCosts = {
      financialCost: 0,
      timeCost: 0,
      emotionalCost: 0,
      disruptionRisk: 0,
      dataMigrationComplexity: 0,
      learningCurve: 0,
      contractLockIn: 0,
      integrationDependencies: 0,
    };
    expect(calculateSwitchingCostScore(emptyCosts)).toBe(0);
  });

  it('should return high score for maximum costs', () => {
    const maxCosts: SwitchingCosts = {
      financialCost: 100,
      timeCost: 100,
      emotionalCost: 100,
      disruptionRisk: 100,
      dataMigrationComplexity: 100,
      learningCurve: 100,
      contractLockIn: 36,
      integrationDependencies: 10,
    };
    expect(calculateSwitchingCostScore(maxCosts)).toBeGreaterThan(90);
  });
});

describe('calculateNetworkEffectScore', () => {
  it('should calculate network effect score for strong network', () => {
    const score = calculateNetworkEffectScore(mockNetworkEffects);
    expect(score).toBeGreaterThan(60);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should return low score for no network effects', () => {
    const emptyNetwork: NetworkEffects = {
      totalUsers: 0,
      monthlyActiveUsers: 0,
      userGrowthRate: 0,
      engagementRate: 0,
      isMultiSided: false,
      crossSideStrength: 0,
      sameSideStrength: 0,
      viralCoefficient: 0,
      dataNetworkEffects: 0,
    };
    expect(calculateNetworkEffectScore(emptyNetwork)).toBeLessThan(20);
  });

  it('should return high score for viral growth', () => {
    const viralNetwork: NetworkEffects = {
      ...mockNetworkEffects,
      viralCoefficient: 1.5,
      totalUsers: 1000000,
    };
    expect(calculateNetworkEffectScore(viralNetwork)).toBeGreaterThan(80);
  });
});

describe('calculateBrandStrengthScore', () => {
  it('should calculate brand strength score for strong brand', () => {
    const score = calculateBrandStrengthScore(mockBrandStrength);
    expect(score).toBeGreaterThan(60);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should return low score for weak brand', () => {
    const weakBrand: BrandStrength = {
      awareness: 10,
      nps: 20,
      recall: 15,
      premiumPricing: 10,
      ltvRatio: 1.2,
      shareOfVoice: 0.01,
      socialFollowing: 500,
      mediaMentions: 2,
      sentiment: 0.3,
    };
    expect(calculateBrandStrengthScore(weakBrand)).toBeLessThan(30);
  });

  it('should return high score for premium brand', () => {
    const premiumBrand: BrandStrength = {
      awareness: 90,
      nps: 80,
      recall: 85,
      premiumPricing: 90,
      ltvRatio: 5.0,
      shareOfVoice: 0.4,
      socialFollowing: 500000,
      mediaMentions: 300,
      sentiment: 0.9,
    };
    expect(calculateBrandStrengthScore(premiumBrand)).toBeGreaterThan(80);
  });
});

describe('calculateDataAdvantageScore', () => {
  it('should calculate data advantage score for strong data moat', () => {
    const score = calculateDataAdvantageScore(mockDataAdvantage);
    expect(score).toBeGreaterThan(60);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should return low score for no data advantage', () => {
    const emptyData: DataAdvantage = {
      dataVolume: 0,
      dataUniqueness: 0,
      dataVelocity: 0,
      proprietaryDataRatio: 0,
      dataAge: 0,
      modelAccuracyAdvantage: 0,
      dataSwitchingBarrier: 0,
      realTimeCapability: 0,
    };
    expect(calculateDataAdvantageScore(emptyData)).toBeLessThan(20);
  });

  it('should return high score for proprietary data', () => {
    const strongData: DataAdvantage = {
      ...mockDataAdvantage,
      dataUniqueness: 95,
      proprietaryDataRatio: 0.95,
      dataAge: 10,
    };
    expect(calculateDataAdvantageScore(strongData)).toBeGreaterThan(80);
  });
});

describe('determineMoatRating', () => {
  it('should return exceptional for score >= 80', () => {
    expect(determineMoatRating(80)).toBe('exceptional');
    expect(determineMoatRating(95)).toBe('exceptional');
  });

  it('should return wide for score 60-79', () => {
    expect(determineMoatRating(60)).toBe('wide');
    expect(determineMoatRating(75)).toBe('wide');
  });

  it('should return narrow for score 40-59', () => {
    expect(determineMoatRating(40)).toBe('narrow');
    expect(determineMoatRating(55)).toBe('narrow');
  });

  it('should return none for score < 40', () => {
    expect(determineMoatRating(0)).toBe('none');
    expect(determineMoatRating(35)).toBe('none');
  });
});

describe('determineCompetitivePosition', () => {
  it('should return leader for high share + moat', () => {
    expect(determineCompetitivePosition(70, 0.35, 5)).toBe('leader');
  });

  it('should return challenger for medium share + moat', () => {
    expect(determineCompetitivePosition(50, 0.20, 8)).toBe('challenger');
  });

  it('should return niche for low share', () => {
    expect(determineCompetitivePosition(40, 0.03, 20)).toBe('niche');
  });

  it('should return follower for low moat', () => {
    expect(determineCompetitivePosition(30, 0.10, 10)).toBe('follower');
  });
});

describe('generateStrengths', () => {
  it('should return strengths for high scores', () => {
    const scores: MoatComponentScores = {
      switchingCostScore: 85,
      networkEffectScore: 80,
      brandStrengthScore: 75,
      dataAdvantageScore: 70,
    };
    const strengths = generateStrengths(scores);
    expect(strengths).toHaveLength(4);
    expect(strengths[0]).toContain('switching costs');
  });

  it('should return default for low scores', () => {
    const scores: MoatComponentScores = {
      switchingCostScore: 30,
      networkEffectScore: 25,
      brandStrengthScore: 35,
      dataAdvantageScore: 20,
    };
    const strengths = generateStrengths(scores);
    expect(strengths).toEqual(['No significant moat strengths identified']);
  });
});

describe('generateWeaknesses', () => {
  it('should return weaknesses for low scores', () => {
    const scores: MoatComponentScores = {
      switchingCostScore: 30,
      networkEffectScore: 25,
      brandStrengthScore: 35,
      dataAdvantageScore: 20,
    };
    const weaknesses = generateWeaknesses(scores);
    expect(weaknesses.length).toBeGreaterThanOrEqual(3);
  });

  it('should return empty for high scores', () => {
    const scores: MoatComponentScores = {
      switchingCostScore: 85,
      networkEffectScore: 80,
      brandStrengthScore: 75,
      dataAdvantageScore: 70,
    };
    const weaknesses = generateWeaknesses(scores);
    expect(weaknesses).toEqual([]);
  });
});

describe('generateRecommendedActions', () => {
  it('should return actions for low scores', () => {
    const scores: MoatComponentScores = {
      switchingCostScore: 30,
      networkEffectScore: 25,
      brandStrengthScore: 35,
      dataAdvantageScore: 20,
    };
    const actions = generateRecommendedActions(scores, 'none');
    expect(actions.length).toBeGreaterThan(3);
  });

  it('should return maintenance actions for high scores', () => {
    const scores: MoatComponentScores = {
      switchingCostScore: 85,
      networkEffectScore: 80,
      brandStrengthScore: 75,
      dataAdvantageScore: 70,
    };
    const actions = generateRecommendedActions(scores, 'wide');
    expect(actions).toContain('Maintain current moat strengths');
  });
});

describe('determineMoatTrend', () => {
  it('should return strengthening for positive change', () => {
    const current: MoatComponentScores = {
      switchingCostScore: 80,
      networkEffectScore: 75,
      brandStrengthScore: 70,
      dataAdvantageScore: 65,
    };
    const previous: MoatComponentScores = {
      switchingCostScore: 70,
      networkEffectScore: 65,
      brandStrengthScore: 60,
      dataAdvantageScore: 55,
    };
    expect(determineMoatTrend(current, previous)).toBe('strengthening');
  });

  it('should return weakening for negative change', () => {
    const current: MoatComponentScores = {
      switchingCostScore: 60,
      networkEffectScore: 55,
      brandStrengthScore: 50,
      dataAdvantageScore: 45,
    };
    const previous: MoatComponentScores = {
      switchingCostScore: 70,
      networkEffectScore: 65,
      brandStrengthScore: 60,
      dataAdvantageScore: 55,
    };
    expect(determineMoatTrend(current, previous)).toBe('weakening');
  });

  it('should return stable for no change', () => {
    const scores: MoatComponentScores = {
      switchingCostScore: 70,
      networkEffectScore: 65,
      brandStrengthScore: 60,
      dataAdvantageScore: 55,
    };
    expect(determineMoatTrend(scores, scores)).toBe('stable');
  });

  it('should return stable for undefined previous', () => {
    const scores: MoatComponentScores = {
      switchingCostScore: 70,
      networkEffectScore: 65,
      brandStrengthScore: 60,
      dataAdvantageScore: 55,
    };
    expect(determineMoatTrend(scores)).toBe('stable');
  });
});

describe('analyzeMoat', () => {
  it('should analyze strong moat company', () => {
    const result = analyzeMoat(SAMPLE_DATA.strongMoat);
    expect(result.overallMoatScore).toBeGreaterThanOrEqual(60);
    expect(['wide', 'exceptional']).toContain(result.moatRating);
    expect(result.keyStrengths.length).toBeGreaterThan(0);
    expect(result.competitivePosition).toBe('leader');
  });

  it('should analyze weak moat company', () => {
    const result = analyzeMoat(SAMPLE_DATA.weakMoat);
    expect(result.overallMoatScore).toBeLessThan(40);
    expect(result.moatRating).toBe('none');
    expect(result.keyWeaknesses.length).toBeGreaterThan(0);
    expect(result.recommendedActions.length).toBeGreaterThan(0);
  });

  it('should return all required fields', () => {
    const result = analyzeMoat(SAMPLE_DATA.strongMoat);
    expect(result.analyzedAt).toBeInstanceOf(Date);
    expect(result.companyId).toBe('company-001');
    expect(result.companyName).toBe('TechLeader Inc');
    expect(result.componentScores).toBeDefined();
    expect(result.moatTrend).toBe('stable');
  });

  it('should calculate weighted overall score', () => {
    const result = analyzeMoat(SAMPLE_DATA.strongMoat);
    const scores = result.componentScores;
    const expected =
      scores.switchingCostScore * DEFAULT_WEIGHTS.switchingCosts +
      scores.networkEffectScore * DEFAULT_WEIGHTS.networkEffects +
      scores.brandStrengthScore * DEFAULT_WEIGHTS.brandStrength +
      scores.dataAdvantageScore * DEFAULT_WEIGHTS.dataAdvantage;
    expect(result.overallMoatScore).toBeCloseTo(expected, 1);
  });
});

describe('DEFAULT_WEIGHTS', () => {
  it('should have valid weights that sum to 1', () => {
    const sum =
      DEFAULT_WEIGHTS.switchingCosts +
      DEFAULT_WEIGHTS.networkEffects +
      DEFAULT_WEIGHTS.brandStrength +
      DEFAULT_WEIGHTS.dataAdvantage;
    expect(sum).toBeCloseTo(1, 2);
  });

  it('should have switching costs and network effects as primary', () => {
    expect(DEFAULT_WEIGHTS.switchingCosts).toBe(0.3);
    expect(DEFAULT_WEIGHTS.networkEffects).toBe(0.3);
  });
});

describe('SAMPLE_DATA', () => {
  it('should have valid strong moat data', () => {
    expect(SAMPLE_DATA.strongMoat.companyId).toBe('company-001');
    expect(SAMPLE_DATA.strongMoat.marketShare).toBeGreaterThan(0.3);
  });

  it('should have valid weak moat data', () => {
    expect(SAMPLE_DATA.weakMoat.companyId).toBe('company-002');
    expect(SAMPLE_DATA.weakMoat.marketShare).toBeLessThan(0.05);
  });
});
