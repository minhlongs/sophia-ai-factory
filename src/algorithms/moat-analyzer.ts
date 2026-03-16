/**
 * Competitive Moat Analyzer
 *
 * Switching cost calculator, network effects scorer, brand strength index,
 * and data advantage quantifier for competitive advantage analysis.
 *
 * @module MoatAnalyzer
 * @version 1.0.0
 */

/**
 * Moat strength rating
 */
export type MoatRating = 'none' | 'narrow' | 'wide' | 'exceptional';

/**
 * Switching cost components
 */
export interface SwitchingCosts {
  /** Financial switching cost (0-100) */
  financialCost: number;
  /** Time/effort to switch (0-100) */
  timeCost: number;
  /** Emotional/psychological cost (0-100) */
  emotionalCost: number;
  /** Business disruption risk (0-100) */
  disruptionRisk: number;
  /** Data migration complexity (0-100) */
  dataMigrationComplexity: number;
  /** Training/relearning curve (0-100) */
  learningCurve: number;
  /** Contract lock-in period (months) */
  contractLockIn: number;
  /** Integration dependencies count */
  integrationDependencies: number;
}

/**
 * Network effects metrics
 */
export interface NetworkEffects {
  /** Total users count */
  totalUsers: number;
  /** Monthly active users */
  monthlyActiveUsers: number;
  /** User growth rate (monthly %) */
  userGrowthRate: number;
  /** Engagement rate (0-1) */
  engagementRate: number;
  /** Multi-sided platform (boolean) */
  isMultiSided: boolean;
  /** Cross-side network strength (0-100) */
  crossSideStrength: number;
  /** Same-side network strength (0-100) */
  sameSideStrength: number;
  /** Viral coefficient (k-factor) */
  viralCoefficient: number;
  /** Data network effects (0-100) */
  dataNetworkEffects: number;
}

/**
 * Brand strength metrics
 */
export interface BrandStrength {
  /** Brand awareness score (0-100) */
  awareness: number;
  /** Net Promoter Score (0-100) */
  nps: number;
  /** Brand recall (0-100) */
  recall: number;
  /** Premium pricing ability (0-100) */
  premiumPricing: number;
  /** Customer lifetime value ratio */
  ltvRatio: number;
  /** Share of voice in market (0-1) */
  shareOfVoice: number;
  /** Social media following (total) */
  socialFollowing: number;
  /** Media mentions per month */
  mediaMentions: number;
  /** Brand sentiment (0-1) */
  sentiment: number;
}

/**
 * Data advantage metrics
 */
export interface DataAdvantage {
  /** Data volume (TB) */
  dataVolume: number;
  /** Data uniqueness score (0-100) */
  dataUniqueness: number;
  /** Data velocity (records/day) */
  dataVelocity: number;
  /** Proprietary data percentage (0-1) */
  proprietaryDataRatio: number;
  /** Data moat age (years of accumulation) */
  dataAge: number;
  /** ML model accuracy advantage (0-100) */
  modelAccuracyAdvantage: number;
  /** Data switching barrier (0-100) */
  dataSwitchingBarrier: number;
  /** Real-time data capability (0-100) */
  realTimeCapability: number;
}

/**
 * Complete moat analysis input
 */
export interface MoatAnalysisInput {
  companyId: string;
  companyName: string;
  switchingCosts: SwitchingCosts;
  networkEffects: NetworkEffects;
  brandStrength: BrandStrength;
  dataAdvantage: DataAdvantage;
  marketShare: number;
  competitorCount: number;
}

/**
 * Moat component scores
 */
export interface MoatComponentScores {
  switchingCostScore: number;
  networkEffectScore: number;
  brandStrengthScore: number;
  dataAdvantageScore: number;
}

/**
 * Complete moat analysis result
 */
export interface MoatAnalysisResult {
  analyzedAt: Date;
  companyId: string;
  companyName: string;
  overallMoatScore: number;
  moatRating: MoatRating;
  componentScores: MoatComponentScores;
  moatTrend: 'strengthening' | 'stable' | 'weakening';
  keyStrengths: string[];
  keyWeaknesses: string[];
  recommendedActions: string[];
  competitivePosition: 'leader' | 'challenger' | 'follower' | 'niche';
}

/**
 * Weight configuration for moat scoring
 */
export interface MoatWeights {
  switchingCosts: number;
  networkEffects: number;
  brandStrength: number;
  dataAdvantage: number;
}

/**
 * Default weights for moat component scoring
 */
export const DEFAULT_WEIGHTS: MoatWeights = {
  switchingCosts: 0.30,
  networkEffects: 0.30,
  brandStrength: 0.20,
  dataAdvantage: 0.20,
};

/**
 * Calculate switching cost score (0-100)
 */
