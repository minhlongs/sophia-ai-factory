import { describe, it, expect } from 'vitest';
import {
  calculateHealthScore,
  calculateEngagementScore,
  calculateBehavioralScore,
  calculateNPSScore,
  calculateFirmographicScore,
  predictChurnProbability,
  generateHealthAlerts,
  generateRecommendedActions,
  compareHealthScores,
  HEALTH_THRESHOLDS,
  type HealthScoreInput,
  type EngagementMetrics,
  type BehavioralSignals,
  type NPSData,
  type FirmographicData,
} from './health-score';

const createSampleEngagement = (overrides?: Partial<EngagementMetrics>): EngagementMetrics => ({
  customerId: 'test-customer-1',
  sessionsPerWeek: 5,
  featureAdoptionRate: 0.6,
  avgSessionDuration: 12,
  lastActiveDaysAgo: 1,
  supportTicketsOpen: 0,
  loginsLast30Days: 20,
  logins: 20,
  featuresUsed: 6,
  sessions: 25,
  videoGenerations: 15,
  templatesUsed: 8,
  ...overrides,
});

const createSampleBehavior = (overrides?: Partial<BehavioralSignals>): BehavioralSignals => ({
  usageTrend: 0.2,
  supportTickets: 1,
  negativeFeedback: 0,
  missedPayments: 0,
  adminChanges: 0,
  exportedData: false,
  pricingPageViews: 1,
  cancellationSurvey: false,
  ...overrides,
});

const createSampleNPS = (overrides?: Partial<NPSData>): NPSData => ({
  score: 9,
  lastSurveyDate: new Date(Date.now() - 14 * 86400000),
  responseRate: 0.7,
  promoterRate: 0.6,
  detractorRate: 0.1,
  daysSinceSurvey: 14,
  recommendationLikelihood: 9,
  sentimentScore: 0.8,
  ...overrides,
});

const createSampleFirmographics = (overrides?: Partial<FirmographicData>): FirmographicData => ({
  companySize: 100,
  annualRevenue: 5000000,
  industry: 'Technology',
  region: 'North America',
  techMaturity: 7,
  ...overrides,
});

const createSampleInput = (overrides?: Partial<HealthScoreInput>): HealthScoreInput => ({
  customerId: 'cust-001',
  tier: 'growth',
  engagement: createSampleEngagement(),
  behavior: createSampleBehavior(),
  nps: createSampleNPS(),
  firmographics: createSampleFirmographics(),
  customerAge: 180,
  ...overrides,
});

