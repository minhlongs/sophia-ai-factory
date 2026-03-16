/**
 * Lead Qualifier Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
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
  type LeadQualificationInput,
  type ICPMatch,
  type BehavioralSignals,
  type FirmographicData,
} from './lead-qualifier';

const mockICP: ICPMatch = {
  companySizeFit: 80,
  industryFit: 90,
  budgetFit: 70,
  timelineUrgency: 85,
  hasDecisionMaker: true,
  painPointFit: 75,
};

const mockBehavior: BehavioralSignals = {
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

const mockFirmographics: FirmographicData = {
  companyName: 'TechCorp Inc',
  companySize: 120,
  annualRevenue: 5000000,
  industry: 'Technology',
  location: 'San Francisco, CA',
  technologies: ['React', 'Node.js', 'AWS'],
  fundingStage: 'series-a',
  growthRate: 35,
};

const mockInput: LeadQualificationInput = {
  leadId: 'lead-001',
  icp: mockICP,
  behavior: mockBehavior,
  firmographics: mockFirmographics,
  source: 'referral',
};

describe('calculateICPMatchScore', () => {
  it('should calculate ICP score with all factors', () => {
    const score = calculateICPMatchScore(mockICP);
    expect(score).toBeGreaterThan(70);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should return 0 for all zeros', () => {
    const emptyICP: ICPMatch = {
      companySizeFit: 0,
      industryFit: 0,
      budgetFit: 0,
      timelineUrgency: 0,
      hasDecisionMaker: false,
      painPointFit: 0,
    };
    expect(calculateICPMatchScore(emptyICP)).toBe(0);
  });

  it('should return 100 for perfect match', () => {
    const perfectICP: ICPMatch = {
      companySizeFit: 100,
      industryFit: 100,
      budgetFit: 100,
      timelineUrgency: 100,
      hasDecisionMaker: true,
      painPointFit: 100,
    };
    expect(calculateICPMatchScore(perfectICP)).toBe(100);
  });
});

describe('calculateBehavioralScore', () => {
  it('should calculate behavioral score for engaged lead', () => {
    const score = calculateBehavioralScore(mockBehavior);
    expect(score).toBeGreaterThan(70);
  });

  it('should return low score for no engagement', () => {
    const emptyBehavior: BehavioralSignals = {
      websiteVisits: 0,
      demoRequested: false,
      pricingPageViews: 0,
      contentDownloads: 0,
      emailOpenRate: 0,
      emailClickRate: 0,
      webinarAttendance: false,
      trialStarted: false,
      trialActivity: 0,
      daysSinceEngagement: 90,
    };
    expect(calculateBehavioralScore(emptyBehavior)).toBeLessThan(30);
  });

  it('should give high score for demo request', () => {
    const demoBehavior: BehavioralSignals = {
      ...mockBehavior,
      websiteVisits: 1,
      pricingPageViews: 0,
      contentDownloads: 0,
      demoRequested: true,
    };
    expect(calculateBehavioralScore(demoBehavior)).toBeGreaterThan(20);
  });
});

describe('calculateFirmographicScore', () => {
  it('should calculate firmographic score for ideal company', () => {
    const score = calculateFirmographicScore(mockFirmographics);
    expect(score).toBeGreaterThan(70);
  });

  it('should score small company lower', () => {
    const smallCompany: FirmographicData = {
      ...mockFirmographics,
      companySize: 10,
      annualRevenue: 200000,
    };
    const score = calculateFirmographicScore(smallCompany);
    expect(score).toBeLessThan(60);
  });

  it('should score large enterprise lower', () => {
    const largeCompany: FirmographicData = {
      ...mockFirmographics,
      companySize: 5000,
      annualRevenue: 500000000,
    };
    const score = calculateFirmographicScore(largeCompany);
    expect(score).toBeLessThan(50);
  });
});

describe('classifyLead', () => {
  it('should classify SQL for score >= 80', () => {
    expect(classifyLead(80)).toBe('sql');
    expect(classifyLead(95)).toBe('sql');
  });

  it('should classify MQL for score 60-79', () => {
    expect(classifyLead(60)).toBe('mql');
    expect(classifyLead(75)).toBe('mql');
  });

  it('should classify nurturing for score 40-59', () => {
    expect(classifyLead(40)).toBe('nurturing');
    expect(classifyLead(55)).toBe('nurturing');
  });

  it('should classify not-qualified for score < 40', () => {
    expect(classifyLead(0)).toBe('not-qualified');
    expect(classifyLead(35)).toBe('not-qualified');
  });
});

describe('qualifyLead', () => {
  it('should qualify high-intent lead as SQL', () => {
    const result = qualifyLead(mockInput);
    expect(result.status).toBe('sql');
    expect(result.overallScore).toBeGreaterThanOrEqual(80);
  });

  it('should return breakdown with all components', () => {
    const result = qualifyLead(mockInput);
    expect(result.breakdown.icpMatch).toBeDefined();
    expect(result.breakdown.behavioral).toBeDefined();
    expect(result.breakdown.firmographic).toBeDefined();
  });

  it('should generate next steps based on status', () => {
    const result = qualifyLead(mockInput);
    expect(result.nextSteps).toHaveLength(5);
    expect(result.recommendedAction).toBeTruthy();
  });

  it('should mark as high priority for SQL with decision maker', () => {
    const result = qualifyLead(mockInput);
    expect(result.isHighPriority).toBe(true);
  });

  it('should calculate churn risk', () => {
    const result = qualifyLead(mockInput);
    expect(result.churnRisk).toBeDefined();
  });

  it('should handle low-quality lead', () => {
    const badLead: LeadQualificationInput = {
      leadId: 'lead-bad',
      icp: {
        companySizeFit: 20,
        industryFit: 30,
        budgetFit: 10,
        timelineUrgency: 10,
        hasDecisionMaker: false,
        painPointFit: 20,
      },
      behavior: {
        websiteVisits: 1,
        demoRequested: false,
        pricingPageViews: 0,
        contentDownloads: 0,
        emailOpenRate: 0.1,
        emailClickRate: 0.01,
        webinarAttendance: false,
        trialStarted: false,
        trialActivity: 0,
        daysSinceEngagement: 60,
      },
      firmographics: {
        ...mockFirmographics,
        companySize: 5,
        annualRevenue: 100000,
        growthRate: 0,
        fundingStage: 'bootstrapped',
      },
      source: 'outbound',
    };
    const result = qualifyLead(badLead);
    expect(result.status).toBe('not-qualified');
    expect(result.overallScore).toBeLessThan(40);
  });
});

describe('qualifyLeadsBatch', () => {
  it('should qualify multiple leads', () => {
    const leads: LeadQualificationInput[] = [mockInput, mockInput, mockInput];
    const results = qualifyLeadsBatch(leads);
    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(r.status).toBe('sql');
    });
  });
});

describe('compareLeadScores', () => {
  it('should detect improving trend', () => {
    const result = compareLeadScores(50, 70);
    expect(result.trend).toBe('improving');
    expect(result.scoreChange).toBe(20);
  });

  it('should detect declining trend', () => {
    const result = compareLeadScores(80, 60);
    expect(result.trend).toBe('declining');
    expect(result.scoreChange).toBe(-20);
  });

  it('should detect stable trend', () => {
    const result = compareLeadScores(65, 67);
    expect(result.trend).toBe('stable');
  });

  it('should mark as new lead without previous score', () => {
    const result = compareLeadScores(undefined, 75);
    expect(result.trend).toBe('new');
  });

  it('should detect status change', () => {
    const result = compareLeadScores(55, 82);
    expect(result.statusChange).toBeDefined();
    expect(result.statusChange?.from).toBe('nurturing');
    expect(result.statusChange?.to).toBe('sql');
  });
});

describe('isHighPriority', () => {
  it('should be high priority for SQL with decision maker', () => {
    expect(isHighPriority('sql', mockICP, mockBehavior)).toBe(true);
  });

  it('should be high priority for high urgency + demo', () => {
    const highUrgencyICP: ICPMatch = {
      ...mockICP,
      timelineUrgency: 90,
    };
    const demoBehavior: BehavioralSignals = {
      ...mockBehavior,
      demoRequested: true,
    };
    expect(isHighPriority('mql', highUrgencyICP, demoBehavior)).toBe(true);
  });

  it('should not be high priority for low engagement', () => {
    const lowICP: ICPMatch = {
      ...mockICP,
      hasDecisionMaker: false,
      timelineUrgency: 20,
    };
    const lowBehavior: BehavioralSignals = {
      ...mockBehavior,
      demoRequested: false,
      trialStarted: false,
    };
    expect(isHighPriority('mql', lowICP, lowBehavior)).toBe(false);
  });
});

describe('assessChurnRisk', () => {
  it('should return low churn risk for strong lead', () => {
    const breakdown = {
      icpMatch: 85,
      behavioral: 80,
      firmographic: 75,
    };
    expect(assessChurnRisk(breakdown, mockICP)).toBe('low');
  });

  it('should return high churn risk for weak ICP match', () => {
    const weakBreakdown = {
      icpMatch: 40,
      behavioral: 80,
      firmographic: 75,
    };
    const weakICP: ICPMatch = {
      ...mockICP,
      budgetFit: 30,
      hasDecisionMaker: false,
    };
    expect(assessChurnRisk(weakBreakdown, weakICP)).toBe('high');
  });

  it('should return undefined for unqualified leads', () => {
    const breakdown = {
      icpMatch: 30,
      behavioral: 25,
      firmographic: 30,
    };
    expect(assessChurnRisk(breakdown, mockICP)).toBeUndefined();
  });
});

describe('generateRecommendedAction', () => {
  it('should recommend sales outreach for SQL', () => {
    const breakdown = { icpMatch: 85, behavioral: 80, firmographic: 75 };
    const action = generateRecommendedAction('sql', breakdown);
    expect(action).toContain('sales');
  });

  it('should recommend nurture for MQL', () => {
    const breakdown = { icpMatch: 65, behavioral: 60, firmographic: 55 };
    const action = generateRecommendedAction('mql', breakdown);
    expect(action).toContain('nurture');
  });
});

describe('generateNextSteps', () => {
  it('should return 5 steps for SQL', () => {
    const steps = generateNextSteps('sql');
    expect(steps).toHaveLength(5);
    expect(steps[0]).toContain('AE');
  });

  it('should return 5 steps for nurturing', () => {
    const steps = generateNextSteps('nurturing');
    expect(steps).toHaveLength(5);
  });
});

describe('LEAD_THRESHOLDS', () => {
  it('should have correct threshold values', () => {
    expect(LEAD_THRESHOLDS.SQL).toBe(80);
    expect(LEAD_THRESHOLDS.MQL).toBe(60);
    expect(LEAD_THRESHOLDS.NURTURING).toBe(40);
  });
});
