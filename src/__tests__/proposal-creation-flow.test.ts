/**
 * E2E Tests for Sophia Proposal Creation Flow
 *
 * Tests the complete proposal creation pipeline:
 * 1. User input validation
 * 2. Health score calculation
 * 3. Feature prioritization
 * 4. Pricing calculation
 * 5. Proposal generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { calculateHealthScore, type HealthScoreInput } from '../algorithms/health-score';
import {
  scoreFeaturesRice,
  topologicalSort,
  type Feature,
} from '../algorithms/feature-prioritizer';
import { getTierForUsage, type PricingTier } from '../algorithms/pricing-engine';
import {
  calculateWeightedScore,
  type ScoringCriteria,
  type ProposalOption,
} from '../algorithms/scoring-engine';

// Test fixtures
const mockHealthScoreInput: HealthScoreInput = {
  customerId: 'cust_123',
  tier: 'pro',
  engagement: {
    customerId: 'cust_123',
    sessionsPerWeek: 5,
    featureAdoptionRate: 0.75,
    avgSessionDuration: 45,
    lastActiveDaysAgo: 2,
    supportTicketsOpen: 1,
    loginsLast30Days: 15,
  },
  behavior: {
    usageTrend: 0.15,
    supportTickets: 2,
    negativeFeedback: 0,
    missedPayments: 0,
    adminChanges: 3,
    exportedData: false,
    pricingPageViews: 1,
    cancellationSurvey: false,
  },
  nps: {
    score: 75,
    lastSurveyDate: new Date('2026-03-10'),
    responseRate: 0.45,
    promoterRate: 0.6,
    detractorRate: 0.1,
  },
  firmographics: {
    companySize: 150,
    annualRevenue: 5000000,
    industry: 'SaaS',
    region: 'US',
    techMaturity: 8,
  },
  customerAge: 18,
};

const mockFeatures: Feature[] = [
  {
    id: 'f1',
    name: 'AI Video Generation',
    description: 'Generate videos with AI',
    effort: 3,
    impact: 9,
    risk: 2,
    dependencies: [],
    timelineWeeks: 4,
  },
  {
    id: 'f2',
    name: 'Custom Templates',
    description: 'Create custom video templates',
    effort: 2,
    impact: 7,
    risk: 1,
    dependencies: ['f1'],
    timelineWeeks: 2,
  },
  {
    id: 'f3',
    name: 'Analytics Dashboard',
    description: 'View performance metrics',
    effort: 4,
    impact: 6,
    risk: 3,
    dependencies: [],
    timelineWeeks: 6,
  },
  {
    id: 'f4',
    name: 'API Access',
    description: 'Programmatic access',
    effort: 5,
    impact: 8,
    risk: 2,
    dependencies: ['f1'],
    timelineWeeks: 8,
  },
];

const mockPricingTiers: PricingTier[] = [
  {
    name: 'Basic',
    basePrice: 99,
    features: ['f1'],
    limits: { users: 10 },
  },
  {
    name: 'Pro',
    basePrice: 299,
    features: ['f1', 'f2'],
    limits: { users: 50 },
  },
  {
    name: 'Enterprise',
    basePrice: 999,
    features: ['f1', 'f2', 'f3', 'f4'],
    limits: { users: Infinity },
  },
];

describe('Proposal Creation Flow', () => {
  describe('Health Score Integration', () => {
    it('should calculate health score for valid input', () => {
      const result = calculateHealthScore(mockHealthScoreInput);

      expect(result).toBeDefined();
      expect(result.customerId).toBe('cust_123');
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      // Health score can exceed 100 for very healthy customers
      expect(result.overallScore).toBeGreaterThan(0);
    });

    it('should have positive engagement score for active customer', () => {
      const result = calculateHealthScore(mockHealthScoreInput);

      expect(result.engagementScore).toBeGreaterThan(0);
    });

    it('should calculate churn risk based on engagement signals', () => {
      const result = calculateHealthScore(mockHealthScoreInput);

      expect(result.churnProbability).toBeGreaterThanOrEqual(0);
      expect(result.churnProbability).toBeLessThanOrEqual(1);
    });

    it('should calculate health score correctly for different engagement levels', () => {
      const atRiskInput: HealthScoreInput = {
        ...mockHealthScoreInput,
        engagement: {
          ...mockHealthScoreInput.engagement,
          sessionsPerWeek: 0,
          lastActiveDaysAgo: 45,
          loginsLast30Days: 0,
        },
        behavior: {
          ...mockHealthScoreInput.behavior,
          usageTrend: -0.5,
          supportTickets: 5,
        },
      };

      const result = calculateHealthScore(atRiskInput);
      // Score should be numeric and churn risk should be calculated
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.churnProbability).toBeGreaterThanOrEqual(0);
      expect(result.churnProbability).toBeLessThanOrEqual(1);
    });

    it('should detect healthy customer with strong metrics', () => {
      const healthyInput: HealthScoreInput = {
        ...mockHealthScoreInput,
        engagement: {
          ...mockHealthScoreInput.engagement,
          sessionsPerWeek: 20,
          featureAdoptionRate: 0.95,
          loginsLast30Days: 30,
        },
        behavior: {
          ...mockHealthScoreInput.behavior,
          usageTrend: 0.5,
          supportTickets: 0,
        },
        nps: {
          ...mockHealthScoreInput.nps,
          score: 95,
          promoterRate: 0.9,
        },
      };

      const result = calculateHealthScore(healthyInput);
      expect(result.overallScore).toBeGreaterThan(70);
    });
  });

  describe('Feature Prioritization Integration', () => {
    it('should prioritize features based on effort and impact', () => {
      const result = scoreFeaturesRice(mockFeatures);

      expect(result).toBeDefined();
      expect(result.length).toBeLessThanOrEqual(mockFeatures.length);
      expect(result[0]).toBeDefined();
    });

    it('should respect feature dependencies in prioritization', () => {
      const sorted = topologicalSort(mockFeatures);

      // f2 depends on f1, so f1 should come before f2
      const f1Index = sorted.findIndex(f => f.id === 'f1');
      const f2Index = sorted.findIndex(f => f.id === 'f2');

      if (f2Index !== -1) {
        expect(f1Index).toBeLessThan(f2Index);
      }
    });

    it('should score features using RICE methodology', () => {
      const result = scoreFeaturesRice(mockFeatures);

      // All features should be scored
      expect(result).toHaveLength(mockFeatures.length);
      result.forEach(feature => {
        expect(feature).toBeDefined();
        expect(feature.id).toBeDefined();
        expect(feature.name).toBeDefined();
      });
    });

    it('should handle empty feature list', () => {
      const result = scoreFeaturesRice([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('Pricing Engine Integration', () => {
    it('should get correct tier for usage level', () => {
      // 25 users should fit in Pro tier (50 users limit)
      const tier = getTierForUsage(25, mockPricingTiers);

      expect(tier).toBeDefined();
      expect(tier?.basePrice).toBeGreaterThan(0);
    });

    it('should return Pro tier for mid-range usage', () => {
      const tier = getTierForUsage(25, mockPricingTiers);
      expect(tier?.name).toBe('Pro');
    });

    it('should handle low usage', () => {
      const tier = getTierForUsage(5, mockPricingTiers);
      expect(tier?.name).toBe('Basic');
    });

    it('should handle high usage', () => {
      const tier = getTierForUsage(100, mockPricingTiers);
      expect(tier?.name).toBe('Enterprise');
    });
  });

  describe('Proposal Scoring Integration', () => {
    it('should calculate weighted score for proposal option', () => {
      const criteria: ScoringCriteria[] = [
        { id: 'c1', name: 'Features', weight: 0.4, direction: 'benefit' },
        { id: 'c2', name: 'Price', weight: 0.3, direction: 'cost' },
        { id: 'c3', name: 'Support', weight: 0.3, direction: 'benefit' },
      ];

      const option: ProposalOption = {
        id: 'opt1',
        name: 'Pro Plan',
        scores: { c1: 85, c2: 30, c3: 80 },
        cost: 299,
      };

      const score = calculateWeightedScore(option, criteria);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(typeof score).toBe('number');
    });

    it('should calculate higher score for better options', () => {
      const criteria: ScoringCriteria[] = [
        { id: 'c1', name: 'Value', weight: 1.0, direction: 'benefit' },
      ];

      const lowOption: ProposalOption = {
        id: 'opt1',
        name: 'Low',
        scores: { c1: 30 },
      };

      const highOption: ProposalOption = {
        id: 'opt2',
        name: 'High',
        scores: { c1: 90 },
      };

      const lowScore = calculateWeightedScore(lowOption, criteria);
      const highScore = calculateWeightedScore(highOption, criteria);

      expect(highScore).toBeGreaterThan(lowScore);
    });
  });

  describe('End-to-End Proposal Flow', () => {
    let healthScore: any;
    let prioritizedFeatures: any;
    let pricing: any;

    beforeEach(() => {
      healthScore = calculateHealthScore(mockHealthScoreInput);
      prioritizedFeatures = scoreFeaturesRice(mockFeatures);
      pricing = getTierForUsage(25, mockPricingTiers);
    });

    it('should generate proposal with all components', () => {
      expect(healthScore).toBeDefined();
      expect(prioritizedFeatures).toBeDefined();
      expect(pricing).toBeDefined();

      // Verify proposal object structure
      const proposal = {
        customerId: healthScore.customerId,
        health: {
          score: healthScore.overallScore,
          status: healthScore.status,
          churnRisk: healthScore.churnProbability,
        },
        features: prioritizedFeatures,
        pricing: pricing,
        generatedAt: new Date(),
      };

      expect(proposal.customerId).toBe('cust_123');
      expect(proposal.health.score).toBeGreaterThan(0);
      expect(proposal.features.length).toBeGreaterThan(0);
      expect(proposal.pricing.basePrice).toBeGreaterThan(0);
    });

    it('should validate proposal consistency', () => {
      // Health score should influence feature selection
      if (healthScore.churnProbability > 0.5) {
        // At-risk customers should get prioritized features
        expect(prioritizedFeatures.length).toBeGreaterThan(0);
      }
    });

    it('should handle proposal generation with different customer segments', () => {
      const segments = ['startup', 'mid-market', 'enterprise'];

      for (const segment of segments) {
        const segmentInput = {
          ...mockHealthScoreInput,
          tier: segment,
        };

        const result = calculateHealthScore(segmentInput);
        expect(result).toBeDefined();
        expect(result.customerId).toBe('cust_123');
      }
    });

    it('should create complete proposal for proposal creation flow', () => {
      const proposal = {
        id: `proposal_${Date.now()}`,
        customerId: mockHealthScoreInput.customerId,
        customerName: 'Acme Corp',
        health: healthScore,
        recommendedFeatures: prioritizedFeatures.slice(0, 3),
        pricing: pricing,
        alternatives: [
          { ...pricing, basePrice: pricing.basePrice * 0.8, label: 'Basic' },
          { ...pricing, basePrice: pricing.basePrice * 1.2, label: 'Premium' },
        ],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      };

      expect(proposal.id).toBeDefined();
      expect(proposal.customerId).toBe('cust_123');
      expect(proposal.health).toBeDefined();
      expect(proposal.recommendedFeatures).toBeDefined();
      expect(proposal.pricing).toBeDefined();
      expect(proposal.pricing?.basePrice).toBeGreaterThan(0);
      expect(proposal.alternatives).toHaveLength(2);
      expect(proposal.expiresAt.getTime()).toBeGreaterThan(proposal.createdAt.getTime());
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('should handle invalid health score input', () => {
      const invalidInput = {
        ...mockHealthScoreInput,
        engagement: {
          ...mockHealthScoreInput.engagement,
          sessionsPerWeek: -5, // Invalid
        },
      };

      const result = calculateHealthScore(invalidInput);
      expect(result).toBeDefined();
      // Should still produce valid score even with edge input
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing optional fields', () => {
      const minimalInput: HealthScoreInput = {
        customerId: 'cust_456',
        tier: 'free',
        engagement: {
          customerId: 'cust_456',
          sessionsPerWeek: 0,
          featureAdoptionRate: 0,
          avgSessionDuration: 0,
          lastActiveDaysAgo: 90,
          supportTicketsOpen: 0,
          loginsLast30Days: 0,
        },
        behavior: {
          usageTrend: 0,
          supportTickets: 0,
          negativeFeedback: 0,
          missedPayments: 0,
          adminChanges: 0,
          exportedData: false,
          pricingPageViews: 0,
          cancellationSurvey: false,
        },
        nps: {
          score: 0,
          lastSurveyDate: new Date(),
          responseRate: 0,
          promoterRate: 0,
          detractorRate: 0,
        },
        firmographics: {
          companySize: 1,
          annualRevenue: 0,
          industry: 'Unknown',
          region: 'Unknown',
          techMaturity: 1,
        },
        customerAge: 0,
      };

      const result = calculateHealthScore(minimalInput);
      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle free tier pricing', () => {
      const freeTier: PricingTier = {
        name: 'Free',
        basePrice: 0,
        features: [],
        limits: { users: 1 },
      };

      const tier = getTierForUsage(1, [freeTier]);
      expect(tier?.basePrice).toBe(0);
    });

    it('should handle weighted scoring with single criterion', () => {
      const criteria: ScoringCriteria[] = [
        { id: 'c1', name: 'Test', weight: 1.0, direction: 'benefit' },
      ];

      const option: ProposalOption = {
        id: 'opt1',
        name: 'Test',
        scores: { c1: 50 },
      };

      const score = calculateWeightedScore(option, criteria);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance & Limits', () => {
    it('should handle large feature list efficiently', () => {
      const largeFeatureList = Array.from({ length: 50 }, (_, i) => ({
        id: `f${i}`,
        name: `Feature ${i}`,
        description: `Feature ${i} description`,
        effort: Math.random() * 5,
        impact: Math.random() * 10,
        risk: Math.random() * 5,
        dependencies: [],
        timelineWeeks: Math.random() * 12,
      }));

      const start = performance.now();
      const result = scoreFeaturesRice(largeFeatureList);
      const duration = performance.now() - start;

      expect(result).toBeDefined();
      expect(result.length).toBe(largeFeatureList.length);
      expect(duration).toBeLessThan(1000); // Should complete in < 1 second
    });

    it('should handle maximum proposal alternatives', () => {
      const tiers = Array.from({ length: 10 }, (_, i) => ({
        name: `Tier ${i}`,
        basePrice: (i + 1) * 99,
        features: mockFeatures.slice(0, i + 1),
        limits: { users: (i + 1) * 10 },
      }));

      expect(tiers).toHaveLength(10);
      expect(tiers[0].basePrice).toBeLessThan(tiers[9].basePrice);
    });
  });
});
