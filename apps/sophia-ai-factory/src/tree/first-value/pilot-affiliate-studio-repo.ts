/**
 * D1 Repository for Pilot Affiliate Campaign Studio (`pilot_affiliate_offers`,
 * `pilot_affiliate_campaigns`, `pilot_affiliate_performance_entries`, and
 * Domain B `workspace_external_commissions` ledger sync).
 *
 * Layer: tree/first-value (imports seed + tree only)
 * @module tree/first-value/pilot-affiliate-studio-repo
 */

import type { D1Database } from '@cloudflare/workers-types';
import { verifyWorkspaceRole } from '@/seed/auth/workspace-access';
import type {
  AffiliateCampaignPack,
  AffiliateStudioVertical,
} from '@/seed/ai/affiliate-campaign-prompt';

export interface PilotAffiliateOfferRecord {
  readonly id: string;
  readonly orgId: string;
  readonly userId: string;
  readonly vertical: AffiliateStudioVertical;
  readonly productName: string;
  readonly officialWebsiteUrl: string;
  readonly referralUrl: string;
  readonly commissionTerms: string;
  readonly targetAudience: string;
  readonly targetMarket: string;
  readonly productInfoSource: string;
  readonly status: 'active' | 'archived';
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
}

export interface PilotAffiliateCampaignRecord {
  readonly id: string;
  readonly orgId: string;
  readonly userId: string;
  readonly offerId: string;
  readonly idempotencyKey: string;
  readonly payloadHash: string;
  readonly vertical: AffiliateStudioVertical;
  readonly campaignName: string;
  readonly referralUrl: string;
  readonly targetMarket: string;
  readonly provenance: 'fixture_simulated' | 'live_provider';
  readonly provenanceLabel: string;
  readonly reviewState: 'pending_review' | 'approved' | 'rejected';
  readonly version: number;
  readonly pack: AffiliateCampaignPack;
  readonly estimatedAiCostMicroUsd: number;
  readonly approvedAtIso: string | null;
  readonly approvedByUserId: string | null;
  readonly rejectedAtIso: string | null;
  readonly rejectionReason: string | null;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
}

export interface PilotAffiliatePerformanceEntry {
  readonly id: string;
  readonly orgId: string;
  readonly userId: string;
  readonly campaignId: string;
  readonly offerId: string;
  readonly reportSource: string;
  readonly reportPeriod: string;
  readonly externalRefId: string;
  readonly clicksCount: number | null;
  readonly signupsCount: number;
  readonly qualifiedConversions: number;
  readonly pendingCommissionCents: number;
  readonly confirmedCommissionCents: number;
  readonly currency: string;
  readonly notes: string | null;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
}

interface OfferDbRow {
  id: string;
  org_id: string;
  user_id: string;
  vertical: AffiliateStudioVertical;
  product_name: string;
  official_website_url: string;
  referral_url: string;
  commission_terms: string;
  target_audience: string;
  target_market: string;
  product_info_source: string;
  status: 'active' | 'archived';
  created_at_iso: string;
  updated_at_iso: string;
}

interface CampaignDbRow {
  id: string;
  org_id: string;
  user_id: string;
  offer_id: string;
  idempotency_key: string;
  payload_hash: string;
  vertical: AffiliateStudioVertical;
  campaign_name: string;
  referral_url: string;
  target_market: string;
  provenance: 'fixture_simulated' | 'live_provider';
  provenance_label: string;
  review_state: 'pending_review' | 'approved' | 'rejected';
  version: number;
  campaign_pack_json: string;
  estimated_ai_cost_microusd: number;
  approved_at_iso: string | null;
  approved_by_user_id: string | null;
  rejected_at_iso: string | null;
  rejection_reason: string | null;
  created_at_iso: string;
  updated_at_iso: string;
}

interface PerfDbRow {
  id: string;
  org_id: string;
  user_id: string;
  campaign_id: string;
  offer_id: string;
  report_source: string;
  report_period: string;
  external_ref_id: string;
  clicks_count: number | null;
  signups_count: number;
  qualified_conversions: number;
  pending_commission_cents: number;
  confirmed_commission_cents: number;
  currency: string;
  notes: string | null;
  created_at_iso: string;
  updated_at_iso: string;
}

