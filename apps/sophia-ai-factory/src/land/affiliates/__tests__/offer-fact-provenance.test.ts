/**
 * A01: EPC derived from commission is a FORECAST and must not be consumed or
 * displayed as a measured earnings-per-click.
 */
import { describe, it, expect } from 'vitest';
import { toAffiliate } from '../discovery-wave-helpers';
import { scoreEpc } from '../scout/scoring/epc-calculator';
import { runAgenticDiscoveryWave } from '../discovery-wave';
import type { AffiliateOffer } from '../provider-interface';

const offer: AffiliateOffer = {
  externalId: 'ps_9',
  title: 'Verified SaaS partner',
  description: 'Recurring SaaS affiliate program',
  productUrl: 'https://vendor.example/signup',
  imageUrl: '',
  commissionPct: 40,
  commissionFixedUsd: null,
  niche: 'saas',
  language: 'en',
  region: 'US',
  isTrending: false,
};

describe('EPC provenance', () => {
  it('tags a commission-derived EPC as an estimate with an explicit unit/source', () => {
    const aff = toAffiliate(offer, 'partnerstack', 'ws_a', '2026-10-27T00:00:00.000Z');
    expect(aff.epcProvenance).toBe('commission_derived_estimate');
    expect(aff.epcUnit).toBe('usd_per_click_estimate');
    expect(aff.epcSource).toContain('commission-heuristic');
  });

  it('scores an estimate neutrally while measured EPC still affects the score', () => {
    const estimate = toAffiliate(offer, 'partnerstack', 'ws_a', '2026-10-27T00:00:00.000Z');
    expect(scoreEpc(estimate)).toBe(0.5);
    expect(scoreEpc({ ...estimate, epcProvenance: 'measured', epc: 0 })).toBe(0);
    expect(scoreEpc({ ...estimate, epcProvenance: 'measured', epc: 10 })).toBe(1);
  });

  it('exposes the provenance on ranked offers so the UI can label it', async () => {
    const res = await runAgenticDiscoveryWave({ niche: 'saas', minScore: 0.1, limit: 5 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.topOffers.length).toBeGreaterThan(0);
    for (const ranked of res.value.topOffers) {
      expect(ranked.epcProvenance).toBe('commission_derived_estimate');
    }
  });
});
