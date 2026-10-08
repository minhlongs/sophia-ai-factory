/**
 * @file churn-winback-engine.test.ts
 * @description Zero-mock unit tests for Churn Hazard Score and Winback Staircase
 * @layer tree
 */

import { describe, it, expect } from 'vitest';
import {
  calculateChurnHazardScore,
  classifyChurnRiskLevel,
  generateWinbackOffer,
  createWinbackReactivationToken,
} from '../churn-winback-engine';

describe('Churn Win-Back Engine', () => {
  it('computes low hazard score for highly active users', () => {
    const score = calculateChurnHazardScore({
      daysSinceLastActive: 1,
      loginCount30d: 25,
      mcuBurnRate30d: 5000,
      supportTicketCount: 0,
    });
    expect(score).toBeLessThan(0.2);
    expect(classifyChurnRiskLevel(score)).toBe('LOW');
  });

  it('computes critical hazard score for long dormant users with support tickets', () => {
    const score = calculateChurnHazardScore({
      daysSinceLastActive: 60,
      loginCount30d: 0,
      mcuBurnRate30d: 0,
      supportTicketCount: 3,
    });
    expect(score).toBeGreaterThanOrEqual(0.75);
    expect(classifyChurnRiskLevel(score)).toBe('CRITICAL');
  });

  it('generates margin-guarded winback offer for critical risk', () => {
    const offer = generateWinbackOffer('CRITICAL', 100);
    expect(offer.discountPercentage).toBe(35);
    expect(offer.bonusMcu).toBe(500);
    expect(offer.campaignDurationDays).toBe(7);
    expect(offer.guardedMarginFloorUsd).toBe(60);
  });

  it('generates zero discount for low risk tier', () => {
    const offer = generateWinbackOffer('LOW', 100);
    expect(offer.discountPercentage).toBe(0);
    expect(offer.bonusMcu).toBe(0);
  });

  it('produces deterministic HMAC reactivation tokens', () => {
    const token1 = createWinbackReactivationToken('u-123', 'secret-key', 1700000000);
    const token2 = createWinbackReactivationToken('u-123', 'secret-key', 1700000000);
    const tokenDiff = createWinbackReactivationToken('u-456', 'secret-key', 1700000000);

    expect(token1).toBe(token2);
    expect(token1).not.toBe(tokenDiff);
    expect(token1).toHaveLength(64);
  });
});
