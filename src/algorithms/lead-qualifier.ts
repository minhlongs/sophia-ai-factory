/**
 * Lead Qualification Engine
 *
 * Qualifies leads based on ICP matching, behavioral signals,
 * firmographic scoring, and MQL/SQL classification.
 *
 * @packageDocumentation
 */

/**
 * ICP (Ideal Customer Profile) match criteria and scores
 */
export interface ICPMatch {
  companySizeFit: number;
  industryFit: number;
  budgetFit: number;
  timelineUrgency: number;
  hasDecisionMaker: boolean;
  painPointFit: number;
}

/**
 * Behavioral engagement signals
 */
export interface BehavioralSignals {
  websiteVisits: number;
  demoRequested: boolean;
  pricingPageViews: number;
  contentDownloads: number;
  emailOpenRate: number;
  emailClickRate: number;
  webinarAttendance: boolean;
  trialStarted: boolean;
  trialActivity: number;
  daysSinceEngagement: number;
}

/**
 * Firmographic company data
 */
export interface FirmographicData {
  companyName: string;
  companySize: number;
  annualRevenue: number;
  industry: string;
  location: string;
  technologies: string[];
  fundingStage: string;
  growthRate: number;
}

/**
 * Input for lead qualification
 */
export interface LeadQualificationInput {
  leadId: string;
  icp: ICPMatch;
  behavior: BehavioralSignals;
  firmographics: FirmographicData;
  source: string;
}

/**
 * Score breakdown
 */
export interface ScoreBreakdown {
  icpMatch: number;
  behavioral: number;
  firmographic: number;
}

/**
 * Lead qualification result
 */
export interface LeadQualificationResult {
  leadId: string;
  overallScore: number;
  status: 'sql' | 'mql' | 'nurturing' | 'not-qualified';
  breakdown: ScoreBreakdown;
  recommendedAction: string;
  nextSteps: string[];
  isHighPriority: boolean;
  churnRisk: 'low' | 'medium' | 'high' | undefined;
  qualifiedAt: Date;
}

/**
 * Lead score comparison result
 */
export interface LeadScoreComparison {
  leadId: string;
  currentScore: number;
  previousScore?: number;
  scoreChange?: number;
  trend: 'improving' | 'declining' | 'stable' | 'new';
  statusChange?: { from: string; to: string };
}

/**
 * Health thresholds for lead qualification
 */
export const LEAD_THRESHOLDS = {
  SQL: 80,
  MQL: 60,
  NURTURING: 40,
};

/**
 * Calculate ICP match score
 */
export function calculateICPMatchScore(icp: ICPMatch): number {
  const weights = {
    companySizeFit: 0.15,
    industryFit: 0.2,
    budgetFit: 0.2,
    timelineUrgency: 0.15,
    hasDecisionMaker: 0.15,
    painPointFit: 0.15,
  };

  const score =
    icp.companySizeFit * weights.companySizeFit +
    icp.industryFit * weights.industryFit +
    icp.budgetFit * weights.budgetFit +
    icp.timelineUrgency * weights.timelineUrgency +
    (icp.hasDecisionMaker ? 100 : 0) * weights.hasDecisionMaker +
    icp.painPointFit * weights.painPointFit;

  return Math.round(score);
}

/**
 * Calculate behavioral engagement score
 */
export function calculateBehavioralScore(behavior: BehavioralSignals): number {
  const weights = {
    websiteVisits: 0.1,
    demoRequested: 0.25,
    pricingPageViews: 0.15,
    contentDownloads: 0.1,
    emailEngagement: 0.15,
    webinarAttendance: 0.1,
    trialActivity: 0.15,
  };

  const visitScore = Math.min(100, (behavior.websiteVisits / 20) * 100);
  const demoScore = behavior.demoRequested ? 100 : 0;
  const pricingScore = Math.min(100, (behavior.pricingPageViews / 5) * 100);
  const contentScore = Math.min(100, (behavior.contentDownloads / 5) * 100);
  const emailScore = ((behavior.emailOpenRate + behavior.emailClickRate) / 2) * 100;
  const webinarScore = behavior.webinarAttendance ? 100 : 0;
  const trialScore = behavior.trialStarted ? behavior.trialActivity * 100 : 0;

  const score =
    visitScore * weights.websiteVisits +
    demoScore * weights.demoRequested +
    pricingScore * weights.pricingPageViews +
    contentScore * weights.contentDownloads +
    emailScore * weights.emailEngagement +
    webinarScore * weights.webinarAttendance +
    trialScore * weights.trialActivity;

  return Math.round(score);
}

