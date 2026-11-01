/**
 * Workspace Offer Provenance Upsert — self-serve registration of a verified
 * workspace-scoped affiliate offer in `affiliate_offers`.
 *
 * Layer: tree/affiliate/offers
 * @module tree/affiliate/offers/workspace-offer-upsert
 */

import { failure, type Result } from '@/seed/types/result';
import {
  evaluateOfferRow,
  type OfferBlockReason,
  type VerifiedOffer,
} from './offer-eligibility';

export interface UpsertWorkspaceOfferInput {
  tenantId: string;
  offerId?: string;
  networkId?: string;
  externalId?: string;
  programName: string;
  productUrl: string;
  commissionTerms: string;
  niche: 'saas_global' | 'crypto_global';
  jurisdiction?: string;
}

function sanitizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

function buildDeterministicOfferId(tenantId: string, niche: string, productUrl: string): string {
  let host = 'offer';
  try {
    host = sanitizeSlug(new URL(productUrl).hostname) || 'offer';
  } catch {
    host = 'offer';
  }
  const tenantPart = sanitizeSlug(tenantId) || 'ws';
  const nichePart = niche === 'crypto_global' ? 'cex' : 'saas';
  return `off_${tenantPart}_${nichePart}_${host}`;
}

const UPSERT_OFFER_SQL = `INSERT INTO affiliate_offers
  (id, tenant_id, network_id, external_id, program_name, title, category,
   product_url, destination_url, status, commission_terms, niche, region,
   created_at, updated_at)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
 ON CONFLICT(id) DO UPDATE SET
   network_id = excluded.network_id,
   external_id = excluded.external_id,
   program_name = excluded.program_name,
   title = excluded.title,
   category = excluded.category,
   product_url = excluded.product_url,
   destination_url = excluded.destination_url,
   status = 'active',
   commission_terms = excluded.commission_terms,
   niche = excluded.niche,
   region = excluded.region,
   updated_at = excluded.updated_at
 WHERE affiliate_offers.tenant_id = excluded.tenant_id`;

export async function upsertWorkspaceVerifiedOffer(
  db: D1Database | null,
  input: UpsertWorkspaceOfferInput,
): Promise<Result<VerifiedOffer, OfferBlockReason>> {
  if (!db || !input.tenantId || input.tenantId === 'system') {
    return failure('DB_UNAVAILABLE');
  }

  const offerId = input.offerId?.trim() || buildDeterministicOfferId(input.tenantId, input.niche, input.productUrl);
  const networkId = (input.networkId ?? 'direct').trim().toLowerCase() || 'direct';
  const externalId = (input.externalId ?? offerId).trim() || offerId;
  const region = (input.jurisdiction ?? (input.niche === 'saas_global' ? 'GLOBAL' : '')).trim().toUpperCase();
  const category = input.niche === 'crypto_global' ? 'Crypto' : 'SaaS';

  const precheck = evaluateOfferRow(
    {
      id: offerId,
      tenant_id: input.tenantId,
      network_id: networkId,
      external_id: externalId,
      product_url: input.productUrl,
      destination_url: input.productUrl,
      status: 'active',
      commission_terms: input.commissionTerms,
      niche: input.niche,
      region,
    },
    { tenantId: input.tenantId, offerId, productUrl: input.productUrl, niche: input.niche, jurisdiction: region },
  );
  if (!precheck.ok) return precheck;

  try {
    const existing = await db
      .prepare(`SELECT tenant_id FROM affiliate_offers WHERE id = ? LIMIT 1`)
      .bind(offerId)
      .first<{ tenant_id?: string | null }>();
    if (existing && existing.tenant_id !== input.tenantId) {
      return failure('OFFER_TENANT_MISMATCH');
    }

    const nowMs = Date.now();
    const name = input.programName.trim();
    const url = input.productUrl.trim();
    await db
      .prepare(UPSERT_OFFER_SQL)
      .bind(offerId, input.tenantId, networkId, externalId, name, name, category, url, url, input.commissionTerms.trim(), input.niche, region, nowMs, nowMs)
      .run();

    return precheck;
  } catch {
    return failure('DB_UNAVAILABLE');
  }
}
