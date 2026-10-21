/**
 * The public commission table must agree with the values the attribution
 * resolver actually pays. It derives from the programme's shared constants, and
 * these tests pin the rendered output so a change to either constant — or a
 * regression to hardcoded copy — fails here instead of reaching customers.
 *
 * The table previously shipped as a literal array with invented tier names
 * (Starter/Growth/Premium), a flat 20%–30% range that no longer matched the
 * per-tier schedule, and no lifetime row at all.
 */

import { describe, it, expect } from 'vitest';
import { buildCommissionRows, COMMISSION_ROWS } from '../view/commission-table';
import { AFFILIATE_RATE_BY_TIER, AFFILIATE_RECURRING_MONTHS } from '@/seed/config/revenue-share';
import { UNIFIED_TIERS } from '@/seed/config/tiers';

const EXPECTED = [
  { tier: 'BASIC', price: '$199/mo', rate: '30%', perReferral: '$59.70', annualised: '$716.40/yr', recurring: true },
  { tier: 'PREMIUM', price: '$399/mo', rate: '25%', perReferral: '$99.75', annualised: '$1,197.00/yr', recurring: true },
  { tier: 'ENTERPRISE', price: '$799/mo', rate: '20%', perReferral: '$159.80', annualised: '$1,917.60/yr', recurring: true },
  { tier: 'MASTER', price: '$4,999 one-time', rate: '10%', perReferral: '$499.90', annualised: 'once', recurring: false },
] as const;

describe('buildCommissionRows', () => {
  it('renders every plan in the published order with the agreed values', () => {
    expect(buildCommissionRows()).toEqual(EXPECTED);
  });

  it('covers the whole Tier enum with no missing or invented tiers', () => {
    expect(buildCommissionRows().map((r) => r.tier)).toEqual(Object.keys(UNIFIED_TIERS));
  });

  it('takes every rate from the shared schedule rather than a local copy', () => {
    for (const row of buildCommissionRows()) {
      expect(row.rate).toBe(`${AFFILIATE_RATE_BY_TIER[row.tier]}%`);
    }
  });

  it('marks only monthly plans as recurring, so the lifetime plan cannot claim a subscription', () => {
    const rows = buildCommissionRows();
    expect(rows.filter((r) => r.recurring).map((r) => r.tier)).toEqual(['BASIC', 'PREMIUM', 'ENTERPRISE']);
    expect(rows.find((r) => r.tier === 'MASTER')?.recurring).toBe(false);
  });

  it('derives the year-one figure from the shared recurring window', () => {
    for (const row of buildCommissionRows()) {
      if (!row.recurring) continue;
      const monthlyCents = Math.round((UNIFIED_TIERS[row.tier].priceInCents * AFFILIATE_RATE_BY_TIER[row.tier]) / 100);
      const annualCents = monthlyCents * AFFILIATE_RECURRING_MONTHS;
      expect(row.annualised).toBe(
        `$${(annualCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/yr`,
      );
    }
  });

  it('renders plan prices without needless cents', () => {
    for (const row of buildCommissionRows()) {
      expect(row.price).not.toMatch(/\d\.\d{2}/);
    }
  });

  it('exposes a stable precomputed table for the component', () => {
    expect(COMMISSION_ROWS).toEqual(EXPECTED);
  });
});