/**
 * Calculate firmographic fit score
 */
export function calculateFirmographicScore(firmographics: FirmographicData): number {
  const benchmarks = {
    minCompanySize: 50,
    idealCompanySize: 200,
    maxCompanySize: 1000,
    minRevenue: 1000000,
    idealRevenue: 10000000,
    maxRevenue: 100000000,
    targetFundingStages: ['series-a', 'series-b', 'series-c', 'growth'],
    idealGrowthRate: 20,
  };

  // Company size score (0-40 points) - penalize very large companies
  let sizeScore = 0;
  if (firmographics.companySize >= benchmarks.minCompanySize) {
    if (firmographics.companySize > benchmarks.maxCompanySize) {
      // Large enterprise penalty
      sizeScore = 10;
    } else {
      sizeScore = 40;
    }
  } else {
    sizeScore = (firmographics.companySize / benchmarks.minCompanySize) * 40;
  }

  // Revenue score (0-35 points) - penalize very large revenue
  let revenueScore = 0;
  if (firmographics.annualRevenue >= benchmarks.minRevenue) {
    if (firmographics.annualRevenue > benchmarks.maxRevenue) {
      // Enterprise penalty
      revenueScore = 10;
    } else {
      revenueScore = 35;
    }
  } else {
    revenueScore = (firmographics.annualRevenue / benchmarks.minRevenue) * 35;
  }

  // Growth rate score (0-25 points) - cap at 20 for very large companies
  const maxGrowthScore = firmographics.companySize > benchmarks.maxCompanySize ||
                         firmographics.annualRevenue > benchmarks.maxRevenue ? 15 : 25;
  const growthScore = Math.min(maxGrowthScore, (firmographics.growthRate / benchmarks.idealGrowthRate) * 25);

  return Math.round(Math.min(100, sizeScore + revenueScore + growthScore));
}

/**
 * Classify lead based on total score
 */
export function classifyLead(totalScore: number): 'sql' | 'mql' | 'nurturing' | 'not-qualified' {
  if (totalScore >= LEAD_THRESHOLDS.SQL) return 'sql';
  if (totalScore >= LEAD_THRESHOLDS.MQL) return 'mql';
  if (totalScore >= LEAD_THRESHOLDS.NURTURING) return 'nurturing';
  return 'not-qualified';
}

/**
 * Generate recommended action based on status and scores
 */
export function generateRecommendedAction(
  status: string,
  breakdown: ScoreBreakdown
): string {
  if (status === 'sql') {
    return breakdown.icpMatch >= 80
      ? 'Priority: Schedule sales demo within 24h'
      : 'Schedule sales call to understand fit';
  }
  if (status === 'mql') {
    return breakdown.behavioral >= 70
      ? 'Send demo invitation with case studies'
      : 'nurture with educational content';
  }
  if (status === 'nurturing') {
    return 'Add to newsletter and retargeting campaign';
  }
  return 'Long-term nurture - revisit in 90 days';
}

/**
 * Generate next steps based on lead status
 */
export function generateNextSteps(status: string): string[] {
  const sqlSteps = [
    'AE outreach within 24 hours',
    'Schedule discovery call',
    'Prepare custom demo',
    'Share relevant case studies',
    'Set follow-up timeline',
  ];

  const mqlSteps = [
    'SDR email sequence',
    'Invite to product demo',
    'Share pricing information',
    'Offer pilot program',
    'Schedule qualification call',
  ];

  const nurturingSteps = [
    'Add to monthly newsletter',
    'Send educational content weekly',
    'Invite to webinar',
    'Retargeting ads',
    'Quarterly check-in',
  ];

  const notQualifiedSteps = [
    'Add to long-term nurture',
    'Send monthly updates',
    'Invite to public events',
    'Re-evaluate in 90 days',
    'Monitor for growth signals',
  ];

  switch (status) {
    case 'sql':
      return sqlSteps;
    case 'mql':
      return mqlSteps;
    case 'nurturing':
      return nurturingSteps;
    default:
      return notQualifiedSteps;
  }
}

/**
 * Check if lead is high priority
 */
export function isHighPriority(
  status: string,
  icp: ICPMatch,
  behavior: BehavioralSignals
): boolean {
  if (status === 'sql' && icp.hasDecisionMaker) return true;
  if (behavior.demoRequested && icp.timelineUrgency >= 80) return true;
  if (icp.companySizeFit >= 90 && icp.industryFit >= 90) return true;
  return false;
}