export function calculateSwitchingCostScore(costs: SwitchingCosts): number {
  const weights = {
    financial: 0.20,
    time: 0.15,
    emotional: 0.10,
    disruption: 0.20,
    dataMigration: 0.15,
    learning: 0.05,
    contract: 0.10,
    integrations: 0.05,
  };

  // Contract lock-in score (12+ months = 100)
  const contractScore = Math.min(100, (costs.contractLockIn / 12) * 100);

  // Integration dependencies (5+ = 100)
  const integrationScore = Math.min(100, (costs.integrationDependencies / 5) * 100);

  return (
    costs.financialCost * weights.financial +
    costs.timeCost * weights.time +
    costs.emotionalCost * weights.emotional +
    costs.disruptionRisk * weights.disruption +
    costs.dataMigrationComplexity * weights.dataMigration +
    costs.learningCurve * weights.learning +
    contractScore * weights.contract +
    integrationScore * weights.integrations
  );
}

/**
 * Calculate network effects score (0-100)
 */
export function calculateNetworkEffectScore(network: NetworkEffects): number {
  const weights = {
    scale: 0.20,
    engagement: 0.15,
    growth: 0.15,
    multiSided: 0.15,
    crossSide: 0.15,
    sameSide: 0.05,
    viral: 0.10,
    dataNetwork: 0.05,
  };

  // Scale score (logarithmic - 1M+ users = 100)
  const scaleScore = Math.min(100, Math.log10(network.totalUsers + 1) * 25);

  // MAU ratio (handle zero total users)
  const mauRatio = network.totalUsers > 0 ? network.monthlyActiveUsers / network.totalUsers : 0;
  const engagementScore = Math.min(100, mauRatio * 150);

  // Growth score (10%+ monthly = 100)
  const growthScore = Math.min(100, (network.userGrowthRate / 10) * 100);

  // Multi-sided bonus
  const multiSidedScore = network.isMultiSided ? 100 : 50;

  // Viral coefficient (k > 1 = viral growth)
  const viralScore = Math.min(100, network.viralCoefficient * 100);

  return (
    scaleScore * weights.scale +
    engagementScore * weights.engagement +
    growthScore * weights.growth +
    multiSidedScore * weights.multiSided +
    network.crossSideStrength * weights.crossSide +
    network.sameSideStrength * weights.sameSide +
    viralScore * weights.viral +
    network.dataNetworkEffects * weights.dataNetwork
  );
}

/**
 * Calculate brand strength score (0-100)
 */
export function calculateBrandStrengthScore(brand: BrandStrength): number {
  const weights = {
    awareness: 0.20,
    nps: 0.20,
    recall: 0.10,
    premium: 0.15,
    ltv: 0.10,
    shareOfVoice: 0.10,
    social: 0.05,
    sentiment: 0.10,
  };

  // Social following score (log scale - 100K+ = 100)
  const socialScore = Math.min(100, Math.log10(brand.socialFollowing + 1) * 20);

  // LTV ratio score (3x+ = 100)
  const ltvScore = Math.min(100, brand.ltvRatio * 33.3);

  return (
    brand.awareness * weights.awareness +
    brand.nps * weights.nps +
    brand.recall * weights.recall +
    brand.premiumPricing * weights.premium +
    ltvScore * weights.ltv +
    brand.shareOfVoice * 100 * weights.shareOfVoice +
    socialScore * weights.social +
    brand.sentiment * 100 * weights.sentiment
  );
}

/**
 * Calculate data advantage score (0-100)
 */
export function calculateDataAdvantageScore(data: DataAdvantage): number {
  const weights = {
    volume: 0.15,
    uniqueness: 0.20,
    velocity: 0.10,
    proprietary: 0.20,
    age: 0.10,
    modelAdvantage: 0.15,
    switchingBarrier: 0.05,
    realTime: 0.05,
  };

  // Volume score (log scale - 100TB+ = 100)
  const volumeScore = Math.min(100, Math.log10(data.dataVolume + 1) * 50);

  // Velocity score (1M+ records/day = 100)
  const velocityScore = Math.min(100, (data.dataVelocity / 1000000) * 100);

  // Data age score (5+ years = 100)
  const ageScore = Math.min(100, (data.dataAge / 5) * 100);

  return (
    volumeScore * weights.volume +
    data.dataUniqueness * weights.uniqueness +
    velocityScore * weights.velocity +
    data.proprietaryDataRatio * 100 * weights.proprietary +
    ageScore * weights.age +
    data.modelAccuracyAdvantage * weights.modelAdvantage +
    data.dataSwitchingBarrier * weights.switchingBarrier +
    data.realTimeCapability * weights.realTime
  );
}

