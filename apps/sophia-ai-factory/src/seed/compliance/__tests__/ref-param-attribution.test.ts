/**
 * Link-Parameter Attribution Fallback Tests
 *
 * Verifies the cookie-free path: when a visitor declines marketing consent no
 * `ref` cookie is written, so attribution has to resolve the partner from the
 * `ref` query parameter carried by the affiliate link instead.
 *
 * @module seed/compliance/__tests__/ref-param-attribution
 */

import { describe, it, expect } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { resolveReferrerPartner } from '@/tree/affiliates/attribution/cookie-parser';
import { decodeConsentCookie } from '@/seed/compliance/consent-resolver';
import type { AffiliatePartnerRow } from '@/seed/types/affiliate';

const PARTNER_CODE = 'SILVER_HERO';

function makePartner(overrides: Partial<AffiliatePartnerRow> = {}): AffiliatePartnerRow {
  return {
    id: 'partner_1',
    user_id: 'user_partner_1',
    partner_code: PARTNER_CODE,
    tier: 'STANDARD',
    commission_rate_pct: 20.0,
    tier2_rate_pct: 5.0,
    parent_partner_id: null,
    usdt_trc20_address_encrypted: null,
    status: 'active',
    total_earnings_cents: 0,
    pending_payout_cents: 0,
    created_at: 1,
    updated_at: 1,
    ...overrides,
  } as AffiliatePartnerRow;
}

/**
 * Minimal D1 stub covering the partner lookups `resolveReferrerPartner` performs.
 * Membership tables (referrals, orders, profiles) return nothing so the
 * link-parameter branch is isolated.
 */
function createPartnerOnlyD1(partner: AffiliatePartnerRow): D1Database {
  const d1Mock: Partial<D1Database> = {
    prepare(sql: string) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();
      let boundParams: unknown[] = [];

      const stmt = {
        bind(...params: unknown[]) {
          boundParams = params;
          return stmt;
        },
        async first<T>(): Promise<T | null> {
          if (normalizedSql.includes('FROM affiliate_partners')) {
            const idOrCode = String(boundParams[0]);
            const isIdentityMatch =
              partner.id === idOrCode ||
              partner.user_id === idOrCode ||
              partner.partner_code === idOrCode;
            // The resolver always constrains lookups to active partners; mirror
            // that here so a suspended partner must not resolve.
            const isActiveOnly = normalizedSql.includes("status = 'active'");
            if (isIdentityMatch && (!isActiveOnly || partner.status === 'active')) {
              return { ...partner } as unknown as T;
            }
            return null;
          }
          return null;
        },
        async run() {
          return { meta: { changes: 1 } };
        },
      };

      return stmt as never;
    },
    async batch(statements: unknown[]) {
      return statements as never;
    },
  };

  return d1Mock as D1Database;
}

const BASE_PARAMS = {
  provider: 'nowpayments' as const,
  paymentId: 'np_tx_1',
  orderId: null,
  customerId: 'customer_no_consent',
  grossAmountCents: 100000,
  currency: 'USDT',
};

describe('?ref= link-parameter attribution fallback', () => {
  it('resolves the partner from the ref query value when no cookie exists', async () => {
    const d1 = createPartnerOnlyD1(makePartner());

    const { partner, referral } = await resolveReferrerPartner(d1, {
      ...BASE_PARAMS,
      refParam: PARTNER_CODE,
    });

    expect(partner?.id).toBe('partner_1');
    expect(partner?.partner_code).toBe(PARTNER_CODE);
    expect(referral).toBeNull();
  });

  it('ignores blank or whitespace-only ref values so a bare link attributes nobody', async () => {
    const d1 = createPartnerOnlyD1(makePartner());

    for (const refParam of ['', '   ', undefined, null]) {
      const { partner } = await resolveReferrerPartner(d1, { ...BASE_PARAMS, refParam });
      expect(partner).toBeNull();
    }
  });

  it('trims surrounding whitespace before matching the partner code', async () => {
    const d1 = createPartnerOnlyD1(makePartner());
    const { partner } = await resolveReferrerPartner(d1, {
      ...BASE_PARAMS,
      refParam: `  ${PARTNER_CODE}\n`,
    });
    expect(partner?.id).toBe('partner_1');
  });

  it('does not attribute a suspended partner carried in the link', async () => {
    const d1 = createPartnerOnlyD1(
      makePartner({ id: 'partner_2', partner_code: 'SUSPENDED_X', status: 'suspended' }),
    );

    const { partner } = await resolveReferrerPartner(d1, { ...BASE_PARAMS, refParam: 'SUSPENDED_X' });
    expect(partner).toBeNull();
  });
});

describe('Consent cookie carrying the marketing decision', () => {
  it('carries marketing = true for a visitor who accepted all categories', () => {
    const encoded = JSON.stringify({ v: 1, a: true, m: true, u: 1700000000000 });
    expect(decodeConsentCookie(encoded)?.marketing).toBe(true);
  });

  it('carries marketing = false for a visitor who chose necessary only', () => {
    const encoded = JSON.stringify({ v: 1, a: false, m: false, u: 1700000000000 });
    const state = decodeConsentCookie(encoded);

    expect(state?.marketing).toBe(false);
    expect(state?.analytics).toBe(false);
  });

  it('reports no consent when the cookie has never been set', () => {
    expect(decodeConsentCookie(undefined)).toBeNull();
    expect(decodeConsentCookie('')).toBeNull();
  });
});