/**
 * Assess churn risk based on scores
 */
export function assessChurnRisk(
  breakdown: ScoreBreakdown,
  icp: ICPMatch
): 'low' | 'medium' | 'high' | undefined {
  // Unqualified leads don't have churn risk
  if (breakdown.icpMatch < 40 || breakdown.behavioral < 30) {
    return undefined;
  }

  const avgScore = (breakdown.icpMatch + breakdown.behavioral + breakdown.firmographic) / 3;

  if (avgScore >= 80 && icp.hasDecisionMaker) return 'low';
  if (avgScore >= 70) return 'medium';
  return 'high';
}

/**
 * Compare lead scores over time
 */
export function compareLeadScores(
  previousScore: number | undefined,
  currentScore: number,
  leadId?: string
): LeadScoreComparison {
  const currentStatus = classifyLead(currentScore);

  if (previousScore === undefined) {
    return {
      leadId: leadId || 'unknown',
      currentScore,
      trend: 'new',
    };
  }

  const previousStatus = classifyLead(previousScore);
  const diff = currentScore - previousScore;

  let trend: 'improving' | 'declining' | 'stable';
  if (diff > 5) trend = 'improving';
  else if (diff < -5) trend = 'declining';
  else trend = 'stable';

  const statusChange = currentStatus !== previousStatus
    ? { from: previousStatus, to: currentStatus }
    : undefined;

  return {
    leadId: leadId || 'unknown',
    currentScore,
    previousScore,
    scoreChange: diff,
    trend,
    statusChange,
  };
}

/**
 * Main lead qualification function
 */
export function qualifyLead(input: LeadQualificationInput): LeadQualificationResult {
  const icpScore = calculateICPMatchScore(input.icp);
  const behavioralScore = calculateBehavioralScore(input.behavior);
  const firmographicScore = calculateFirmographicScore(input.firmographics);

  const overallScore = Math.round(
    icpScore * 0.4 + behavioralScore * 0.4 + firmographicScore * 0.2
  );

  const status = classifyLead(overallScore);
  const breakdown: ScoreBreakdown = {
    icpMatch: icpScore,
    behavioral: behavioralScore,
    firmographic: firmographicScore,
  };

  const recommendedAction = generateRecommendedAction(status, breakdown);
  const nextSteps = generateNextSteps(status);
  const highPriority = isHighPriority(status, input.icp, input.behavior);
  const churnRisk = assessChurnRisk(breakdown, input.icp);

  return {
    leadId: input.leadId,
    overallScore,
    status,
    breakdown,
    recommendedAction,
    nextSteps,
    isHighPriority: highPriority,
    churnRisk,
    qualifiedAt: new Date(),
  };
}

/**
 * Qualify multiple leads in batch
 */
export function qualifyLeadsBatch(inputs: LeadQualificationInput[]): LeadQualificationResult[] {
  return inputs.map(input => qualifyLead(input));
}

// Sample data for testing
export const SAMPLE_ICP: ICPMatch = {
  companySizeFit: 80,
  industryFit: 90,
  budgetFit: 70,
  timelineUrgency: 85,
  hasDecisionMaker: true,
  painPointFit: 75,
};

export const SAMPLE_BEHAVIOR: BehavioralSignals = {
  websiteVisits: 15,
  demoRequested: true,
  pricingPageViews: 5,
  contentDownloads: 4,
  emailOpenRate: 0.6,
  emailClickRate: 0.3,
  webinarAttendance: true,
  trialStarted: false,
  trialActivity: 0,
  daysSinceEngagement: 2,
};

export const SAMPLE_FIRMOGRAPHICS: FirmographicData = {
  companyName: 'TechCorp Inc',
  companySize: 120,
  annualRevenue: 5000000,
  industry: 'Technology',
  location: 'San Francisco, CA',
  technologies: ['React', 'Node.js', 'AWS'],
  fundingStage: 'series-a',
  growthRate: 35,
};

export default {
  qualifyLead,
  qualifyLeadsBatch,
  calculateICPMatchScore,
  calculateBehavioralScore,
  calculateFirmographicScore,
  classifyLead,
  compareLeadScores,
  isHighPriority,
  assessChurnRisk,
  generateRecommendedAction,
  generateNextSteps,
  LEAD_THRESHOLDS,
  SAMPLE_ICP,
  SAMPLE_BEHAVIOR,
  SAMPLE_FIRMOGRAPHICS,
};
