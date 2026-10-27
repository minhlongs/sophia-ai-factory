/**
 * Scenario 2 + 5: verified CEX/SaaS offer vs unknown jurisdiction/terms,
 * and tenant isolation at the offer DB boundary.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import { evaluateOfferRow, verifyOfferEligibility, type OfferEligibilityInput } from '../offer-eligibility';

const MIGRATION_0482 = readFileSync(
  resolve(process.cwd(), 'migrations/0482_opc_affiliate_execution_truth.sql'),
  'utf8',
);

const OFFERS_SCHEMA = `
CREATE TABLE affiliate_offers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  network_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  product_url TEXT NOT NULL,
  destination_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  commission_terms TEXT,
  niche TEXT,
  region TEXT,
  language TEXT
);`;

function makeDb(offers: Array<Record<string, string | null>>) {
  const fake = createFakeD1([OFFERS_SCHEMA, MIGRATION_0482]);
  for (const offer of offers) {
    fake._db
      .prepare(
        `INSERT INTO affiliate_offers
          (id, tenant_id, network_id, external_id, product_url, destination_url, status, commission_terms, niche, region, language)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        offer.id,
        offer.tenant_id,
        offer.network_id,
        offer.external_id,
        offer.product_url,
        offer.destination_url ?? null,
        offer.status ?? 'active',
        offer.commission_terms ?? null,
        offer.niche ?? null,
        offer.region ?? null,
        offer.language ?? null,
      );
  }
  return fake as unknown as D1Database;
}

const baseOffer = {
  id: 'offer_1',
  tenant_id: 'ws_a',
  network_id: 'partnerstack',
  external_id: 'ps_123',
  product_url: 'https://vendor.example/signup',
  commission_terms: 'RevShare 20% recurring, 30-day cookie',
  region: 'US',
  niche: 'saas_global',
};

const input: OfferEligibilityInput = {
  tenantId: 'ws_a',
  offerId: 'offer_1',
  productUrl: 'https://vendor.example/signup',
  niche: 'saas_global',
  jurisdiction: 'US',
};

describe('offer eligibility (facts + jurisdiction provenance)', () => {
  it('accepts a verified SaaS offer with sourced commission terms', async () => {
    const result = await verifyOfferEligibility(makeDb([baseOffer]), input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.network).toBe('partnerstack');
      expect(result.value.commissionTerms).toContain('RevShare');
    }
  });

  it('accepts a CEX offer whose market is explicitly known', async () => {
    const result = await verifyOfferEligibility(makeDb([baseOffer]), {
      ...input,
      niche: 'crypto_global',
      jurisdiction: 'US',
    });
    expect(result.ok).toBe(true);
  });

  it('blocks a CEX offer with unknown/GLOBAL jurisdiction', async () => {
    const unknown = await verifyOfferEligibility(
      makeDb([{ ...baseOffer, region: 'GLOBAL' }]),
      { ...input, niche: 'crypto_global', jurisdiction: undefined },
    );
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error).toBe('JURISDICTION_UNKNOWN');
  });

  it('blocks unknown / placeholder commission terms', async () => {
    for (const terms of [null, '', 'unknown', 'TBD']) {
      const res = evaluateOfferRow(
        { ...baseOffer, commission_terms: terms },
        input,
      );
      expect(res.ok, String(terms)).toBe(false);
      if (!res.ok) expect(res.error).toBe('OFFER_TERMS_UNKNOWN');
    }
  });

  it('blocks a link that does not match the persisted offer', () => {
    const res = evaluateOfferRow(baseOffer, { ...input, productUrl: 'https://evil.example/ref' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('OFFER_LINK_MISMATCH');
  });

  it('blocks missing provider provenance and inactive offers', () => {
    const noNetwork = evaluateOfferRow({ ...baseOffer, network_id: '' }, input);
    expect(noNetwork.ok).toBe(false);
    if (!noNetwork.ok) expect(noNetwork.error).toBe('OFFER_PROVENANCE_MISSING');

    const inactive = evaluateOfferRow({ ...baseOffer, status: 'paused' }, input);
    expect(inactive.ok).toBe(false);
    if (!inactive.ok) expect(inactive.error).toBe('OFFER_INACTIVE');
  });

  it('isolates tenant A offer from tenant B even with a known id', async () => {
    const db = makeDb([baseOffer]);
    const res = await verifyOfferEligibility(db, { ...input, tenantId: 'ws_b' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('OFFER_TENANT_MISMATCH');
  });

  it('never verifies when no offer id or no database is available', async () => {
    const none = await verifyOfferEligibility(makeDb([baseOffer]), { ...input, offerId: '' });
    expect(none.ok).toBe(false);
    const noDb = await verifyOfferEligibility(null, input);
    expect(noDb.ok).toBe(false);
  });
});
