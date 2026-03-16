/**
 * Customer Health Scoring Engine
 *
 * Calculates customer health scores based on engagement metrics,
 * churn prediction signals, NPS correlation, and automated alert triggers.
 *
 * @packageDocumentation
 */

export interface EngagementMetrics {
  customerId: string;
  sessionsPerWeek: number;
  featureAdoptionRate: number;
  avgSessionDuration: number;
  lastActiveDaysAgo: number;
  supportTicketsOpen: number;
  loginsLast30Days: number;
  // Test interface compatibility
  logins?: number;
  featuresUsed?: number;
  sessions?: number;
  lastActiveAt?: Date;
  videoGenerations?: number;
  templatesUsed?: number;
}

export interface ChurnSignals {
  engagementDecline: number;
  usageFrequencyDrop: number;
  supportTicketSpike: boolean;
  paymentIssues: boolean;
  competitorMention: boolean;
  contractEndApproaching: boolean;
}

export interface NPSData {
  score: number;
  lastSurveyDate: Date;
  responseRate: number;
  promoterRate: number;
  detractorRate: number;
  // Test interface compatibility
  daysSinceSurvey?: number;
  recommendationLikelihood?: number;
  sentimentScore?: number;
}

export interface BehavioralSignals {
  usageTrend: number;
  supportTickets: number;
  negativeFeedback: number;
  missedPayments: number;
  adminChanges: number;
  exportedData: boolean;
  pricingPageViews: number;
  cancellationSurvey: boolean;
}

export interface FirmographicData {
  companySize: number;
  annualRevenue: number;
  industry: string;
  region: string;
  techMaturity: number;
}

export interface HealthScoreInput {
  customerId: string;
  tier: string;
  engagement: EngagementMetrics;
  behavior: BehavioralSignals;
  nps: NPSData;
  firmographics: FirmographicData;
  customerAge: number;
}

export const HEALTH_THRESHOLDS = {
  HEALTHY: 80,
  AT_RISK: 60,
  CRITICAL: 0,
};

export interface HealthAlert {
  customerId: string;
  alertType: 'critical' | 'warning' | 'info';
  reason: string;
  healthScore: number;
  churnRisk: number;
  timestamp: Date;
  recommendedAction: string;
}

export interface CustomerHealth {
  customerId: string;
  engagementScore: number;
  churnRisk: number;
  npsAdjustedScore: number;
  overallHealth: number;
  healthGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  alerts: HealthAlert[];
  trend: 'improving' | 'stable' | 'declining';
  calculatedAt: Date;
}

export interface HealthScoreResult {
  customerId: string;
  overallScore: number;
  status: 'healthy' | 'at-risk' | 'critical';
  engagementScore: number;
  behavioralScore: number;
  npsScore: number;
  firmographicScore: number;
  churnProbability: number;
  alerts: AlertObject[];
  recommendedActions: string[];
  calculatedAt: Date;
}

export interface HealthComparison {
  trend: 'improving' | 'stable' | 'declining';
  scoreChange: number;
  percentChange: number;
  alerts: string[];
  statusChanged: boolean;
}

export interface AlertObject {
  severity: 'critical' | 'warning' | 'info';
  reason: string;
  customerId?: string;
  churnRisk?: number;
  timestamp?: Date;
  recommendedAction?: string;
}