/**
 * Determine moat rating from overall score
 */
export function determineMoatRating(score: number): MoatRating {
  if (score >= 80) return 'exceptional';
  if (score >= 60) return 'wide';
  if (score >= 40) return 'narrow';
  return 'none';
}

/**
 * Determine competitive position
 */
export function determineCompetitivePosition(
  moatScore: number,
  marketShare: number,
  competitorCount: number
): 'leader' | 'challenger' | 'follower' | 'niche' {
  if (marketShare > 0.3 && moatScore >= 60) return 'leader';
  if (marketShare > 0.15 && moatScore >= 40) return 'challenger';
  if (marketShare < 0.05) return 'niche';
  return 'follower';
}

/**
 * Generate key strengths based on component scores
 */
export function generateStrengths(scores: MoatComponentScores): string[] {
  const strengths: string[] = [];

  if (scores.switchingCostScore >= 70) {
    strengths.push('High customer switching costs create strong retention');
  }
  if (scores.networkEffectScore >= 70) {
    strengths.push('Strong network effects drive viral growth');
  }
  if (scores.brandStrengthScore >= 70) {
    strengths.push('Powerful brand enables premium pricing');
  }
  if (scores.dataAdvantageScore >= 70) {
    strengths.push('Proprietary data creates defensible AI advantage');
  }
  if (scores.switchingCostScore >= 50 && scores.switchingCostScore < 70) {
    strengths.push('Moderate switching costs provide some protection');
  }
  if (scores.networkEffectScore >= 50 && scores.networkEffectScore < 70) {
    strengths.push('Growing network effects showing early momentum');
  }

  return strengths.length > 0 ? strengths : ['No significant moat strengths identified'];
}

/**
 * Generate key weaknesses based on component scores
 */
export function generateWeaknesses(scores: MoatComponentScores): string[] {
  const weaknesses: string[] = [];

  if (scores.switchingCostScore < 40) {
    weaknesses.push('Low switching costs - customers can easily leave');
  }
  if (scores.networkEffectScore < 40) {
    weaknesses.push('Weak network effects - limited viral growth');
  }
  if (scores.brandStrengthScore < 40) {
    weaknesses.push('Low brand awareness - vulnerable to competitors');
  }
  if (scores.dataAdvantageScore < 40) {
    weaknesses.push('No significant data advantage - easy to replicate');
  }
  if (scores.switchingCostScore < 30) {
    weaknesses.push('Critical: Almost no switching cost protection');
  }

  return weaknesses;
}

/**
 * Generate recommended actions
 */
export function generateRecommendedActions(
  scores: MoatComponentScores,
  moatRating: MoatRating
): string[] {
  const actions: string[] = [];

  if (scores.switchingCostScore < 50) {
    actions.push('Increase switching costs: add integrations, data lock-in');
    actions.push('Implement long-term contracts with discounts');
  }
  if (scores.networkEffectScore < 50) {
    actions.push('Build network effects: enable user interactions');
    actions.push('Add multi-sided marketplace features');
    actions.push('Implement referral programs (k-factor > 1)');
  }
  if (scores.brandStrengthScore < 50) {
    actions.push('Invest in brand building and content marketing');
    actions.push('Launch customer advocacy program');
  }
  if (scores.dataAdvantageScore < 50) {
    actions.push('Accumulate proprietary data assets');
    actions.push('Build ML models that improve with more data');
  }
  if (moatRating === 'none' || moatRating === 'narrow') {
    actions.push('Priority: Build at least one defensible moat within 12 months');
  }

  return actions.length > 0 ? actions : ['Maintain current moat strengths', 'Monitor competitive landscape'];
}

/**
 * Determine moat trend (simplified - would compare over time)
 */
export function determineMoatTrend(
  scores: MoatComponentScores,
  previousScores?: MoatComponentScores
): 'strengthening' | 'stable' | 'weakening' {
  if (!previousScores) return 'stable';

  const currentTotal =
    scores.switchingCostScore +
    scores.networkEffectScore +
    scores.brandStrengthScore +
    scores.dataAdvantageScore;

  const previousTotal =
    previousScores.switchingCostScore +
    previousScores.networkEffectScore +
    previousScores.brandStrengthScore +
    previousScores.dataAdvantageScore;

  const change = currentTotal - previousTotal;

  if (change > 5) return 'strengthening';
  if (change < -5) return 'weakening';
  return 'stable';
}

/**
 * Main moat analysis function
 */
