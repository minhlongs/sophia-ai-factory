/**
 * @file b2b-warmup-engine.test.ts
 * @description Unit tests for B2B warmup calculations, CAN-SPAM HMAC headers & corporate domain validation
 */

import { describe, it, expect } from 'vitest';
import {
  isCorporateDomain,
  calculateWarmupDailyVolume,
  generateUnsubscribeSignature,
  verifyUnsubscribeSignature,
} from '../b2b-warmup-engine';

describe('B2B Warmup Engine (Tree Layer)', () => {
  it('correctly filters corporate domains vs personal webmails', () => {
    expect(isCorporateDomain('gmail.com')).toBe(false);
    expect(isCorporateDomain('yahoo.com')).toBe(false);
    expect(isCorporateDomain('outlook.com')).toBe(false);
    expect(isCorporateDomain('')).toBe(false);

    expect(isCorporateDomain('agencyos.network')).toBe(true);
    expect(isCorporateDomain('sophia.ai')).toBe(true);
    expect(isCorporateDomain('enterprise-corp.vn')).toBe(true);
  });

  it('computes exponential warmup volume capped at maxDailyVolume', () => {
    // Day 1: 5 * (1.2)^0 = 5
    expect(calculateWarmupDailyVolume(1)).toBe(5);
    // Day 2: 5 * (1.2)^1 = 6
    expect(calculateWarmupDailyVolume(2)).toBe(6);
    // Day 5: 5 * (1.2)^4 = 10.36 -> 10
    expect(calculateWarmupDailyVolume(5)).toBe(10);
    // Day 20: capped at 50
    expect(calculateWarmupDailyVolume(20)).toBe(50);
    // Negative or 0 day returns 0
    expect(calculateWarmupDailyVolume(0)).toBe(0);
  });

  it('generates and verifies valid HMAC-SHA256 unsubscribe signatures', () => {
    const leadId = 'lead-xyz-123';
    const userId = 'usr-admin-88';
    const secret = 'super-secret-salt-key-2026';

    const sig = generateUnsubscribeSignature(leadId, userId, secret);
    expect(typeof sig).toBe('string');
    expect(sig.length).toBe(64);

    expect(verifyUnsubscribeSignature(leadId, userId, sig, secret)).toBe(true);
    expect(verifyUnsubscribeSignature('tampered-lead', userId, sig, secret)).toBe(false);
    expect(verifyUnsubscribeSignature(leadId, userId, sig, 'wrong-secret')).toBe(false);
  });
});