export function calculateEngagementScore(metrics: EngagementMetrics): number {
  // Map test compatibility properties to canonical properties
  const sessionsPerWeek = metrics.sessionsPerWeek ?? (metrics.sessions ?? 0) / 4;
  const featureAdoptionRate = metrics.featureAdoptionRate ?? (metrics.featuresUsed ?? 1) / 10;
  const avgSessionDuration = metrics.avgSessionDuration ?? metrics.avgSessionDuration ?? 0;
  const lastActiveDaysAgo = metrics.lastActiveDaysAgo ?? (
    metrics.lastActiveAt ? Math.floor((Date.now() - metrics.lastActiveAt.getTime()) / 86400000) : 0
  );
  const loginsLast30Days = metrics.loginsLast30Days ?? metrics.logins ?? 0;
  const supportTicketsOpen = metrics.supportTicketsOpen ?? 0;

  const sessionsScore = Math.min(1, sessionsPerWeek / 10);
  const adoptionScore = Math.min(1, featureAdoptionRate);
  const durationScore = Math.min(1, avgSessionDuration / 60);
  const recencyScore = Math.max(0, 1 - lastActiveDaysAgo / 30);
  const supportScore = Math.max(0, 1 - supportTicketsOpen / 5);
  const loginScore = Math.min(1, loginsLast30Days / 20);

  return Math.round((
    sessionsScore * 0.2 +
    adoptionScore * 0.2 +
    durationScore * 0.15 +
    recencyScore * 0.2 +
    supportScore * 0.15 +
    loginScore * 0.1
  ) * 100);
}

export function detectChurnSignals(
  current: EngagementMetrics,
  previous: EngagementMetrics
): ChurnSignals {
  const currentEngagement = calculateEngagementScore(current);
  const previousEngagement = calculateEngagementScore(previous);
  const engagementDecline = Math.max(0, (previousEngagement - currentEngagement) / 100);
  const usageFrequencyDrop = previous.loginsLast30Days > 0
    ? Math.max(0, (previous.loginsLast30Days - current.loginsLast30Days) / previous.loginsLast30Days)
    : 0;

  return {
    engagementDecline,
    usageFrequencyDrop,
    supportTicketSpike: current.supportTicketsOpen > previous.supportTicketsOpen * 1.5,
    paymentIssues: false,
    competitorMention: false,
    contractEndApproaching: false,
  };
}

export function calculateChurnRisk(signals: ChurnSignals, engagementScore: number): number {
  const lowEngagementPenalty = Math.max(0, (60 - engagementScore) / 60);
  const risk = (
    signals.engagementDecline * 0.25 +
    signals.usageFrequencyDrop * 0.2 +
    (signals.supportTicketSpike ? 1 : 0) * 0.15 +
    (signals.paymentIssues ? 1 : 0) * 0.2 +
    (signals.competitorMention ? 1 : 0) * 0.1 +
    (signals.contractEndApproaching ? 1 : 0) * 0.1 +
    lowEngagementPenalty * 0.15
  );
  return Math.round(risk * 100);
}

export function calculateNPSAdjustedScore(engagementScore: number, npsData: NPSData): number {
  const npsNormalized = (npsData.score + 100) / 200;
  return Math.round(engagementScore * 0.7 + npsNormalized * 100 * 0.3);
}

export function correlateNPSWithHealth(healthScore: number, npsScore: number): {
  alignment: 'aligned' | 'health_higher' | 'nps_higher';
  gap: number;
  insight: string;
} {
  const npsNormalized = (npsScore + 100) / 200 * 100;
  const gap = healthScore - npsNormalized;
  if (Math.abs(gap) < 10) {
    return { alignment: 'aligned', gap: Math.abs(gap), insight: 'Health and NPS aligned' };
  }
  if (gap > 10) {
    return { alignment: 'health_higher', gap, insight: 'Health > NPS - check satisfaction' };
  }
  return { alignment: 'nps_higher', gap: Math.abs(gap), insight: 'NPS > health - monitor engagement' };
}

