/**
 * Unit Test Suite: Deterministic BANT 4-Factor Scoring & Funnel Classifier
 *
 * Validates:
 * 1. Budget factor (0-25 pts): Stated ARR, monthly MCU, revenue tier bonuses, startup floors
 * 2. Authority factor (0-25 pts): C-Level, VP, Director, Specialist, corporate domain verification
 * 3. Need factor (0-25 pts): Multi-channel syndication, APAC dubbing, dedicated GPU, white-label, pain points
 * 4. Timeline factor (0-25 pts): Immediate/ASAP, current quarter, next quarter, long-term, exploring
 * 5. Funnel classification: Hot (>=75), Warm (50-74), Cold (<50)
 * 6. Edge cases and score bounds clamping [0, 25] and [0, 100]
 *
 * @module __tests__/unit/enterprise/bant-scoring.test
 */

import { describe, it, expect } from 'vitest';
import {
  scoreBudget,
  scoreAuthority,
  scoreNeed,
  scoreTimeline,
  classifyFunnelTier,
  calculateBantScore,
  isCorporateEmailDomain,
} from '@/tree/sales/bant-scoring-service';

describe('BANT 4-Factor Scoring Service', () => {
  describe('Corporate Email Domain Detection', () => {
    it('correctly identifies corporate domains vs public webmail domains', () => {
      expect(isCorporateEmailDomain('ceo@vng.com.vn')).toBe(true);
      expect(isCorporateEmailDomain('john@acme-corp.com')).toBe(true);
      expect(isCorporateEmailDomain('founder@startup.io')).toBe(true);

      expect(isCorporateEmailDomain('lead@gmail.com')).toBe(false);
      expect(isCorporateEmailDomain('buyer@yahoo.com')).toBe(false);
      expect(isCorporateEmailDomain('test@outlook.com')).toBe(false);
      expect(isCorporateEmailDomain('user@protonmail.com')).toBe(false);
      expect(isCorporateEmailDomain(undefined)).toBe(false);
      expect(isCorporateEmailDomain('invalid-email')).toBe(false);
    });
  });

  describe('Budget Scoring (0–25 points)', () => {
    it('scores 25 for large enterprise budget >= $100K ARR or >= 250K MCU', () => {
      const res1 = scoreBudget({ statedBudgetArr: 120_000 });
      expect(res1.score).toBe(25);

      const res2 = scoreBudget({ statedMonthlyMcu: 300_000 });
      expect(res2.score).toBe(25);
    });

    it('scores 20 for mid-market budget $50K–$99K ARR or >= 100K MCU', () => {
      const res = scoreBudget({ statedBudgetArr: 60_000 });
      expect(res.score).toBe(20);
    });

    it('scores 16 for established budget $25K–$49K ARR', () => {
      const res = scoreBudget({ statedBudgetArr: 30_000 });
      expect(res.score).toBe(16);
    });

    it('scores 12 for commercial starter budget $10K–$24K ARR', () => {
      const res = scoreBudget({ statedBudgetArr: 15_000 });
      expect(res.score).toBe(12);
    });

    it('applies revenue bonuses capped at 25', () => {
      const res = scoreBudget({ statedBudgetArr: 60_000, companyRevenueRange: '> $50M' });
      // 20 base + 5 bonus = 25
      expect(res.score).toBe(25);

      const res2 = scoreBudget({ statedBudgetArr: 30_000, companyRevenueRange: '$10M-$50M' });
      // 16 base + 3 bonus = 19
      expect(res2.score).toBe(19);
    });

    it('infers score from company revenue when stated budget is absent', () => {
      expect(scoreBudget({ companyRevenueRange: '>50M' }).score).toBe(20);
      expect(scoreBudget({ companyRevenueRange: '$10M-$50M' }).score).toBe(15);
      expect(scoreBudget({ companyRevenueRange: '$1M-$10M' }).score).toBe(10);
      expect(scoreBudget({ companyRevenueRange: '<$1M' }).score).toBe(5);
    });
  });

  describe('Authority Scoring (0–25 points)', () => {
    it('scores 25 for C-Level executives with verified corporate email', () => {
      const res = scoreAuthority({
        jobTitle: 'Chief Executive Officer',
        leadEmail: 'alex@enterprise.com',
      });
      // 22 base + 3 bonus = 25
      expect(res.score).toBe(25);
      expect(res.details.corporateDomainBonus).toBe(true);
    });

    it('scores 22 for C-Level with free webmail', () => {
      const res = scoreAuthority({
        jobTitle: 'Co-Founder & CTO',
        leadEmail: 'alex@gmail.com',
      });
      expect(res.score).toBe(22);
    });

    it('scores 21 for VP / Head of Department with corporate email', () => {
      const res = scoreAuthority({
        jobTitle: 'VP of Digital Growth',
        leadEmail: 'vp@globalmedia.vn',
      });
      // 18 base + 3 bonus = 21
      expect(res.score).toBe(21);
    });

    it('scores 18 for Director / Principal with corporate email', () => {
      const res = scoreAuthority({
        jobTitle: 'Director of Content Production',
        leadEmail: 'director@agency.io',
      });
      // 15 base + 3 = 18
      expect(res.score).toBe(18);
    });

    it('scores individual contributors appropriately', () => {
      const res = scoreAuthority({
        jobTitle: 'Video Specialist',
        leadEmail: 'editor@yahoo.com',
      });
      expect(res.score).toBe(4);
    });
  });

  describe('Need Scoring (0–25 points)', () => {
    it('sums multi-need requirements accurately', () => {
      const res = scoreNeed({
        needsHighVolumeSyndication: true, // +7
        needsApacDubbing: true, // +6
        needsDedicatedGpuLane: true, // +5
        needsCustomApiOrWhiteLabel: true, // +4
        statedBottleneckOrPainPoint: 'Manual localization takes 2 weeks per language', // +3
      });
      // 7 + 6 + 5 + 4 + 3 = 25
      expect(res.score).toBe(25);
    });

    it('scores partial needs correctly', () => {
      const res = scoreNeed({
        needsApacDubbing: true, // +6
        statedBottleneckOrPainPoint: 'Localization costs are too high', // +3
      });
      expect(res.score).toBe(9);
    });

    it('provides minimum baseline for unspecified need', () => {
      const res = scoreNeed({});
      expect(res.score).toBe(2);
    });
  });

  describe('Timeline Scoring (0–25 points)', () => {
    it('scores 25 for immediate / ASAP deployment', () => {
      expect(scoreTimeline({ timeframe: 'immediate' }).score).toBe(25);
      expect(scoreTimeline({ timeframe: 'asap' }).score).toBe(25);
      expect(scoreTimeline({ timeframe: '< 1 month' }).score).toBe(25);
    });

    it('scores 20 for current quarter (1-3 months)', () => {
      expect(scoreTimeline({ timeframe: '1_to_3_months' }).score).toBe(20);
      expect(scoreTimeline({ timeframe: 'current quarter' }).score).toBe(20);
    });

    it('scores 12 for 3-6 months and 5 for 6-12 months', () => {
      expect(scoreTimeline({ timeframe: '3_to_6_months' }).score).toBe(12);
      expect(scoreTimeline({ timeframe: '6_to_12_months' }).score).toBe(5);
    });

    it('scores 2 for early browsing', () => {
      expect(scoreTimeline({ timeframe: 'exploring' }).score).toBe(2);
    });
  });

  describe('Funnel Tier Classification & Full BANT Pipeline', () => {
    it('classifies Hot Deals (total score >= 75)', () => {
      expect(classifyFunnelTier(75)).toBe('hot');
      expect(classifyFunnelTier(95)).toBe('hot');
      expect(classifyFunnelTier(100)).toBe('hot');
    });

    it('classifies Warm Deals (total score 50–74)', () => {
      expect(classifyFunnelTier(50)).toBe('warm');
      expect(classifyFunnelTier(65)).toBe('warm');
      expect(classifyFunnelTier(74)).toBe('warm');
    });

    it('classifies Cold Deals (total score < 50)', () => {
      expect(classifyFunnelTier(49)).toBe('cold');
      expect(classifyFunnelTier(25)).toBe('cold');
      expect(classifyFunnelTier(0)).toBe('cold');
    });

    it('computes full BANT evaluation for high-velocity enterprise lead', () => {
      const result = calculateBantScore({
        statedBudgetArr: 100_000,
        statedMonthlyMcu: 250_000,
        jobTitle: 'Chief Marketing Officer',
        leadEmail: 'cmo@enterprise.vn',
        needsHighVolumeSyndication: true,
        needsApacDubbing: true,
        needsDedicatedGpuLane: true,
        timeframe: 'immediate',
      });

      expect(result.budgetScore).toBe(25);
      expect(result.authorityScore).toBe(25);
      expect(result.needScore).toBeGreaterThanOrEqual(18);
      expect(result.timelineScore).toBe(25);
      expect(result.totalScore).toBeGreaterThanOrEqual(93);
      expect(result.pipelineTier).toBe('hot');
      expect(result.analysis.recommendation).toContain('Immediate executive outreach');
    });

    it('computes realistic warm deal evaluation', () => {
      const result = calculateBantScore({
        statedBudgetArr: 25_000, // 16 pts
        jobTitle: 'Senior Marketing Manager', // 10 pts + 3 corporate = 13 pts
        leadEmail: 'lead@brand.com',
        needsApacDubbing: true, // 6 pts
        timeframe: '1_to_3_months', // 20 pts
      });

      // 16 + 13 + 6 + 20 = 55 pts
      expect(result.totalScore).toBe(55);
      expect(result.pipelineTier).toBe('warm');
      expect(result.analysis.recommendation).toContain('sales discovery cadence');
    });
  });
});