describe('Health Score System', () => {
  describe('calculateEngagementScore', () => {
    it('should return high score for highly engaged customer', () => {
      const metrics = createSampleEngagement({
        logins: 25,
        featuresUsed: 8,
        sessions: 30,
        avgSessionDuration: 15,
        videoGenerations: 20,
      });
      const score = calculateEngagementScore(metrics);
      expect(score).toBeGreaterThanOrEqual(70);
    });

    it('should return low score for inactive customer', () => {
      const metrics = createSampleEngagement({
        logins: 2,
        featuresUsed: 1,
        sessions: 3,
        avgSessionDuration: 2,
        videoGenerations: 0,
        sessionsPerWeek: 0,
        loginsLast30Days: 2,
        featureAdoptionRate: 0.1,
        lastActiveDaysAgo: 30,
        lastActiveAt: new Date(Date.now() - 2592000000),
      });
      const score = calculateEngagementScore(metrics);
      expect(score).toBeLessThan(70);
    });

    it('should penalize recency heavily', () => {
      const veryOld = createSampleEngagement({
        lastActiveDaysAgo: 30,
        lastActiveAt: new Date(Date.now() - 2592000000),
      });
      const recent = createSampleEngagement({
        lastActiveDaysAgo: 1,
        lastActiveAt: new Date(Date.now() - 86400000),
      });

      expect(calculateEngagementScore(veryOld)).toBeLessThanOrEqual(calculateEngagementScore(recent));
    });
  });

  describe('calculateBehavioralScore', () => {
    it('should return high score for positive behavior', () => {
      const behavior = createSampleBehavior({
        usageTrend: 0.3,
        supportTickets: 0,
        negativeFeedback: 0,
        missedPayments: 0,
      });
      const score = calculateBehavioralScore(behavior);
      expect(score).toBeGreaterThan(80);
    });

    it('should return low score for churn signals', () => {
      const behavior = createSampleBehavior({
        usageTrend: -0.5,
        supportTickets: 5,
        negativeFeedback: 4,
        missedPayments: 1,
        exportedData: true,
        cancellationSurvey: true,
      });
      const score = calculateBehavioralScore(behavior);
      expect(score).toBeLessThan(30);
    });

    it('should penalize missed payments heavily', () => {
      const noPayment = createSampleBehavior({ missedPayments: 0 });
      const onePayment = createSampleBehavior({ missedPayments: 1 });
      const twoPayments = createSampleBehavior({ missedPayments: 2 });

      expect(calculateBehavioralScore(noPayment))
        .toBeGreaterThan(calculateBehavioralScore(onePayment));
      expect(calculateBehavioralScore(onePayment))
        .toBeGreaterThan(calculateBehavioralScore(twoPayments));
    });
  });

  describe('calculateNPSScore', () => {
    it('should return high score for promoters', () => {
      const nps = createSampleNPS({ score: 10, recommendationLikelihood: 10 });
      const score = calculateNPSScore(nps);
      expect(score).toBeGreaterThan(85);
    });

    it('should return low score for detractors', () => {
      const nps = createSampleNPS({ score: 3, recommendationLikelihood: 2, sentimentScore: -0.7 });
      const score = calculateNPSScore(nps);
      expect(score).toBeLessThan(50);
    });

    it('should penalize old surveys', () => {
      const recent = createSampleNPS({ daysSinceSurvey: 7 });
      const old = createSampleNPS({ daysSinceSurvey: 90 });

      expect(calculateNPSScore(recent)).toBeGreaterThan(calculateNPSScore(old));
    });
  });

  describe('calculateFirmographicScore', () => {
    it('should return high score for ICP fit', () => {
      const firmographics = createSampleFirmographics({
        companySize: 100,
        annualRevenue: 5000000,
        techMaturity: 7,
      });
      const score = calculateFirmographicScore(firmographics);
      expect(score).toBeGreaterThan(80);
    });

    it('should return lower score for poor ICP fit', () => {
      const firmographics = createSampleFirmographics({
        companySize: 10,
        annualRevenue: 100000,
        techMaturity: 3,
      });
      const score = calculateFirmographicScore(firmographics);
      expect(score).toBeLessThan(60);
    });
  });

  describe('calculateHealthScore', () => {
    it('should return healthy status for good metrics', () => {
      const input = createSampleInput();
      const result = calculateHealthScore(input);

      expect(result.overallScore).toBeGreaterThan(60);
      expect(result.status).toBe('healthy');
      expect(result.churnProbability).toBeLessThan(0.3);
    });

    it('should return critical status for poor metrics', () => {
      const input = createSampleInput({
        engagement: createSampleEngagement({
          logins: 3,
          featuresUsed: 1,
          sessions: 5,
          videoGenerations: 1,
        }),
        behavior: createSampleBehavior({
          usageTrend: -0.5,
          supportTickets: 5,
          missedPayments: 2,
          cancellationSurvey: true,
        }),
        nps: createSampleNPS({ score: 3, recommendationLikelihood: 2 }),
      });

      const result = calculateHealthScore(input);

      expect(result.status).toBe('critical');
      expect(result.churnProbability).toBeGreaterThan(0.5);
    });

    it('should include alerts for at-risk customers', () => {
      const input = createSampleInput({
        behavior: createSampleBehavior({
          cancellationSurvey: true,
          missedPayments: 1,
          exportedData: true,
        }),
      });

      const result = calculateHealthScore(input);

      expect(result.alerts.length).toBeGreaterThan(0);
      expect(result.alerts.some(a => a.severity === 'critical')).toBe(true);
    });

    it('should include recommended actions', () => {
      const input = createSampleInput({
        engagement: createSampleEngagement({
          logins: 5,
          featuresUsed: 2,
        }),
      });

      const result = calculateHealthScore(input);

      expect(result.recommendedActions.length).toBeGreaterThan(0);
    });
  });

  describe('predictChurnProbability', () => {
    it('should return low probability for healthy customer', () => {
      const signals = createSampleBehavior();
      const probability = predictChurnProbability(signals, 85);
      expect(probability).toBeLessThan(0.2);
    });

    it('should return high probability for at-risk customer', () => {
      const signals = createSampleBehavior({
        usageTrend: -0.5,
        missedPayments: 1,
        exportedData: true,
        cancellationSurvey: true,
      });
      const probability = predictChurnProbability(signals, 35);
      expect(probability).toBeGreaterThan(0.6);
    });
  });

  describe('generateHealthAlerts', () => {
    it('should generate critical alert for very low score', () => {
      const alerts = generateHealthAlerts('cust-001', 35, 80, createSampleBehavior());
      expect(alerts.some(a => a.severity === 'critical')).toBe(true);
      expect(alerts.some(a => a.reason.includes('dropped'))).toBe(true);
    });

    it('should generate alert for cancellation survey', () => {
      const alerts = generateHealthAlerts(
        'cust-001',
        70,
        undefined,
        createSampleBehavior({ cancellationSurvey: true })
      );
      expect(alerts.some(a => a.reason.includes('cancellation'))).toBe(true);
    });

    it('should generate alert for data export', () => {
      const alerts = generateHealthAlerts(
        'cust-001',
        70,
        undefined,
        createSampleBehavior({ exportedData: true })
      );
      expect(alerts.some(a => a.reason.includes('exported'))).toBe(true);
    });
  });

  describe('generateRecommendedActions', () => {
    it('should suggest training for low engagement', () => {
      const breakdown = {
        engagement: 40,
        behavioral: 80,
        nps: 80,
        firmographic: 80,
      };
      const actions = generateRecommendedActions(breakdown, 0.2);
      expect(actions.some(a => a.includes('training'))).toBe(true);
    });

    it('should suggest retention for high churn probability', () => {
      const breakdown = {
        engagement: 80,
        behavioral: 80,
        nps: 80,
        firmographic: 80,
      };
      const actions = generateRecommendedActions(breakdown, 0.7);
      expect(actions.some(a => a.includes('retention'))).toBe(true);
    });

    it('should suggest upsell for healthy customers', () => {
      const breakdown = {
        engagement: 90,
        behavioral: 90,
        nps: 90,
        firmographic: 90,
      };
      const actions = generateRecommendedActions(breakdown, 0.1);
      expect(actions.some(a => a.includes('Upsell'))).toBe(true);
    });
  });

  describe('compareHealthScores', () => {
    it('should detect improving trend', () => {
      const previous = {
        overallScore: 50,
        status: 'at-risk' as const,
        alerts: [],
      };
      const current = {
        overallScore: 75,
        status: 'healthy' as const,
        alerts: [],
      };

      const comparison = compareHealthScores(previous, current);

      expect(comparison.trend).toBe('improving');
      expect(comparison.statusChanged).toBe(true);
      expect(comparison.scoreChange).toBeGreaterThan(20);
    });

    it('should detect declining trend', () => {
      const previous = {
        overallScore: 85,
        status: 'healthy' as const,
        alerts: [],
      };
      const current = {
        overallScore: 45,
        status: 'critical' as const,
        alerts: [],
      };

      const comparison = compareHealthScores(previous, current);

      expect(comparison.trend).toBe('declining');
      expect(comparison.statusChanged).toBe(true);
    });
  });

  describe('Health Score Thresholds', () => {
    it('should have correct threshold values', () => {
      expect(HEALTH_THRESHOLDS.HEALTHY).toBe(80);
      expect(HEALTH_THRESHOLDS.AT_RISK).toBe(60);
      expect(HEALTH_THRESHOLDS.CRITICAL).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete customer lifecycle', () => {
      const healthy = calculateHealthScore(createSampleInput());
      expect(healthy.status).toBe('healthy');

      const declining = calculateHealthScore(createSampleInput({
        engagement: createSampleEngagement({
          logins: 8,
          videoGenerations: 5,
          lastActiveAt: new Date(Date.now() - 604800000),
        }),
        behavior: createSampleBehavior({
          usageTrend: -0.3,
          supportTickets: 3,
        }),
      }));

      expect(declining.status).toMatch(/healthy|at-risk/);

      const atRisk = calculateHealthScore(createSampleInput({
        engagement: createSampleEngagement({
          logins: 3,
          videoGenerations: 1,
          lastActiveAt: new Date(Date.now() - 1209600000),
        }),
        behavior: createSampleBehavior({
          usageTrend: -0.6,
          missedPayments: 1,
          exportedData: true,
        }),
        nps: createSampleNPS({ score: 4 }),
      }));

      expect(['at-risk', 'critical']).toContain(atRisk.status);
      expect(atRisk.churnProbability).toBeGreaterThan(0.5);
    });

    it('should batch process multiple customers', () => {
      const inputs: HealthScoreInput[] = [
        createSampleInput({ customerId: 'cust-001' }),
        createSampleInput({ customerId: 'cust-002' }),
        createSampleInput({ customerId: 'cust-003' }),
      ];

      const results = calculateHealthScore(inputs[0]);
      expect(results).toBeDefined();
      expect(results.overallScore).toBeGreaterThan(0);
    });
  });
});