function mapOfferRow(r: OfferDbRow): PilotAffiliateOfferRecord {
  return {
    id: r.id,
    orgId: r.org_id,
    userId: r.user_id,
    vertical: r.vertical,
    productName: r.product_name,
    officialWebsiteUrl: r.official_website_url,
    referralUrl: r.referral_url,
    commissionTerms: r.commission_terms,
    targetAudience: r.target_audience,
    targetMarket: r.target_market,
    productInfoSource: r.product_info_source,
    status: r.status,
    createdAtIso: r.created_at_iso,
    updatedAtIso: r.updated_at_iso,
  };
}

function mapCampaignRow(r: CampaignDbRow): PilotAffiliateCampaignRecord {
  return {
    id: r.id,
    orgId: r.org_id,
    userId: r.user_id,
    offerId: r.offer_id,
    idempotencyKey: r.idempotency_key,
    payloadHash: r.payload_hash,
    vertical: r.vertical,
    campaignName: r.campaign_name,
    referralUrl: r.referral_url,
    targetMarket: r.target_market,
    provenance: r.provenance,
    provenanceLabel: r.provenance_label,
    reviewState: r.review_state,
    version: Number(r.version),
    pack: JSON.parse(r.campaign_pack_json) as AffiliateCampaignPack,
    estimatedAiCostMicroUsd: Number(r.estimated_ai_cost_microusd ?? 0),
    approvedAtIso: r.approved_at_iso,
    approvedByUserId: r.approved_by_user_id,
    rejectedAtIso: r.rejected_at_iso,
    rejectionReason: r.rejection_reason,
    createdAtIso: r.created_at_iso,
    updatedAtIso: r.updated_at_iso,
  };
}

