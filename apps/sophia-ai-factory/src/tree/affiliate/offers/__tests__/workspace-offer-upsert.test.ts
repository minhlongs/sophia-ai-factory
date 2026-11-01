/**
 * Workspace Offer Provenance Upsert tests (S-01).
 *
 * Verifies self-serve registration of workspace-scoped verified CEX & SaaS
 * offers in `affiliate_offers`, fail-closed validation, and cross-tenant isolation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import { verifyOfferEligibility } from '../offer-eligibility';
import { buildWorkspaceOfferId, upsertWorkspaceVerifiedOffer } from '../workspace-offer-upsert';

const SCHEMA = [
  `CREATE TABLE affiliate_offers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'system',
    network_id TEXT NOT NULL DEFAULT 'direct',
    external_id TEXT,
    program_name TEXT,
    title TEXT,
    category TEXT,
    product_url TEXT,
    destination_url TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    commission_terms TEXT,
    niche TEXT,
    region TEXT,
    language TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
];

describe('upsertWorkspaceVerifiedOffer', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createFakeD1(SCHEMA) as unknown as D1Database;
  });

  it('upserts a verified crypto CEX offer and passes verifyOfferEligibility', async () => {
    const res = await upsertWorkspaceVerifiedOffer(db, {
      tenantId: 'ws_ceo_1',
      programName: 'Binance Global',
      productUrl: 'https://accounts.binance.com/register',
      commissionTerms: '20% Spot & Futures Fee Rebate Share (Non-Custodial)',
      niche: 'crypto_global',
      jurisdiction: 'US',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.offerId).toBe(
      buildWorkspaceOfferId('ws_ceo_1', 'crypto_global', 'https://accounts.binance.com/register'),
    );

    const check = await verifyOfferEligibility(db, {
      tenantId: 'ws_ceo_1',
      offerId: res.value.offerId,
      productUrl: 'https://accounts.binance.com/register?ref=123',
      niche: 'crypto_global',
      jurisdiction: 'US',
    });
    expect(check.ok).toBe(true);
  });

  it('rejects crypto CEX offer with GLOBAL/unknown or banned (VN/SG) jurisdiction and non-http(s) URLs', async () => {
    const globalRes = await upsertWorkspaceVerifiedOffer(db, {
      tenantId: 'ws_ceo_1',
      programName: 'Bybit Global',
      productUrl: 'https://bybit.com/register',
      commissionTerms: '20% Fee Rebate',
      niche: 'crypto_global',
      jurisdiction: 'GLOBAL',
    });
    expect(globalRes.ok).toBe(false);
    if (!globalRes.ok) expect(globalRes.error).toBe('JURISDICTION_UNKNOWN');

    const vnRes = await upsertWorkspaceVerifiedOffer(db, {
      tenantId: 'ws_ceo_1',
      programName: 'Bybit VN',
      productUrl: 'https://bybit.com/register',
      commissionTerms: '20% Fee Rebate',
      niche: 'crypto_global',
      jurisdiction: 'VN',
    });
    expect(vnRes.ok).toBe(false);
    if (!vnRes.ok) expect(vnRes.error).toBe('JURISDICTION_UNKNOWN');

    const badProtocol = await upsertWorkspaceVerifiedOffer(db, {
      tenantId: 'ws_ceo_1',
      programName: 'Bad Scheme',
      productUrl: 'javascript:alert(1)',
      commissionTerms: '20% Fee Rebate',
      niche: 'saas_global',
    });
    expect(badProtocol.ok).toBe(false);
    if (!badProtocol.ok) expect(badProtocol.error).toBe('OFFER_LINK_MISMATCH');
  });

  it('rejects placeholder commission terms and isolates tenant namespaces without collision', async () => {
    const badTerms = await upsertWorkspaceVerifiedOffer(db, {
      tenantId: 'ws_ceo_1',
      programName: 'Linear App',
      productUrl: 'https://linear.app',
      commissionTerms: 'TBD',
      niche: 'saas_global',
    });
    expect(badTerms.ok).toBe(false);
    if (!badTerms.ok) expect(badTerms.error).toBe('OFFER_TERMS_UNKNOWN');

    const first = await upsertWorkspaceVerifiedOffer(db, {
      tenantId: 'ws_ceo_1',
      offerId: 'custom_offer_1',
      programName: 'Linear App',
      productUrl: 'https://linear.app',
      commissionTerms: '30% Recurring MRR for 12 months',
      niche: 'saas_global',
    });
    expect(first.ok).toBe(true);

    const secondTenant = await upsertWorkspaceVerifiedOffer(db, {
      tenantId: 'ws_ceo_2',
      offerId: 'custom_offer_1',
      programName: 'Other Tenant App',
      productUrl: 'https://linear.app',
      commissionTerms: '40% Recurring MRR',
      niche: 'saas_global',
    });
    expect(secondTenant.ok).toBe(true);
    if (first.ok && secondTenant.ok) {
      expect(first.value.offerId).not.toBe(secondTenant.value.offerId);
    }
  });
});
