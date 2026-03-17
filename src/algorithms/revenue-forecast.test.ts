/**
 * Revenue Forecast Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  forecastRevenue,
  projectMRR,
  projectCohortRevenue,
  calculateNetMRRChange,
  calculateEndingMRR,
  calculateMRRGrowthRate,
  calculateChurnRate,
  calculateExpansionRate,
  calculateQuickRatio,
  calculateCAGR,
  calculateVolatility,
  calculateConfidenceInterval,
  applySeasonalAdjustment,
  getSeasonalFactor,
  DEFAULT_SEASONAL_FACTORS,
  SAMPLE_DATA,
  type MRRData,
  type CohortMetrics,
} from './revenue-forecast';

const sampleMRRData: MRRData = {
  month: '2026-02',
  startingMRR: 130600,
  newMRR: 18000,
  expansionMRR: 6000,
  contractionMRR: 2500,
  churnedMRR: 5500,
  reactivatedMRR: 1000,
};

describe('calculateNetMRRChange', () => {
  it('should calculate net MRR change correctly', () => {
    const netChange = calculateNetMRRChange(sampleMRRData);
    expect(netChange).toBe(17000);
  });

  it('should handle negative net change', () => {
    const negativeData: MRRData = {
      ...sampleMRRData,
      newMRR: 2000,
      churnedMRR: 20000,
    };
    expect(calculateNetMRRChange(negativeData)).toBeLessThan(0);
  });
});

describe('calculateEndingMRR', () => {
  it('should calculate ending MRR correctly', () => {
    const endingMRR = calculateEndingMRR(sampleMRRData);
    expect(endingMRR).toBe(147600);
  });
});

describe('calculateMRRGrowthRate', () => {
  it('should calculate growth rate correctly', () => {
    const growthRate = calculateMRRGrowthRate(sampleMRRData);
    expect(growthRate).toBeGreaterThan(0.1);
  });

  it('should return 0 for zero starting MRR', () => {
    const zeroData: MRRData = { ...sampleMRRData, startingMRR: 0 };
    expect(calculateMRRGrowthRate(zeroData)).toBe(0);
  });
});

describe('calculateChurnRate', () => {
  it('should calculate churn rate correctly', () => {
    const churnRate = calculateChurnRate(sampleMRRData);
    expect(churnRate).toBeLessThan(0.1);
  });
});

describe('calculateExpansionRate', () => {
  it('should calculate expansion rate correctly', () => {
    const expansionRate = calculateExpansionRate(sampleMRRData);
    expect(expansionRate).toBeGreaterThan(0.04);
  });
});

describe('calculateQuickRatio', () => {
  it('should calculate quick ratio correctly', () => {
    const quickRatio = calculateQuickRatio(sampleMRRData);
    expect(quickRatio).toBeGreaterThan(2);
  });

  it('should return high value for zero churn', () => {
    const noChurnData: MRRData = { ...sampleMRRData, churnedMRR: 0, contractionMRR: 0 };
    expect(calculateQuickRatio(noChurnData)).toBe(Infinity);
  });
});

describe('getSeasonalFactor', () => {
  it('should return correct factor for January', () => {
    expect(getSeasonalFactor(0)).toBe(0.95);
  });

  it('should return correct factor for December', () => {
    expect(getSeasonalFactor(11)).toBe(0.85);
  });

  it('should return 1.0 for invalid month', () => {
    expect(getSeasonalFactor(99)).toBe(1.0);
  });
});

describe('applySeasonalAdjustment', () => {
  it('should apply seasonal factor correctly', () => {
    const adjusted = applySeasonalAdjustment(100000, 0); // January
    expect(adjusted).toBe(95000);
  });

  it('should increase MRR for high season', () => {
    const adjusted = applySeasonalAdjustment(100000, 5); // June
    expect(adjusted).toBeCloseTo(110000, 0);
  });
});

describe('calculateConfidenceInterval', () => {
  it('should calculate 95% confidence interval', () => {
    const interval = calculateConfidenceInterval(100, 10, 30, 0.95);
    expect(interval.lower).toBeLessThan(100);
    expect(interval.upper).toBeGreaterThan(100);
    expect(interval.margin).toBeGreaterThan(0);
  });

  it('should return wider interval for 99% confidence', () => {
    const interval95 = calculateConfidenceInterval(100, 10, 30, 0.95);
    const interval99 = calculateConfidenceInterval(100, 10, 30, 0.99);
    expect(interval99.margin).toBeGreaterThan(interval95.margin);
  });

  it('should return narrower interval for larger sample', () => {
    const small = calculateConfidenceInterval(100, 10, 30);
    const large = calculateConfidenceInterval(100, 10, 300);
    expect(large.margin).toBeLessThan(small.margin);
  });
});

describe('calculateVolatility', () => {
  it('should calculate volatility from growth rates', () => {
    const rates = [0.1, 0.15, 0.08, 0.12, 0.09];
    const volatility = calculateVolatility(rates);
    expect(volatility).toBeGreaterThan(0);
    expect(volatility).toBeLessThan(0.1);
  });

  it('should return default for single value', () => {
    expect(calculateVolatility([0.1])).toBe(0.1);
  });
});

describe('calculateCAGR', () => {
  it('should calculate CAGR correctly', () => {
    const cagr = calculateCAGR(100000, 150000, 12); // 1 year
    expect(cagr).toBeCloseTo(0.5, 2);
  });

  it('should handle multi-year CAGR', () => {
    const cagr = calculateCAGR(100000, 400000, 36); // 3 years
    expect(cagr).toBeCloseTo(0.587, 2);
  });

  it('should return 0 for zero starting MRR', () => {
    expect(calculateCAGR(0, 100000, 12)).toBe(0);
  });
});

describe('projectCohortRevenue', () => {
  it('should project cohort revenue over time', () => {
    const cohort: CohortMetrics = {
      cohortMonth: '2026-01',
      initialCustomers: 100,
      retentionRates: [1.0, 0.9, 0.85, 0.8, 0.78],
      avgMRRPerCustomer: 500,
      expansionRate: 0.05,
      churnRate: 0.1,
    };
    const revenues = projectCohortRevenue(cohort, 5);
    expect(revenues).toHaveLength(5);
    expect(revenues[0]).toBeGreaterThan(revenues[4]); // Declining due to churn
  });

  it('should handle expansion overriding churn', () => {
    const growthCohort: CohortMetrics = {
      cohortMonth: '2026-01',
      initialCustomers: 100,
      retentionRates: [1.0, 0.95, 0.92, 0.90, 0.88],
      avgMRRPerCustomer: 500,
      expansionRate: 0.15, // High expansion
      churnRate: 0.05,
    };
    const revenues = projectCohortRevenue(growthCohort, 5);
    // With 12% monthly churn and 15% expansion, net effect varies
    expect(revenues[0]).toBeGreaterThan(0);
    expect(revenues[4]).toBeGreaterThan(0);
  });
});

describe('projectMRR', () => {
  it('should project MRR with growth', () => {
    const forecasts = projectMRR(100000, 0.1, 6, false);
    expect(forecasts).toHaveLength(6);
    forecasts.forEach((f, i) => {
      if (i > 0) {
        expect(f.projectedMRR).toBeGreaterThan(forecasts[i - 1].projectedMRR);
      }
    });
  });

  it('should include confidence intervals', () => {
    const forecasts = projectMRR(100000, 0.1, 3, false);
    forecasts.forEach((f) => {
      expect(f.lowerBound).toBeLessThan(f.projectedMRR);
      expect(f.upperBound).toBeGreaterThan(f.projectedMRR);
    });
  });

  it('should calculate growth rates', () => {
    const forecasts = projectMRR(100000, 0.1, 3, false);
    forecasts.forEach((f) => {
      expect(f.growthRate).toBeDefined();
    });
  });
});

describe('forecastRevenue', () => {
  it('should generate complete revenue forecast', () => {
    const result = forecastRevenue(
      SAMPLE_DATA.historicalMRR,
      SAMPLE_DATA.cohorts,
      SAMPLE_DATA.config
    );

    expect(result.monthlyForecasts).toHaveLength(12);
    expect(result.startingMRR).toBeGreaterThan(0);
    expect(result.endingMRR).toBeGreaterThan(result.startingMRR);
    expect(result.cagr).toBeDefined();
    expect(result.totalGrowth).toBeGreaterThan(0);
  });

  it('should include cohort contribution when enabled', () => {
    const result = forecastRevenue(
      SAMPLE_DATA.historicalMRR,
      SAMPLE_DATA.cohorts,
      { ...SAMPLE_DATA.config, includeCohorts: true }
    );
    expect(result.cohortContribution).toBeDefined();
  });

  it('should include seasonal impact when enabled', () => {
    const result = forecastRevenue(
      SAMPLE_DATA.historicalMRR,
      SAMPLE_DATA.cohorts,
      { ...SAMPLE_DATA.config, includeSeasonality: true }
    );
    expect(result.seasonalImpact).toBeDefined();
  });

  it('should handle forecast without cohorts', () => {
    const result = forecastRevenue(
      SAMPLE_DATA.historicalMRR,
      [],
      { ...SAMPLE_DATA.config, includeCohorts: false }
    );
    expect(result.cohortContribution).toBeUndefined();
  });

  it('should respect horizon months', () => {
    const shortForecast = forecastRevenue(
      SAMPLE_DATA.historicalMRR,
      SAMPLE_DATA.cohorts,
      { ...SAMPLE_DATA.config, horizonMonths: 6 }
    );
    expect(shortForecast.monthlyForecasts).toHaveLength(6);

    const longForecast = forecastRevenue(
      SAMPLE_DATA.historicalMRR,
      SAMPLE_DATA.cohorts,
      { ...SAMPLE_DATA.config, horizonMonths: 24 }
    );
    expect(longForecast.monthlyForecasts).toHaveLength(24);
  });
});

describe('DEFAULT_SEASONAL_FACTORS', () => {
  it('should have 12 months', () => {
    expect(DEFAULT_SEASONAL_FACTORS).toHaveLength(12);
  });

  it('should have factors between 0.8 and 1.2', () => {
    DEFAULT_SEASONAL_FACTORS.forEach((factor) => {
      expect(factor.factor).toBeGreaterThanOrEqual(0.8);
      expect(factor.factor).toBeLessThanOrEqual(1.2);
    });
  });

  it('should have December as lowest', () => {
    const december = DEFAULT_SEASONAL_FACTORS[11];
    const minFactor = Math.min(...DEFAULT_SEASONAL_FACTORS.map((f) => f.factor));
    expect(december.factor).toBe(minFactor);
  });
});

describe('SAMPLE_DATA', () => {
  it('should have valid historical MRR data', () => {
    expect(SAMPLE_DATA.historicalMRR).toHaveLength(5);
    SAMPLE_DATA.historicalMRR.forEach((data) => {
      expect(data.startingMRR).toBeGreaterThan(0);
    });
  });

  it('should have valid cohort data', () => {
    expect(SAMPLE_DATA.cohorts).toHaveLength(2);
    SAMPLE_DATA.cohorts.forEach((cohort) => {
      expect(cohort.initialCustomers).toBeGreaterThan(0);
      expect(cohort.retentionRates.length).toBeGreaterThanOrEqual(4);
    });
  });

  it('should have valid config', () => {
    expect(SAMPLE_DATA.config.horizonMonths).toBe(12);
    expect(SAMPLE_DATA.config.confidenceLevel).toBe(0.90);
  });
});