function mapPerfRow(r: PerfDbRow): PilotAffiliatePerformanceEntry {
  return {
    id: r.id,
    orgId: r.org_id,
    userId: r.user_id,
    campaignId: r.campaign_id,
    offerId: r.offer_id,
    reportSource: r.report_source,
    reportPeriod: r.report_period,
    externalRefId: r.external_ref_id,
    clicksCount: r.clicks_count === null || r.clicks_count === undefined ? null : Number(r.clicks_count),
    signupsCount: Number(r.signups_count ?? 0),
    qualifiedConversions: Number(r.qualified_conversions ?? 0),
    pendingCommissionCents: Number(r.pending_commission_cents ?? 0),
    confirmedCommissionCents: Number(r.confirmed_commission_cents ?? 0),
    currency: r.currency || 'USD',
    notes: r.notes,
    createdAtIso: r.created_at_iso,
    updatedAtIso: r.updated_at_iso,
  };
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function insertPilotAffiliateOffer(
  d1: D1Database,
  input: Omit<PilotAffiliateOfferRecord, 'status' | 'updatedAtIso'>,
): Promise<PilotAffiliateOfferRecord> {
  await d1
    .prepare(
      `INSERT INTO pilot_affiliate_offers
       (id, org_id, user_id, vertical, product_name, official_website_url, referral_url,
        commission_terms, target_audience, target_market, product_info_source, status,
        created_at_iso, updated_at_iso)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    )
    .bind(
      input.id,
      input.orgId,
      input.userId,
      input.vertical,
      input.productName,
      input.officialWebsiteUrl,
      input.referralUrl,
      input.commissionTerms,
      input.targetAudience,
      input.targetMarket,
      input.productInfoSource,
      input.createdAtIso,
      input.createdAtIso,
    )
    .run();

  return { ...input, status: 'active', updatedAtIso: input.createdAtIso };
}

export async function getPilotAffiliateOfferById(
  d1: D1Database,
  args: { readonly offerId: string; readonly orgId: string; readonly userId: string },
): Promise<PilotAffiliateOfferRecord | null> {
  const row = await d1
    .prepare(
      `SELECT * FROM pilot_affiliate_offers
       WHERE id = ? AND org_id = ? AND user_id = ? AND status = 'active' LIMIT 1`,
    )
    .bind(args.offerId, args.orgId, args.userId)
    .first<OfferDbRow>();
  return row ? mapOfferRow(row) : null;
}

export async function listPilotAffiliateOffers(
  d1: D1Database,
  args: { readonly orgId: string; readonly userId: string; readonly limit?: number },
): Promise<readonly PilotAffiliateOfferRecord[]> {
  const res = await d1
    .prepare(
      `SELECT * FROM pilot_affiliate_offers
       WHERE org_id = ? AND user_id = ? AND status = 'active'
       ORDER BY created_at_iso DESC LIMIT ?`,
    )
    .bind(args.orgId, args.userId, args.limit ?? 25)
    .all<OfferDbRow>();
  return (res.results ?? []).map(mapOfferRow);
}

export async function archivePilotAffiliateOffer(
  d1: D1Database,
  args: { readonly offerId: string; readonly orgId: string; readonly userId: string; readonly nowIso: string },
): Promise<boolean> {
  const res = await d1
    .prepare(
      `UPDATE pilot_affiliate_offers SET status = 'archived', updated_at_iso = ?
       WHERE id = ? AND org_id = ? AND user_id = ? AND status = 'active'`,
    )
    .bind(args.nowIso, args.offerId, args.orgId, args.userId)
    .run();
  return Number(res.meta?.changes ?? 0) > 0;
}

export async function findPilotCampaignByIdempotency(
  d1: D1Database,
  args: { readonly orgId: string; readonly userId: string; readonly idempotencyKey: string },
): Promise<PilotAffiliateCampaignRecord | null> {
  const row = await d1
    .prepare(
      `SELECT * FROM pilot_affiliate_campaigns
       WHERE org_id = ? AND user_id = ? AND idempotency_key = ? LIMIT 1`,
    )
    .bind(args.orgId, args.userId, args.idempotencyKey)
    .first<CampaignDbRow>();
  return row ? mapCampaignRow(row) : null;
}

export async function getPilotAffiliateCampaignById(
  d1: D1Database,
  args: { readonly campaignId: string; readonly orgId: string; readonly userId: string },
): Promise<PilotAffiliateCampaignRecord | null> {
  const row = await d1
    .prepare(
      `SELECT * FROM pilot_affiliate_campaigns WHERE id = ? AND org_id = ? AND user_id = ? LIMIT 1`,
    )
    .bind(args.campaignId, args.orgId, args.userId)
    .first<CampaignDbRow>();
  return row ? mapCampaignRow(row) : null;
}

export async function listPilotAffiliateCampaigns(
  d1: D1Database,
  args: { readonly orgId: string; readonly userId: string; readonly limit?: number },
): Promise<readonly PilotAffiliateCampaignRecord[]> {
  const res = await d1
    .prepare(
      `SELECT * FROM pilot_affiliate_campaigns
       WHERE org_id = ? AND user_id = ?
       ORDER BY created_at_iso DESC LIMIT ?`,
    )
    .bind(args.orgId, args.userId, args.limit ?? 25)
    .all<CampaignDbRow>();
  return (res.results ?? []).map(mapCampaignRow);
}

export async function insertPilotAffiliateCampaign(
  d1: D1Database,
  input: {
    readonly id: string;
    readonly orgId: string;
    readonly userId: string;
    readonly offerId: string;
    readonly idempotencyKey: string;
    readonly payloadHash: string;
    readonly vertical: AffiliateStudioVertical;
    readonly campaignName: string;
    readonly referralUrl: string;
    readonly targetMarket: string;
    readonly provenance: 'fixture_simulated' | 'live_provider';
    readonly provenanceLabel: string;
    readonly pack: AffiliateCampaignPack;
    readonly estimatedAiCostMicroUsd: number;
    readonly nowIso: string;
  },
): Promise<
  | { readonly outcome: 'created'; readonly record: PilotAffiliateCampaignRecord }
  | { readonly outcome: 'replayed'; readonly record: PilotAffiliateCampaignRecord }
  | { readonly outcome: 'conflict'; readonly existingId: string }
> {
  const res = await d1
    .prepare(
      `INSERT INTO pilot_affiliate_campaigns
       (id, org_id, user_id, offer_id, idempotency_key, payload_hash, vertical, campaign_name,
        referral_url, target_market, provenance, provenance_label, review_state, version,
        campaign_pack_json, estimated_ai_cost_microusd, created_at_iso, updated_at_iso)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', 1, ?, ?, ?, ?)
       ON CONFLICT (org_id, user_id, idempotency_key) DO NOTHING`,
    )
    .bind(
      input.id,
      input.orgId,
      input.userId,
      input.offerId,
      input.idempotencyKey,
      input.payloadHash,
      input.vertical,
      input.campaignName,
      input.referralUrl,
      input.targetMarket,
      input.provenance,
      input.provenanceLabel,
      JSON.stringify(input.pack),
      input.estimatedAiCostMicroUsd,
      input.nowIso,
      input.nowIso,
    )
    .run();

  if (Number(res.meta?.changes ?? 0) > 0) {
    const created = await getPilotAffiliateCampaignById(d1, {
      campaignId: input.id,
      orgId: input.orgId,
      userId: input.userId,
    });
    if (!created) throw new Error('Failed to load created affiliate campaign');
    return { outcome: 'created', record: created };
  }

  const existing = await findPilotCampaignByIdempotency(d1, {
    orgId: input.orgId,
    userId: input.userId,
    idempotencyKey: input.idempotencyKey,
  });
  if (!existing) throw new Error('Idempotent campaign row missing');
  if (existing.payloadHash !== input.payloadHash) {
    return { outcome: 'conflict', existingId: existing.id };
  }
  return { outcome: 'replayed', record: existing };
}

export async function updatePilotAffiliateCampaignPack(
  d1: D1Database,
  args: {
    readonly campaignId: string;
    readonly orgId: string;
    readonly userId: string;
    readonly expectedVersion: number;
    readonly pack: AffiliateCampaignPack;
    readonly nowIso: string;
  },
): Promise<
  | { readonly outcome: 'updated'; readonly record: PilotAffiliateCampaignRecord }
  | { readonly outcome: 'not_found' }
  | { readonly outcome: 'stale_version'; readonly currentVersion: number }
  | { readonly outcome: 'already_finalized'; readonly record: PilotAffiliateCampaignRecord }
> {
  const existing = await getPilotAffiliateCampaignById(d1, {
    campaignId: args.campaignId,
    orgId: args.orgId,
    userId: args.userId,
  });
  if (!existing) return { outcome: 'not_found' };
  if (existing.reviewState !== 'pending_review') {
    return { outcome: 'already_finalized', record: existing };
  }
  if (existing.version !== args.expectedVersion) {
    return { outcome: 'stale_version', currentVersion: existing.version };
  }

  const res = await d1
    .prepare(
      `UPDATE pilot_affiliate_campaigns
       SET campaign_name = ?, campaign_pack_json = ?, version = version + 1, updated_at_iso = ?
       WHERE id = ? AND org_id = ? AND user_id = ? AND version = ? AND review_state = 'pending_review'`,
    )
    .bind(
      args.pack.campaignTitle,
      JSON.stringify(args.pack),
      args.nowIso,
      args.campaignId,
      args.orgId,
      args.userId,
      args.expectedVersion,
    )
    .run();

  if (Number(res.meta?.changes ?? 0) === 0) {
    const fresh = await getPilotAffiliateCampaignById(d1, {
      campaignId: args.campaignId,
      orgId: args.orgId,
      userId: args.userId,
    });
    return { outcome: 'stale_version', currentVersion: fresh?.version ?? existing.version };
  }

  const updated = await getPilotAffiliateCampaignById(d1, {
    campaignId: args.campaignId,
    orgId: args.orgId,
    userId: args.userId,
  });
  if (!updated) return { outcome: 'not_found' };
  return { outcome: 'updated', record: updated };
}

export async function approvePilotAffiliateCampaign(
  d1: D1Database,
  args: {
    readonly campaignId: string;
    readonly orgId: string;
    readonly userId: string;
    readonly expectedVersion: number;
    readonly nowIso: string;
  },
): Promise<
  | { readonly outcome: 'approved' | 'already_approved'; readonly record: PilotAffiliateCampaignRecord }
  | { readonly outcome: 'already_finalized'; readonly record: PilotAffiliateCampaignRecord }
  | { readonly outcome: 'not_found' }
  | { readonly outcome: 'stale_version'; readonly currentVersion: number }
> {
  const existing = await getPilotAffiliateCampaignById(d1, {
    campaignId: args.campaignId,
    orgId: args.orgId,
    userId: args.userId,
  });
  if (!existing) return { outcome: 'not_found' };
  if (existing.reviewState === 'approved') {
    return { outcome: 'already_approved', record: existing };
  }
  if (existing.reviewState !== 'pending_review') {
    return { outcome: 'already_finalized', record: existing };
  }
  if (existing.version !== args.expectedVersion) {
    return { outcome: 'stale_version', currentVersion: existing.version };
  }

  const res = await d1
    .prepare(
      `UPDATE pilot_affiliate_campaigns
       SET review_state = 'approved', approved_at_iso = ?, approved_by_user_id = ?,
           version = version + 1, updated_at_iso = ?
       WHERE id = ? AND org_id = ? AND user_id = ? AND version = ? AND review_state = 'pending_review'`,
    )
    .bind(
      args.nowIso,
      args.userId,
      args.nowIso,
      args.campaignId,
      args.orgId,
      args.userId,
      args.expectedVersion,
    )
    .run();

  if (Number(res.meta?.changes ?? 0) === 0) {
    const fresh = await getPilotAffiliateCampaignById(d1, {
      campaignId: args.campaignId,
      orgId: args.orgId,
      userId: args.userId,
    });
    if (fresh?.reviewState === 'approved') {
      return { outcome: 'already_approved', record: fresh };
    }
    return { outcome: 'stale_version', currentVersion: fresh?.version ?? existing.version };
  }

  const updated = await getPilotAffiliateCampaignById(d1, {
    campaignId: args.campaignId,
    orgId: args.orgId,
    userId: args.userId,
  });
  if (!updated) return { outcome: 'not_found' };
  return { outcome: 'approved', record: updated };
}

export class AmbiguousLegacyCommissionOwnershipError extends Error {
  readonly code = 'AMBIGUOUS_LEGACY_COMMISSION_OWNERSHIP' as const;
  readonly orgId: string;
  readonly externalRefId: string;

  constructor(orgId: string, externalRefId: string) {
    super(
      `Ambiguous legacy commission ownership for org=${orgId} external_ref_id=${externalRefId}; refusing to infer owner or create duplicate credit.`,
    );
    this.name = 'AmbiguousLegacyCommissionOwnershipError';
    this.orgId = orgId;
    this.externalRefId = externalRefId;
  }
}

interface LegacyCommissionRow {
  id: string;
  campaign_id: string | null;
  external_tx_id: string;
  commission_cents: number;
  status: string;
  raw_payload: string | null;
}

async function resolveLegacyCommissionOwnership(
  d1: D1Database,
  args: {
    readonly orgId: string;
    readonly userId: string;
    readonly campaignId: string;
    readonly externalRefId: string;
    readonly legacyTxId: string;
    readonly status: 'pending' | 'approved' | 'reversed';
  },
): Promise<'none' | 'owned_by_caller' | 'owned_by_other_user'> {
  const legacyRow = await d1
    .prepare(
      `SELECT id, campaign_id, external_tx_id, commission_cents, status, raw_payload
       FROM workspace_external_commissions
       WHERE tenant_id = ? AND network = 'customer_partner_report'
         AND external_tx_id = ? AND status = ?
       LIMIT 1`,
    )
    .bind(args.orgId, args.legacyTxId, args.status)
    .first<LegacyCommissionRow>();

  if (!legacyRow) return 'none';

  // 1. Check campaign ownership in pilot_affiliate_campaigns (authoritative)
  if (legacyRow.campaign_id) {
    const camp = await d1
      .prepare(`SELECT user_id FROM pilot_affiliate_campaigns WHERE id = ? AND org_id = ? LIMIT 1`)
      .bind(legacyRow.campaign_id, args.orgId)
      .first<{ user_id: string }>();

    if (camp) {
      return camp.user_id === args.userId ? 'owned_by_caller' : 'owned_by_other_user';
    }
  }

  // 2. Fallback: check unambiguous owner in pilot_affiliate_performance_entries
  const perfOwners = await d1
    .prepare(
      `SELECT DISTINCT user_id FROM pilot_affiliate_performance_entries
       WHERE org_id = ? AND external_ref_id = ?`,
    )
    .bind(args.orgId, args.externalRefId)
    .all<{ user_id: string }>();
  const distinctOwners = (perfOwners.results ?? []).map((r) => r.user_id);
  if (distinctOwners.length === 1) {
    return distinctOwners[0] === args.userId ? 'owned_by_caller' : 'owned_by_other_user';
  }

  // 3. Ambiguous legacy row (no verifiable single owner) -> fail closed!
  throw new AmbiguousLegacyCommissionOwnershipError(args.orgId, args.externalRefId);
}

export async function recordPartnerPerformanceReport(
  d1: D1Database,
  input: {
    readonly id: string;
    readonly orgId: string;
    readonly userId: string;
    readonly campaignId: string;
    readonly offerId: string;
    readonly vertical: AffiliateStudioVertical;
    readonly reportSource: string;
    readonly reportPeriod: string;
    readonly externalRefId: string;
    readonly clicksCount: number | null;
    readonly signupsCount: number;
    readonly qualifiedConversions: number;
    readonly pendingCommissionCents: number;
    readonly confirmedCommissionCents: number;
    readonly currency: string;
    readonly notes: string | null;
    readonly nowIso: string;
    readonly nowMs: number;
    readonly eventKind?: 'report' | 'reversal' | 'correction';
  },
): Promise<{ readonly entry: PilotAffiliatePerformanceEntry; readonly duplicate: boolean }> {
  const currency = (input.currency || 'USD').trim().toUpperCase();
  const eventKind = input.eventKind ?? 'report';
  const niche = input.vertical === 'crypto' ? 'crypto_global' : 'saas_global';
  const rawMeta = JSON.stringify({
    provenance: 'customer_reported_partner_statement',
    reportSource: input.reportSource,
    reportPeriod: input.reportPeriod,
    userId: input.userId,
    eventKind,
  });

  // Fail-closed pre-check for legacy unprefixed rows before any ledger mutation
  const pendingLegacyOwnership =
    input.pendingCommissionCents > 0
      ? await resolveLegacyCommissionOwnership(d1, {
          orgId: input.orgId,
          userId: input.userId,
          campaignId: input.campaignId,
          externalRefId: input.externalRefId,
          legacyTxId: `${input.externalRefId}:pending`,
          status: 'pending',
        })
      : 'none';

  const confirmedLegacyOwnership =
    input.confirmedCommissionCents > 0 || eventKind === 'reversal' || eventKind === 'correction'
      ? await resolveLegacyCommissionOwnership(d1, {
          orgId: input.orgId,
          userId: input.userId,
          campaignId: input.campaignId,
          externalRefId: input.externalRefId,
          legacyTxId: `${input.externalRefId}:confirmed`,
          status: 'approved',
        })
      : 'none';

  const res = await d1
    .prepare(
      `INSERT INTO pilot_affiliate_performance_entries
       (id, org_id, user_id, campaign_id, offer_id, report_source, report_period, external_ref_id,
        clicks_count, signups_count, qualified_conversions, pending_commission_cents,
        confirmed_commission_cents, currency, notes, created_at_iso, updated_at_iso)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (org_id, user_id, external_ref_id) DO NOTHING`,
    )
    .bind(
      input.id,
      input.orgId,
      input.userId,
      input.campaignId,
      input.offerId,
      input.reportSource,
      input.reportPeriod,
      input.externalRefId,
      input.clicksCount,
      input.signupsCount,
      input.qualifiedConversions,
      input.pendingCommissionCents,
      input.confirmedCommissionCents,
      currency,
      input.notes,
      input.nowIso,
      input.nowIso,
    )
    .run();

  const insertedNewPerf = Number(res.meta?.changes ?? 0) > 0;
  let duplicate = !insertedNewPerf;

  const insertCommissionAtomically = async (params: {
    readonly id: string;
    readonly scopedTxId: string;
    readonly legacyTxId: string;
    readonly eventType: string;
    readonly status: 'pending' | 'approved' | 'reversed';
    readonly commissionCents: number;
    readonly legacyOwnership: 'none' | 'owned_by_caller' | 'owned_by_other_user';
  }): Promise<void> => {
    if (params.legacyOwnership === 'owned_by_caller') {
      // Historical legacy row already credited this caller's economic event — never double-credit
      return;
    }

    await d1
      .prepare(
        `INSERT INTO workspace_external_commissions
         (id, tenant_id, campaign_id, network, niche, external_tx_id, event_type, status,
          gross_amount_cents, commission_cents, platform_fee_cents, currency, raw_payload,
          occurred_at, created_at)
         SELECT ?, ?, ?, 'customer_partner_report', ?, ?, ?, ?,
                0, ?, 0, ?, ?, ?, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM workspace_external_commissions
           WHERE tenant_id = ? AND network = 'customer_partner_report' AND status = ?
             AND (external_tx_id = ? OR (external_tx_id = ? AND campaign_id = ?))
         )
         ON CONFLICT (tenant_id, network, external_tx_id, status) DO NOTHING`,
      )
      .bind(
        params.id,
        input.orgId,
        input.campaignId,
        niche,
        params.scopedTxId,
        params.eventType,
        params.status,
        params.commissionCents,
        currency,
        rawMeta,
        input.nowMs,
        input.nowMs,
        input.orgId,
        params.status,
        params.scopedTxId,
        params.legacyTxId,
        input.campaignId,
      )
      .run();
  };

  if (insertedNewPerf) {
    if (eventKind === 'reversal') {
      await insertCommissionAtomically({
        id: `wec_rev_${input.id}`,
        scopedTxId: `${input.userId}:${input.externalRefId}:reversed`,
        legacyTxId: `${input.externalRefId}:reversed`,
        eventType: 'partner_statement_reversed',
        status: 'reversed',
        commissionCents: -Math.abs(input.confirmedCommissionCents || input.pendingCommissionCents),
        legacyOwnership: 'none',
      });
    } else {
      if (input.pendingCommissionCents > 0) {
        await insertCommissionAtomically({
          id: `wec_pend_${input.id}`,
          scopedTxId: `${input.userId}:${input.externalRefId}:pending`,
          legacyTxId: `${input.externalRefId}:pending`,
          eventType: 'partner_statement_pending',
          status: 'pending',
          commissionCents: input.pendingCommissionCents,
          legacyOwnership: pendingLegacyOwnership,
        });
      }

      if (input.confirmedCommissionCents > 0) {
        await insertCommissionAtomically({
          id: `wec_conf_${input.id}`,
          scopedTxId: `${input.userId}:${input.externalRefId}:confirmed`,
          legacyTxId: `${input.externalRefId}:confirmed`,
          eventType: 'partner_statement_confirmed',
          status: 'approved',
          commissionCents: input.confirmedCommissionCents,
          legacyOwnership: confirmedLegacyOwnership,
        });
      }
    }
  } else {
    // Existing performance entry for (org_id, user_id, external_ref_id):
    // Handle legitimate state transitions (pending -> confirmed, reversal, correction)
    const existingRow = await d1
      .prepare(
        `SELECT * FROM pilot_affiliate_performance_entries
         WHERE org_id = ? AND user_id = ? AND external_ref_id = ? LIMIT 1`,
      )
      .bind(input.orgId, input.userId, input.externalRefId)
      .first<PerfDbRow>();

    if (existingRow) {
      const isPendingToConfirmed =
        eventKind === 'report' &&
        Number(existingRow.pending_commission_cents) > 0 &&
        input.pendingCommissionCents === 0 &&
        input.confirmedCommissionCents > 0 &&
        Number(existingRow.confirmed_commission_cents) === 0;

      if (isPendingToConfirmed) {
        await d1
          .prepare(
            `UPDATE pilot_affiliate_performance_entries
             SET pending_commission_cents = 0, confirmed_commission_cents = ?, updated_at_iso = ?
             WHERE id = ? AND org_id = ? AND user_id = ?`,
          )
          .bind(input.confirmedCommissionCents, input.nowIso, existingRow.id, input.orgId, input.userId)
          .run();

        // Zero out pending ledger row (scoped or owned-legacy) so pending + approved are never double-counted
        await d1
          .prepare(
            `UPDATE workspace_external_commissions
             SET commission_cents = 0
             WHERE tenant_id = ? AND network = 'customer_partner_report' AND status = 'pending'
               AND (external_tx_id = ? OR (external_tx_id = ? AND campaign_id = ?))`,
          )
          .bind(
            input.orgId,
            `${input.userId}:${input.externalRefId}:pending`,
            `${input.externalRefId}:pending`,
            input.campaignId,
          )
          .run();

        await insertCommissionAtomically({
          id: `wec_conf_${input.id}`,
          scopedTxId: `${input.userId}:${input.externalRefId}:confirmed`,
          legacyTxId: `${input.externalRefId}:confirmed`,
          eventType: 'partner_statement_confirmed',
          status: 'approved',
          commissionCents: input.confirmedCommissionCents,
          legacyOwnership: confirmedLegacyOwnership,
        });
        duplicate = false;
      } else if (eventKind === 'reversal') {
        const reversalAmount = Math.abs(
          input.confirmedCommissionCents || Number(existingRow.confirmed_commission_cents),
        );
        const revRes = await d1
          .prepare(
            `INSERT INTO workspace_external_commissions
             (id, tenant_id, campaign_id, network, niche, external_tx_id, event_type, status,
              gross_amount_cents, commission_cents, platform_fee_cents, currency, raw_payload,
              occurred_at, created_at)
             VALUES (?, ?, ?, 'customer_partner_report', ?, ?, 'partner_statement_reversed', 'reversed',
                     0, ?, 0, ?, ?, ?, ?)
             ON CONFLICT (tenant_id, network, external_tx_id, status) DO NOTHING`,
          )
          .bind(
            `wec_rev_${input.id}`,
            input.orgId,
            input.campaignId,
            niche,
            `${input.userId}:${input.externalRefId}:reversed`,
            -reversalAmount,
            currency,
            rawMeta,
            input.nowMs,
            input.nowMs,
          )
          .run();

        await d1
          .prepare(
            `UPDATE pilot_affiliate_performance_entries
             SET pending_commission_cents = 0, confirmed_commission_cents = 0, updated_at_iso = ?
             WHERE id = ? AND org_id = ? AND user_id = ?`,
          )
          .bind(input.nowIso, existingRow.id, input.orgId, input.userId)
          .run();

        duplicate = Number(revRes.meta?.changes ?? 0) === 0;
      } else if (eventKind === 'correction') {
        const alreadySame =
          Number(existingRow.pending_commission_cents) === input.pendingCommissionCents &&
          Number(existingRow.confirmed_commission_cents) === input.confirmedCommissionCents;

        if (!alreadySame) {
          const auditPayload = JSON.stringify({
            provenance: 'customer_reported_partner_statement',
            reportSource: input.reportSource,
            reportPeriod: input.reportPeriod,
            userId: input.userId,
            eventKind: 'correction',
            previousConfirmedCommissionCents: Number(existingRow.confirmed_commission_cents),
            correctedConfirmedCommissionCents: input.confirmedCommissionCents,
            correctedAtIso: input.nowIso,
          });

          await d1
            .prepare(
              `UPDATE pilot_affiliate_performance_entries
               SET pending_commission_cents = ?, confirmed_commission_cents = ?, notes = ?, updated_at_iso = ?
               WHERE id = ? AND org_id = ? AND user_id = ?`,
            )
            .bind(
              input.pendingCommissionCents,
              input.confirmedCommissionCents,
              input.notes,
              input.nowIso,
              existingRow.id,
              input.orgId,
              input.userId,
            )
            .run();

          await d1
            .prepare(
              `UPDATE workspace_external_commissions
               SET commission_cents = ?, raw_payload = ?
               WHERE tenant_id = ? AND network = 'customer_partner_report' AND status = 'approved'
                 AND (external_tx_id = ? OR (external_tx_id = ? AND campaign_id = ?))`,
            )
            .bind(
              input.confirmedCommissionCents,
              auditPayload,
              input.orgId,
              `${input.userId}:${input.externalRefId}:confirmed`,
              `${input.externalRefId}:confirmed`,
              input.campaignId,
            )
            .run();

          duplicate = false;
        }
      }
    }
  }

  const row = await d1
    .prepare(
      `SELECT * FROM pilot_affiliate_performance_entries
       WHERE org_id = ? AND user_id = ? AND external_ref_id = ? LIMIT 1`,
    )
    .bind(input.orgId, input.userId, input.externalRefId)
    .first<PerfDbRow>();
  if (!row) throw new Error('Failed to load recorded partner performance entry');
  return { entry: mapPerfRow(row), duplicate };
}

export async function getPartnerPerformanceEntryByRef(
  d1: D1Database,
  args: { readonly orgId: string; readonly userId: string; readonly externalRefId: string },
): Promise<PilotAffiliatePerformanceEntry | null> {
  const row = await d1
    .prepare(
      `SELECT * FROM pilot_affiliate_performance_entries
       WHERE org_id = ? AND user_id = ? AND external_ref_id = ? LIMIT 1`,
    )
    .bind(args.orgId, args.userId, args.externalRefId)
    .first<PerfDbRow>();
  return row ? mapPerfRow(row) : null;
}

export async function listPartnerPerformanceEntries(
  d1: D1Database,
  args: { readonly orgId: string; readonly userId: string; readonly limit?: number },
): Promise<readonly PilotAffiliatePerformanceEntry[]> {
  const res = await d1
    .prepare(
      `SELECT * FROM pilot_affiliate_performance_entries
       WHERE org_id = ? AND user_id = ?
       ORDER BY created_at_iso DESC LIMIT ?`,
    )
    .bind(args.orgId, args.userId, args.limit ?? 30)
    .all<PerfDbRow>();
  return (res.results ?? []).map(mapPerfRow);
}

/**
 * Organization-wide performance entry visibility for legitimate ADMIN/OWNER roles.
 * Fail-closed: verifies workspace RBAC (`ADMIN` minimum) against D1 before reading.
 */
export async function listPartnerPerformanceEntriesForOrgAdmin(
  d1: D1Database,
  args: { readonly orgId: string; readonly actorUserId: string; readonly limit?: number },
): Promise<
  | { readonly authorized: true; readonly entries: readonly PilotAffiliatePerformanceEntry[] }
  | { readonly authorized: false; readonly entries: readonly [] }
> {
  const isAdmin = await verifyWorkspaceRole(args.orgId, args.actorUserId, 'ADMIN', d1);
  if (!isAdmin) {
    return { authorized: false, entries: [] };
  }

  const res = await d1
    .prepare(
      `SELECT * FROM pilot_affiliate_performance_entries
       WHERE org_id = ?
       ORDER BY created_at_iso DESC LIMIT ?`,
    )
    .bind(args.orgId, args.limit ?? 100)
    .all<PerfDbRow>();
  return { authorized: true, entries: (res.results ?? []).map(mapPerfRow) };
}