export function generateAlerts(customerId: string, health: CustomerHealth): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  if (health.overallHealth < 30) {
    alerts.push({ customerId, alertType: 'critical', reason: 'Critical health score', healthScore: health.overallHealth, churnRisk: health.churnRisk, timestamp: new Date(), recommendedAction: 'Immediate executive outreach' });
  }
  if (health.churnRisk > 70) {
    alerts.push({ customerId, alertType: 'critical', reason: 'High churn risk', healthScore: health.overallHealth, churnRisk: health.churnRisk, timestamp: new Date(), recommendedAction: 'Activate retention playbook' });
  }
  if (health.overallHealth >= 30 && health.overallHealth < 50) {
    alerts.push({ customerId, alertType: 'warning', reason: 'Low health score', healthScore: health.overallHealth, churnRisk: health.churnRisk, timestamp: new Date(), recommendedAction: 'Schedule CS check-in' });
  }
  if (health.trend === 'declining') {
    alerts.push({ customerId, alertType: 'warning', reason: 'Declining trend', healthScore: health.overallHealth, churnRisk: health.churnRisk, timestamp: new Date(), recommendedAction: 'Investigate decline' });
  }
  if (health.churnRisk >= 40 && health.churnRisk <= 70) {
    alerts.push({ customerId, alertType: 'info', reason: 'Moderate churn risk', healthScore: health.overallHealth, churnRisk: health.churnRisk, timestamp: new Date(), recommendedAction: 'Monitor closely' });
  }
  return alerts;
}

export function getHealthGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function analyzeHealthTrend(current: CustomerHealth, previous: CustomerHealth): 'improving' | 'stable' | 'declining' {
  const delta = current.overallHealth - previous.overallHealth;
  if (delta > 5) return 'improving';
  if (delta < -5) return 'declining';
  return 'stable';
}

export function calculateCustomerHealth(
  engagement: EngagementMetrics,
  previousEngagement: EngagementMetrics,
  npsData?: NPSData
): CustomerHealth {
  const engagementScore = calculateEngagementScore(engagement);
  const churnSignals = detectChurnSignals(engagement, previousEngagement);
  const churnRisk = calculateChurnRisk(churnSignals, engagementScore);
  const npsAdjustedScore = npsData ? calculateNPSAdjustedScore(engagementScore, npsData) : engagementScore;
  const overallHealth = Math.round(npsAdjustedScore * 0.6 + (100 - churnRisk) * 0.4);
  const healthGrade = getHealthGrade(overallHealth);

  const baseHealth: CustomerHealth = {
    customerId: engagement.customerId,
    engagementScore,
    churnRisk,
    npsAdjustedScore,
    overallHealth,
    healthGrade,
    alerts: [],
    trend: 'stable',
    calculatedAt: new Date(),
  };

  return { ...baseHealth, alerts: generateAlerts(engagement.customerId, baseHealth) };
}

// Test compatibility functions
export function calculateHealthScore(input: HealthScoreInput): HealthScoreResult {
  const engagementScore = calculateEngagementScore(input.engagement);
  const behavioralScore = calculateBehavioralScore(input.behavior);
  const npsScore = calculateNPSScore(input.nps);
  const firmographicScore = calculateFirmographicScore(input.firmographics);

  // Weighted scoring - behavioral and engagement are stronger predictors
  const overallScore = Math.round(
    engagementScore * 0.4 +
    behavioralScore * 0.35 +
    npsScore * 0.15 +
    firmographicScore * 0.1
  );

  const status = overallScore >= HEALTH_THRESHOLDS.HEALTHY ? 'healthy'
    : overallScore >= HEALTH_THRESHOLDS.AT_RISK ? 'at-risk'
    : 'critical';

  // Churn probability: inverse of health score with behavioral boost
  let churnProbability = Math.max(0, Math.min(1, (100 - overallScore) / 100));
  // Boost churn probability for at-risk signals
  if (input.behavior.cancellationSurvey) churnProbability += 0.15;
  if (input.behavior.missedPayments > 0) churnProbability += 0.15 * input.behavior.missedPayments;
  if (input.behavior.exportedData) churnProbability += 0.15;
  if (input.behavior.usageTrend < -0.3) churnProbability += 0.15;
  churnProbability = Math.max(0, Math.min(1, churnProbability));

  const alerts: AlertObject[] = [];
  if (engagementScore < 40) alerts.push({ severity: 'warning', reason: 'Low engagement - immediate outreach needed' });
  if (behavioralScore < 30) alerts.push({ severity: 'critical', reason: 'High churn risk - missed payments or negative feedback' });
  if (npsScore < 50) alerts.push({ severity: 'warning', reason: 'Low NPS - customer satisfaction issue' });
  if (status === 'critical') alerts.push({ severity: 'critical', reason: 'Critical health - executive intervention required' });
  // Behavioral alerts
  if (input.behavior.cancellationSurvey) alerts.push({ severity: 'critical', reason: 'Customer started cancellation survey' });
  if (input.behavior.missedPayments > 0) alerts.push({ severity: 'critical', reason: `${input.behavior.missedPayments} missed payment(s)` });
  if (input.behavior.exportedData) alerts.push({ severity: 'warning', reason: 'Customer exported data - potential churn risk' });

  const actions: string[] = [];
  if (status === 'healthy') actions.push('Maintain relationship - upsell opportunity');
  if (status === 'at-risk') actions.push('Schedule check-in call - address concerns');
  if (status === 'critical') actions.push('Emergency intervention - executive outreach');

  return {
    customerId: input.customerId,
    overallScore,
    status,
    engagementScore,
    behavioralScore,
    npsScore,
    firmographicScore,
    churnProbability,
    alerts,
    recommendedActions: actions,
    calculatedAt: new Date(),
  };
}

