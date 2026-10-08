import { describe, it, expect } from 'vitest';
import { calculateRoiMetrics } from '../roi-calculator';

describe('roi-calculator', () => {
  it('calculates ROAS and CPA correctly for profitable video', () => {
    const stats = {
      spend: 1000,     // 1000 cents ($10)
      revenue: 5000,   // 5000 cents ($50)
      conversions: 5
    };
    
    const metrics = calculateRoiMetrics(stats);
    
    expect(metrics.roas).toBe(5); // 5000 / 1000
    expect(metrics.cpa).toBe(200); // 1000 / 5
    // baseLtv = (5000/5) * 5 = 5000
    // ltvScore = 5000 * 5 = 25000
    expect(metrics.ltvScore).toBe(25000); 
  });

  it('calculates ROAS and CPA correctly for loss-making video', () => {
    const stats = {
      spend: 2000,     
      revenue: 1000,   
      conversions: 2
    };
    
    const metrics = calculateRoiMetrics(stats);
    
    expect(metrics.roas).toBe(0.5); 
    expect(metrics.cpa).toBe(1000); 
    // baseLtv = 1000
    // roas = 0.5 (not > 1), so multiplier is 0.5 * 0.5 = 0.25
    // ltvScore = 1000 * 0.25 = 250
    expect(metrics.ltvScore).toBe(250); 
  });

  it('handles zero conversions gracefully', () => {
    const stats = {
      spend: 1000,     
      revenue: 0,   
      conversions: 0
    };
    
    const metrics = calculateRoiMetrics(stats);
    
    expect(metrics.roas).toBe(0); 
    expect(metrics.cpa).toBe(0); 
    expect(metrics.ltvScore).toBe(0); 
  });

  it('handles zero spend safely', () => {
    const stats = {
      spend: 0,     
      revenue: 5000,   
      conversions: 1
    };
    
    const metrics = calculateRoiMetrics(stats);
    
    // Spend is clamped to 0.01 to prevent div by zero
    // ROAS = 5000 / 0.01 = 500000
    expect(metrics.roas).toBe(500000); 
    expect(metrics.cpa).toBe(0); 
  });
});
