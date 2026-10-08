/**
 * @file recruitment-fsm-engine.test.ts
 * @description Zero-mock unit tests for Creator Recruitment & Negotiation FSM Engine
 * @layer tree
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateKolQuality,
  calculateNegotiatedSplit,
  advanceKolStatusFsm,
  generateCanSpamOneClickHeader,
} from '../recruitment-fsm-engine';

describe('Creator Recruitment & Negotiation FSM Engine', () => {
  it('evaluates healthy KOL profile as qualified', () => {
    const res = evaluateKolQuality({
      platform: 'TIKTOK',
      handle: 'viral_reviewer',
      followerCount: 100000,
      medianViews: 20000,
      totalInteractions: 12000,
      samplePostCount: 10,
    });

    expect(res.isQualified).toBe(true);
    expect(res.engagementRatePct).toBe(6.0);
    expect(res.qualityScore).toBeGreaterThan(30);
  });

  it('disqualifies low engagement KOL', () => {
    const res = evaluateKolQuality({
      platform: 'TIKTOK',
      handle: 'ghost_account',
      followerCount: 500000,
      medianViews: 10000,
      totalInteractions: 1000,
      samplePostCount: 10,
    });

    expect(res.isQualified).toBe(false);
    expect(res.disqualificationReason).toContain('3.0% threshold');
  });

  it('calculates stepped revenue split bounded between 20% and 40%', () => {
    const lowTierSplit = calculateNegotiatedSplit(0.50, 10);
    expect(lowTierSplit).toBeLessThan(0.30);
    expect(lowTierSplit).toBeGreaterThanOrEqual(0.20);

    const highTierSplit = calculateNegotiatedSplit(0.38, 95);
    expect(highTierSplit).toBeLessThanOrEqual(0.40);
    expect(highTierSplit).toBeGreaterThan(0.35);
  });

  it('advances FSM state machine deterministically and handles opt-out', () => {
    let status = advanceKolStatusFsm('SCOUTED', 'SEND_INTRO');
    expect(status).toBe('OUTREACH_INTRO_SENT');

    status = advanceKolStatusFsm(status, 'SEND_CASE_STUDY');
    expect(status).toBe('OUTREACH_CASE_STUDY_SENT');

    status = advanceKolStatusFsm(status, 'OPT_OUT');
    expect(status).toBe('UNSUBSCRIBED');
  });

  it('generates compliant RFC 8058 one-click unsubscribe header', () => {
    const header = generateCanSpamOneClickHeader('kol_4491', 'secret-key');
    expect(header).toContain('https://sophia.agencyos.network/api/optout');
    expect(header).toContain('kol_4491');
  });
});