export function calculateBehavioralScore(signals: BehavioralSignals): number {
  const usageScore = Math.max(0, (1 + signals.usageTrend) * 50);
  const supportScore = Math.max(0, 100 - signals.supportTickets * 15);
  const feedbackScore = Math.max(0, 100 - signals.negativeFeedback * 25);
  // Missed payments: 0 = 100, 1 = 30, 2+ = 0
  const paymentScore = signals.missedPayments === 0 ? 100 : signals.missedPayments === 1 ? 30 : 0;
  const adminScore = signals.adminChanges > 0 ? 60 : 100;
  const exportScore = signals.exportedData ? 20 : 100;
  const pricingViewsScore = signals.pricingPageViews > 2 ? 60 : 100;
  const cancellationScore = signals.cancellationSurvey ? 0 : 100;

  return Math.round(
    usageScore * 0.15 +
    supportScore * 0.15 +
    feedbackScore * 0.15 +
    paymentScore * 0.3 +
    adminScore * 0.05 +
    exportScore * 0.05 +
    pricingViewsScore * 0.05 +
    cancellationScore * 0.1
  );
}

export function calculateNPSScore(nps: NPSData): number {
  // Use score directly - it's the authoritative NPS value (0-10 scale)
  // recommendationLikelihood is for test compatibility but score takes priority
  const likelihood = nps.score !== undefined ? nps.score : (nps.recommendationLikelihood ?? 5);
  // Perfect promoter (10/10) = 100%, minimal recency/sentiment penalty
  const baseScore = (likelihood / 10) * 100;
  const recencyFactor = nps.daysSinceSurvey !== undefined ? Math.max(0.8, 1 - nps.daysSinceSurvey / 365) : 1;
  const sentimentFactor = nps.sentimentScore !== undefined ? (nps.sentimentScore + 1) / 2 : 1;

  return Math.round(baseScore * recencyFactor * sentimentFactor);
}

export function calculateFirmographicScore(firmographics: FirmographicData): number {
  // Company size: 50-200 employees = ideal (100%), < 20 or > 500 = lower
  const sizeScore = firmographics.companySize >= 50 && firmographics.companySize <= 200
    ? 100
    : firmographics.companySize < 50
      ? (firmographics.companySize / 50) * 100
      : Math.max(50, 100 - (firmographics.companySize - 200) / 10);

  // Revenue: $1M-$10M = ideal
  const revenueScore = firmographics.annualRevenue >= 1000000 && firmographics.annualRevenue <= 10000000
    ? 100
    : firmographics.annualRevenue < 1000000
      ? (firmographics.annualRevenue / 1000000) * 100
      : Math.max(50, 100 - (firmographics.annualRevenue - 10000000) / 1000000);

  // Tech maturity: 5-8 = ideal
  const techScore = firmographics.techMaturity >= 5 && firmographics.techMaturity <= 8
    ? 100
    : (firmographics.techMaturity / 10) * 100;

  return Math.round(sizeScore * 0.4 + revenueScore * 0.3 + techScore * 0.3);
}

