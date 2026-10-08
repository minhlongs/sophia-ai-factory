/**
 * Unit Tests for Video Pipeline Net ROI & Unit Economics Calculator
 *
 * @module tree/analytics/__tests__/roi-calculator.test
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFinancialAttribution,
  aggregateChannelRoi,
  BASE_RENDER_COST_PER_MCU_USD,
} from '../roi-calculator';

describe('ROI Calculator', () => {
  it('calculates single video attribution with positive net margin', () => {
    // 20 MCU * $0.005 = $0.10, BYOK = $0.05, total = $0.15. Rev = $1.50 -> Net = $1.35
    const result = calculateFinancialAttribution({
      mcuCost: 20,
      byokCostUsd: 0.05,
      revenueUsd: 1.5,
    });

    expect(result.mcuCost).toBe(20);
    expect(result.mcuCostUsd).toBe(0.1);
    expect(result.byokCostUsd).toBe(0.05);
    expect(result.totalCostUsd).toBe(0.15);
    expect(result.revenueUsd).toBe(1.5);
    expect(result.netMarginUsd).toBe(1.35);
    expect(result.roiPercent).toBe(900); // (1.50 - 0.15) / 0.15 * 100 = 900%
    expect(result.roiPerMcu).toBe(0.0725); // (1.50 - 0.05) / 20 = 0.0725 $/MCU
  });

  it('handles zero revenue and computes negative net margin', () => {
    const result = calculateFinancialAttribution({
      mcuCost: 10,
      byokCostUsd: 0.02,
      revenueUsd: 0,
    });

    expect(result.totalCostUsd).toBe(0.07);
    expect(result.netMarginUsd).toBe(-0.07);
    expect(result.roiPercent).toBe(-100);
    expect(result.roiPerMcu).toBe(-0.002);
  });

  it('handles custom MCU cost rate override', () => {
    const result = calculateFinancialAttribution({
      mcuCost: 10,
      costPerMcuUsd: 0.01,
      revenueUsd: 0.5,
    });

    expect(result.mcuCostUsd).toBe(0.1);
    expect(result.netMarginUsd).toBe(0.4);
  });

  it('aggregates channel metrics across multiple videos', () => {
    const attr1 = calculateFinancialAttribution({ mcuCost: 20, revenueUsd: 1.0 });
    const attr2 = calculateFinancialAttribution({ mcuCost: 30, revenueUsd: 2.0 });

    const aggregate = aggregateChannelRoi([attr1, attr2]);

    expect(aggregate.totalRevenueUsd).toBe(3.0);
    expect(aggregate.totalCostUsd).toBe(0.25);
    expect(aggregate.totalNetMarginUsd).toBe(2.75);
    expect(aggregate.overallRoiPercent).toBe(1100);
    expect(aggregate.avgRoiPerMcu).toBe(0.06); // 3.0 / 50 MCU
  });

  it('handles empty attribution list in aggregate gracefully', () => {
    const aggregate = aggregateChannelRoi([]);
    expect(aggregate.totalRevenueUsd).toBe(0);
    expect(aggregate.totalCostUsd).toBe(0);
    expect(aggregate.totalNetMarginUsd).toBe(0);
    expect(aggregate.overallRoiPercent).toBe(0);
  });
});
