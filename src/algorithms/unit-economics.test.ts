/**
 * Unit Economics Calculator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeUnitEconomics,
  calculateLTV,
  calculateCACPayback,
  optimizeGrossMargin,
  analyzeBreakeven,
  HEALTH_THRESHOLDS,
  SAMPLE_DATA,
  type LTVMetrics,
  type CACMetrics,
  type GrossMarginConfig,
  type BreakevenInput,
  type UnitEconomicsInput,
} from './unit-economics';

describe('calculateLTV', () => {
  it('should calculate LTV for healthy SaaS metrics', () => {
    const metrics: LTVMetrics = {
      arpu: 100,
      grossMarginPercent: 80,
      churnRate: 0.05,
    };
    const result = calculateLTV(metrics);
    expect(result.ltvSimple).toBeGreaterThan(1000);
    expect(result.expectedLifetime).toBe(20); // 1/0.05 = 20 months
  });

  it('should handle zero churn gracefully', () => {
    const metrics: LTVMetrics = {
      arpu: 100,
      grossMarginPercent: 80,
      churnRate: 0,
    };
    const result = calculateLTV(metrics);
    expect(result.expectedLifetime).toBe(120); // Default cap
    expect(result.ltvSimple).toBeGreaterThan(0);
  });

  it('should calculate LTV to CAC ratio when CAC provided', () => {
    const metrics: LTVMetrics = {
      arpu: 200,
      grossMarginPercent: 75,
      churnRate: 0.04,
    };
    const result = calculateLTV(metrics, 500);
    expect(result.ltvToCacRatio).toBeGreaterThan(1);
  });

  it('should apply discount rate for NPV calculation', () => {
    const metrics: LTVMetrics = {
      arpu: 100,
      grossMarginPercent: 80,
      churnRate: 0.05,
      discountRate: 0.15,
    };
    const result = calculateLTV(metrics);
    expect(result.ltvNPV).toBeLessThan(result.ltvSimple); // NPV should be lower with higher discount
  });
});

describe('calculateCACPayback', () => {
  it('should calculate CAC and payback period', () => {
    const metrics: CACMetrics = {
      totalSpend: 10000,
      newCustomers: 100,
      arpu: 150,
      grossMarginPercent: 70,
    };
    const result = calculateCACPayback(metrics);
    expect(result.cac).toBe(100);
    expect(result.paybackMonths).toBeGreaterThan(0);
  });

  it('should rate excellent health for <6 month payback', () => {
    const metrics: CACMetrics = {
      totalSpend: 5000,
      newCustomers: 100,
      arpu: 200,
      grossMarginPercent: 80,
    };
    const result = calculateCACPayback(metrics);
    expect(result.health).toBe('excellent');
    expect(result.paybackMonths).toBeLessThanOrEqual(6);
  });

  it('should rate critical health for >18 month payback', () => {
    const metrics: CACMetrics = {
      totalSpend: 50000,
      newCustomers: 50,
      arpu: 50,
      grossMarginPercent: 40,
    };
    const result = calculateCACPayback(metrics);
    expect(result.health).toBe('critical');
  });

  it('should handle zero new customers', () => {
    const metrics: CACMetrics = {
      totalSpend: 10000,
      newCustomers: 0,
      arpu: 100,
      grossMarginPercent: 70,
    };
    const result = calculateCACPayback(metrics);
    expect(result.cac).toBe(10000);
    expect(result.health).toBe('critical');
  });
});

describe('optimizeGrossMargin', () => {
  it('should calculate current margin correctly', () => {
    const config: GrossMarginConfig = {
      revenue: 100000,
      cogs: 25000,
      variableCosts: 10000,
      fixedCosts: 40000,
    };
    const result = optimizeGrossMargin(config);
    expect(result.currentMargin).toBe(75); // (100000-25000)/100000 = 75%
  });

  it('should recommend improvements for low margin', () => {
    const config: GrossMarginConfig = {
      revenue: 50000,
      cogs: 35000,
      variableCosts: 8000,
      fixedCosts: 15000,
    };
    const result = optimizeGrossMargin(config);
    expect(result.currentMargin).toBeLessThan(50);
    expect(result.recommendations.length).toBeGreaterThan(2);
  });

  it('should show profit impact per margin point', () => {
    const config: GrossMarginConfig = {
      revenue: 100000,
      cogs: 20000,
      variableCosts: 5000,
      fixedCosts: 30000,
    };
    const result = optimizeGrossMargin(config);
    expect(result.profitPerPoint).toBe(1000); // 1% of 100000
  });

  it('should maintain healthy margin recommendations', () => {
    const config: GrossMarginConfig = {
      revenue: 200000,
      cogs: 30000,
      variableCosts: 10000,
      fixedCosts: 50000,
    };
    const result = optimizeGrossMargin(config);
    expect(result.currentMargin).toBeGreaterThan(80);
    expect(result.recommendations).toContain('Maintain current margin structure');
  });
});

describe('analyzeBreakeven', () => {
  it('should calculate breakeven units', () => {
    const input: BreakevenInput = {
      fixedCosts: 10000,
      variableCostPerUnit: 20,
      pricePerUnit: 70,
    };
    const result = analyzeBreakeven(input);
    expect(result.breakevenUnits).toBe(200); // 10000 / (70-20) = 200
  });

  it('should calculate current profit', () => {
    const input: BreakevenInput = {
      fixedCosts: 10000,
      variableCostPerUnit: 20,
      pricePerUnit: 70,
      currentUnits: 300,
    };
    const result = analyzeBreakeven(input);
    expect(result.currentProfit).toBeGreaterThan(0);
    expect(result.safetyMargin).toBeGreaterThan(0);
  });

  it('should show loss when below breakeven', () => {
    const input: BreakevenInput = {
      fixedCosts: 10000,
      variableCostPerUnit: 20,
      pricePerUnit: 70,
      currentUnits: 100,
    };
    const result = analyzeBreakeven(input);
    expect(result.currentProfit).toBeLessThan(0);
    expect(result.gapToBreakeven).toBeGreaterThan(0);
  });

  it('should handle zero current units', () => {
    const input: BreakevenInput = {
      fixedCosts: 5000,
      variableCostPerUnit: 10,
      pricePerUnit: 50,
      currentUnits: 0,
    };
    const result = analyzeBreakeven(input);
    expect(result.breakevenUnits).toBe(125); // 5000 / 40 = 125
    expect(result.gapToBreakeven).toBe(125);
  });
});

describe('analyzeUnitEconomics', () => {
  it('should analyze healthy startup', () => {
    const result = analyzeUnitEconomics(SAMPLE_DATA.healthyStartup);
    expect(['good', 'excellent']).toContain(result.overallHealth);
    expect(result.keyMetrics.ltvToCacRatio).toBeGreaterThan(1);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('should identify struggling startup issues', () => {
    const result = analyzeUnitEconomics(SAMPLE_DATA.strugglingStartup);
    expect(result.overallHealth).toBe('critical');
    expect(result.keyMetrics.ltvToCacRatio).toBeLessThan(3);
    expect(result.recommendations.length).toBeGreaterThan(2);
  });

  it('should rate enterprise SaaS highly', () => {
    const result = analyzeUnitEconomics(SAMPLE_DATA.enterpriseSaaS);
    expect(result.overallHealth).toBe('excellent');
    expect(result.keyMetrics.ltvToCacRatio).toBeGreaterThanOrEqual(3);
  });

  it('should return all required fields', () => {
    const result = analyzeUnitEconomics(SAMPLE_DATA.healthyStartup);
    expect(result.analyzedAt).toBeInstanceOf(Date);
    expect(result.companyId).toBe('startup-001');
    expect(result.ltv).toBeDefined();
    expect(result.cacPayback).toBeDefined();
    expect(result.grossMargin).toBeDefined();
    expect(result.breakeven).toBeDefined();
  });

  it('should generate actionable recommendations', () => {
    const result = analyzeUnitEconomics(SAMPLE_DATA.strugglingStartup);
    expect(result.recommendations.some((r) => r.includes('LTV') || r.includes('CAC'))).toBe(true);
  });
});

describe('HEALTH_THRESHOLDS', () => {
  it('should have valid LTV:CAC thresholds', () => {
    expect(HEALTH_THRESHOLDS.ltvToCac.excellent).toBe(5);
    expect(HEALTH_THRESHOLDS.ltvToCac.good).toBe(3);
    expect(HEALTH_THRESHOLDS.ltvToCac.warning).toBe(1);
  });

  it('should have valid CAC payback thresholds', () => {
    expect(HEALTH_THRESHOLDS.cacPayback.excellent).toBe(6);
    expect(HEALTH_THRESHOLDS.cacPayback.good).toBe(12);
    expect(HEALTH_THRESHOLDS.cacPayback.warning).toBe(18);
  });

  it('should have valid gross margin thresholds', () => {
    expect(HEALTH_THRESHOLDS.grossMargin.excellent).toBe(80);
    expect(HEALTH_THRESHOLDS.grossMargin.good).toBe(70);
    expect(HEALTH_THRESHOLDS.grossMargin.warning).toBe(50);
  });
});

describe('SAMPLE_DATA', () => {
  it('should have valid healthy startup data', () => {
    expect(SAMPLE_DATA.healthyStartup.companyId).toBe('startup-001');
    expect(SAMPLE_DATA.healthyStartup.grossMarginPercent).toBe(75);
    expect(SAMPLE_DATA.healthyStartup.churnRate).toBe(0.05);
  });

  it('should have valid struggling startup data', () => {
    expect(SAMPLE_DATA.strugglingStartup.companyId).toBe('startup-002');
    expect(SAMPLE_DATA.strugglingStartup.grossMarginPercent).toBeLessThan(50);
    expect(SAMPLE_DATA.strugglingStartup.churnRate).toBeGreaterThan(0.1);
  });

  it('should have valid enterprise SaaS data', () => {
    expect(SAMPLE_DATA.enterpriseSaaS.companyId).toBe('enterprise-001');
    expect(SAMPLE_DATA.enterpriseSaaS.arpu).toBe(2500);
    expect(SAMPLE_DATA.enterpriseSaaS.grossMarginPercent).toBeGreaterThan(80);
  });
});