export function predictChurnProbability(input: HealthScoreInput | BehavioralSignals, healthScore?: number): number {
  // Handle both overloads: (HealthScoreInput) or (BehavioralSignals, healthScore)
  if ('behavior' in input) {
    // HealthScoreInput - calculate full health score first
    const result = calculateHealthScore(input);
    return result.churnProbability;
  } else {
    // BehavioralSignals + healthScore
    const signals = input;
    const score = healthScore ?? 50;

    // Base churn from health score
    let churn = (100 - score) / 100;

    // Add behavioral risk factors
    if (signals.usageTrend < -0.3) churn += 0.15;
    if (signals.missedPayments > 0) churn += 0.2;
    if (signals.exportedData) churn += 0.15;
    if (signals.cancellationSurvey) churn += 0.25;
    if (signals.negativeFeedback > 2) churn += 0.1;

    return Math.max(0, Math.min(1, churn));
  }
}

export function generateHealthAlerts(customerIdOrResult: string | HealthScoreResult, score?: number, prevScore?: number, behavior?: BehavioralSignals): AlertObject[] {
  const alerts: AlertObject[] = [];

  if (typeof customerIdOrResult === 'string') {
    // Called with (customerId, score, prevScore, behavior)
    const currentScore = score ?? 50;
    const previousScore = prevScore ?? currentScore;
    const customerId = customerIdOrResult;

    if (currentScore < 40) {
      alerts.push({ severity: 'critical', reason: `Critical: Health score dropped to ${currentScore}`, customerId, churnRisk: 0.8, timestamp: new Date(), recommendedAction: 'Immediate executive outreach' });
    }
    if (previousScore - currentScore > 15) {
      alerts.push({ severity: 'critical', reason: `Warning: Health score dropped ${Math.round(previousScore - currentScore)} points`, customerId, churnRisk: 0.7, timestamp: new Date(), recommendedAction: 'Investigate drop immediately' });
    }
    if (behavior?.cancellationSurvey) {
      alerts.push({ severity: 'critical', reason: 'Critical: Customer started cancellation survey', customerId, churnRisk: 0.9, timestamp: new Date(), recommendedAction: 'Emergency retention outreach' });
    }
    if (behavior?.exportedData) {
      alerts.push({ severity: 'warning', reason: 'Warning: Customer exported data - potential churn risk', customerId, churnRisk: 0.6, timestamp: new Date(), recommendedAction: 'Schedule check-in call' });
    }
    if (behavior?.missedPayments && behavior.missedPayments > 0) {
      alerts.push({ severity: 'critical', reason: `Critical: ${behavior.missedPayments} missed payment(s)`, customerId, churnRisk: 0.85, timestamp: new Date(), recommendedAction: 'Contact billing immediately' });
    }
  } else {
    // Called with HealthScoreResult
    const result = customerIdOrResult;
    if (result.status === 'critical') {
      alerts.push({ severity: 'critical', reason: 'Critical: Customer health critical', customerId: result.customerId, churnRisk: result.churnProbability, timestamp: new Date(), recommendedAction: 'Emergency executive outreach' });
    }
    if (result.churnProbability > 0.6) {
      alerts.push({ severity: 'critical', reason: `High churn risk: ${Math.round(result.churnProbability * 100)}%`, customerId: result.customerId, churnRisk: result.churnProbability, timestamp: new Date(), recommendedAction: 'Activate retention playbook' });
    }
    // Merge existing alerts from result
    alerts.push(...result.alerts);
  }

  return alerts;
}

