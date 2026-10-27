/**
 * Server-side offer eligibility / provenance gate.
 *
 * A campaign may only spend money on an offer whose identity, terms, link and
 * market were verified from the workspace's persisted offer row. An unknown
 * jurisdiction or unknown terms is reported as UNKNOWN and blocks the action —
 * it is never silently defaulted to "US"/"GLOBAL" or to a fabricated bonus.
 *
 * Layer: tree/affiliate/offers
 * @module tree/affiliate/offers/offer-eligibility
 */

import { success, failure, type Result } from '@/seed/types/result';

export type OfferBlockReason =
  | 'OFFER_NOT_FOUND'
  | 'OFFER_TENANT_MISMATCH'
  | 'OFFER_INACTIVE'
  | 'OFFER_TERMS_UNKNOWN'
  | 'OFFER_LINK_MISMATCH'
  | 'OFFER_PROVENANCE_MISSING'
  | 'JURISDICTION_UNKNOWN'
  | 'DB_UNAVAILABLE';

export interface VerifiedOffer {
  offerId: string;
  tenantId: string;
  network: string;
  externalId: string;
  productUrl: string;
  commissionTerms: string;
  market: string | null;
  niche: string | null;
}

interface OfferRow {
  id: string;
  tenant_id?: string | null;
  network_id?: string | null;
  external_id?: string | null;
  product_url?: string | null;
  destination_url?: string | null;
  status?: string | null;
  commission_terms?: string | null;
  niche?: string | null;
  region?: string | null;
  language?: string | null;
}

export interface OfferEligibilityInput {
  tenantId: string;
  offerId: string;
  productUrl: string;
  /** Required for crypto; an unassessed market must not be inferred. */
  niche: 'saas_global' | 'crypto_global';
  jurisdiction?: string;
}

const PLACEHOLDER_TERMS = new Set(['', 'unknown', 'n/a', 'na', 'todo', 'tbd', 'null']);

function normalizeHost(raw: string): string {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** Pure helper so eligibility math can be unit-tested without a database. */
export function evaluateOfferRow(
  row: OfferRow | null,
  input: OfferEligibilityInput,
): Result<VerifiedOffer, OfferBlockReason> {
  if (!row) return failure('OFFER_NOT_FOUND');
  // A row with no tenant provenance is NOT a global offer. Only the explicit
  // `system` catalog (seeded by migration 0452) is shared across workspaces.
  if (row.tenant_id !== 'system' && row.tenant_id !== input.tenantId) {
    return failure('OFFER_TENANT_MISMATCH');
  }
  if (!row.network_id || !row.external_id) return failure('OFFER_PROVENANCE_MISSING');
  if (row.status != null && row.status.toLowerCase() !== 'active') return failure('OFFER_INACTIVE');

  const terms = (row.commission_terms ?? '').trim();
  if (PLACEHOLDER_TERMS.has(terms.toLowerCase())) return failure('OFFER_TERMS_UNKNOWN');

  const storedUrl = row.product_url || row.destination_url || '';
  if (!storedUrl || normalizeHost(storedUrl) !== normalizeHost(input.productUrl)) {
    return failure('OFFER_LINK_MISMATCH');
  }

  if (input.niche === 'crypto_global') {
    const market = (row.region ?? input.jurisdiction ?? '').trim().toUpperCase();
    if (!market || market === 'GLOBAL' || market === 'UNKNOWN') {
      return failure('JURISDICTION_UNKNOWN');
    }
  }

  return success({
    offerId: row.id,
    tenantId: input.tenantId,
    network: row.network_id,
    externalId: row.external_id,
    productUrl: storedUrl,
    commissionTerms: terms,
    market: row.region ?? input.jurisdiction ?? null,
    niche: row.niche ?? null,
  });
}

export async function verifyOfferEligibility(
  db: D1Database | null,
  input: OfferEligibilityInput,
): Promise<Result<VerifiedOffer, OfferBlockReason>> {
  if (!db || !input.tenantId || !input.offerId) return failure('DB_UNAVAILABLE');
  try {
    const row = await db
      .prepare(
        `SELECT id, tenant_id, network_id, external_id, product_url, destination_url,
                status, commission_terms, niche, region, language
         FROM affiliate_offers WHERE id = ? LIMIT 1`,
      )
      .bind(input.offerId)
      .first<OfferRow>();
    return evaluateOfferRow(row, input);
  } catch {
    return failure('DB_UNAVAILABLE');
  }
}