export function analyzeMoat(
  input: MoatAnalysisInput,
  weights: MoatWeights = DEFAULT_WEIGHTS,
  previousScores?: MoatComponentScores
): MoatAnalysisResult {
  // Calculate component scores
  const componentScores: MoatComponentScores = {
    switchingCostScore: Math.round(calculateSwitchingCostScore(input.switchingCosts) * 100) / 100,
    networkEffectScore: Math.round(calculateNetworkEffectScore(input.networkEffects) * 100) / 100,
    brandStrengthScore: Math.round(calculateBrandStrengthScore(input.brandStrength) * 100) / 100,
    dataAdvantageScore: Math.round(calculateDataAdvantageScore(input.dataAdvantage) * 100) / 100,
  };

  // Calculate weighted overall score
  const overallScore =
    componentScores.switchingCostScore * weights.switchingCosts +
    componentScores.networkEffectScore * weights.networkEffects +
    componentScores.brandStrengthScore * weights.brandStrength +
    componentScores.dataAdvantageScore * weights.dataAdvantage;

  // Determine rating and position
  const moatRating = determineMoatRating(overallScore);
  const competitivePosition = determineCompetitivePosition(
    overallScore,
    input.marketShare,
    input.competitorCount
  );

  // Generate insights
  const keyStrengths = generateStrengths(componentScores);
  const keyWeaknesses = generateWeaknesses(componentScores);
  const recommendedActions = generateRecommendedActions(componentScores, moatRating);
  const moatTrend = determineMoatTrend(componentScores, previousScores);

  return {
    analyzedAt: new Date(),
    companyId: input.companyId,
    companyName: input.companyName,
    overallMoatScore: Math.round(overallScore * 100) / 100,
    moatRating,
    componentScores,
    moatTrend,
    keyStrengths,
    keyWeaknesses,
    recommendedActions,
    competitivePosition,
  };
}

/**
 * Sample data for testing and demonstration
 */
export const SAMPLE_DATA = {
  strongMoat: {
    companyId: 'company-001',
    companyName: 'TechLeader Inc',
    switchingCosts: {
      financialCost: 80,
      timeCost: 75,
      emotionalCost: 60,
      disruptionRisk: 85,
      dataMigrationComplexity: 90,
      learningCurve: 70,
      contractLockIn: 24,
      integrationDependencies: 8,
    } as SwitchingCosts,
    networkEffects: {
      totalUsers: 500000,
      monthlyActiveUsers: 350000,
      userGrowthRate: 15,
      engagementRate: 0.7,
      isMultiSided: true,
      crossSideStrength: 80,
      sameSideStrength: 60,
      viralCoefficient: 1.2,
      dataNetworkEffects: 75,
    } as NetworkEffects,
    brandStrength: {
      awareness: 85,
      nps: 70,
      recall: 80,
      premiumPricing: 75,
      ltvRatio: 4.5,
      shareOfVoice: 0.3,
      socialFollowing: 250000,
      mediaMentions: 150,
      sentiment: 0.8,
    } as BrandStrength,
    dataAdvantage: {
      dataVolume: 50,
      dataUniqueness: 85,
      dataVelocity: 5000000,
      proprietaryDataRatio: 0.8,
      dataAge: 7,
      modelAccuracyAdvantage: 80,
      dataSwitchingBarrier: 75,
      realTimeCapability: 90,
    } as DataAdvantage,
    marketShare: 0.35,
    competitorCount: 5,
  } as MoatAnalysisInput,

  weakMoat: {
    companyId: 'company-002',
    companyName: 'StartupCo',
    switchingCosts: {
      financialCost: 20,
      timeCost: 30,
      emotionalCost: 15,
      disruptionRisk: 25,
      dataMigrationComplexity: 20,
      learningCurve: 20,
      contractLockIn: 1,
      integrationDependencies: 1,
    } as SwitchingCosts,
    networkEffects: {
      totalUsers: 5000,
      monthlyActiveUsers: 1500,
      userGrowthRate: 5,
      engagementRate: 0.3,
      isMultiSided: false,
      crossSideStrength: 20,
      sameSideStrength: 15,
      viralCoefficient: 0.3,
      dataNetworkEffects: 10,
    } as NetworkEffects,
    brandStrength: {
      awareness: 15,
      nps: 30,
      recall: 20,
      premiumPricing: 10,
      ltvRatio: 1.5,
      shareOfVoice: 0.02,
      socialFollowing: 2000,
      mediaMentions: 5,
      sentiment: 0.5,
    } as BrandStrength,
    dataAdvantage: {
      dataVolume: 0.5,
      dataUniqueness: 20,
      dataVelocity: 10000,
      proprietaryDataRatio: 0.1,
      dataAge: 0.5,
      modelAccuracyAdvantage: 15,
      dataSwitchingBarrier: 10,
      realTimeCapability: 30,
    } as DataAdvantage,
    marketShare: 0.02,
    competitorCount: 15,
  } as MoatAnalysisInput,
};

export default {
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
};