export function generateRecommendedActions(breakdown: Record<string, number> | HealthScoreResult, churnProb?: number): string[] {
  const actions: string[] = [];

  if ('overallScore' in breakdown) {
    // HealthScoreResult
    const result = breakdown;
    if (result.status === 'healthy') {
      actions.push('Upsell opportunity - customer thriving');
    } else if (result.status === 'at-risk') {
      actions.push('Schedule check-in call');
    } else {
      actions.push('Emergency executive outreach');
    }
    if (result.churnProbability > 0.5) {
      actions.push('Activate retention playbook');
    }
  } else {
    // Breakdown object
    const engagement = breakdown.engagement ?? 50;
    const behavioral = breakdown.behavioral ?? 50;
    const nps = breakdown.nps ?? 50;
    const churn = churnProb ?? 0;

    if (engagement < 50) {
      actions.push('Schedule product training session');
    }
    if (behavioral < 50) {
      actions.push('Review usage patterns with customer');
    }
    if (nps < 50) {
      actions.push('Conduct satisfaction survey follow-up');
    }
    if (churn > 0.5) {
      actions.push('Initiate retention outreach');
    }
    if (engagement > 80 && behavioral > 80 && nps > 80 && churn < 0.2) {
      actions.push('Upsell premium features');
    }
  }

  return actions;
}

export function compareHealthScores(
  previous: HealthScoreInput | { overallScore: number; status: string; alerts: string[] },
  current: HealthScoreInput | { overallScore: number; status: string; alerts: string[] }
): HealthComparison {
  const prevResult = 'engagement' in previous ? calculateHealthScore(previous) : previous;
  const currResult = 'engagement' in current ? calculateHealthScore(current) : current;

  const scoreChange = currResult.overallScore - prevResult.overallScore;
  const percentChange = prevResult.overallScore > 0
    ? (scoreChange / prevResult.overallScore) * 100
    : 0;

  const trend = scoreChange > 5 ? 'improving' : scoreChange < -5 ? 'declining' : 'stable';
  const statusChanged = prevResult.status !== currResult.status;

  const alerts: string[] = [];
  if (trend === 'declining') alerts.push('Health score declining - immediate attention needed');
  if (currResult.status === 'critical') alerts.push('Customer in critical state');
  if (statusChanged) alerts.push(`Status changed from ${prevResult.status} to ${currResult.status}`);

  return { trend, scoreChange, percentChange, alerts, statusChanged };
}

export const SAMPLE_CUSTOMER: EngagementMetrics = {
  customerId: 'cust_001',
  sessionsPerWeek: 8,
  featureAdoptionRate: 0.65,
  avgSessionDuration: 45,
  lastActiveDaysAgo: 2,
  supportTicketsOpen: 1,
  loginsLast30Days: 18,
};

export const SAMPLE_PREVIOUS: EngagementMetrics = {
  customerId: 'cust_001',
  sessionsPerWeek: 10,
  featureAdoptionRate: 0.70,
  avgSessionDuration: 50,
  lastActiveDaysAgo: 1,
  supportTicketsOpen: 0,
  loginsLast30Days: 22,
};

export const SAMPLE_NPS: NPSData = {
  score: 45,
  lastSurveyDate: new Date('2026-03-01'),
  responseRate: 0.35,
  promoterRate: 0.55,
  detractorRate: 0.15,
};

export default {
  calculateEngagementScore,
  detectChurnSignals,
  calculateChurnRisk,
  calculateNPSAdjustedScore,
  correlateNPSWithHealth,
  generateAlerts,
  getHealthGrade,
  analyzeHealthTrend,
  calculateCustomerHealth,
  SAMPLE_CUSTOMER,
  SAMPLE_PREVIOUS,
  SAMPLE_NPS,
};
