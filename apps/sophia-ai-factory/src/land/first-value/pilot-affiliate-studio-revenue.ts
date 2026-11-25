/**
 * Affiliate Revenue Snapshot & Partner Performance Recording for Pilot Affiliate Studio.
 *
 * Reuses `fetchWorkspaceDomainBReconciliation` (`workspace_external_commissions`),
 * respects zero-decimal currencies (`VND` uses integer subunits; `USD`/`USDT`/`EUR` use cents),
 * checks real `affiliate_network_credentials` connection status (`NOT_CONNECTED` when empty),
 * and computes transparent AI cost + Net Revenue without fabricating figures or FX rates.
 *
 * @module land/first-value/pilot-affiliate-studio-revenue
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { NextResponse } from 'next/server';
import {
  fetchWorkspaceDomainBReconciliation,
  type DomainBReconciliationSummary,
} from '@/land/affiliates/reconciliation/workspace-domain-b-reconciliation';
import {
  getPilotAffiliateCampaignById,
  listPartnerPerformanceEntries,
  listPilotAffiliateCampaigns,
  listPilotAffiliateOffers,
  recordPartnerPerformanceReport,
  type PilotAffiliateCampaignRecord,
  type PilotAffiliateOfferRecord,
  type PilotAffiliatePerformanceEntry,
} from '@/tree/first-value/pilot-affiliate-studio-repo';
import { getPilotQuotaStatus } from '@/tree/first-value/pilot-state-repo';
import { jsonPrivate, type FirstValuePostPayload } from './first-value-http-schemas';
import { safeRecordPilotEvent, type PilotLiveUser } from './first-value-pilot-actions';

export function currencySubunitScale(currency: string): number {
  return currency.trim().toUpperCase() === 'VND' ? 1 : 100;
}

export function formatAffiliateCurrencyAmount(
  amount: number | null,
  currency: string,
  opts?: { readonly unavailableLabel?: string },
): string {
  if (amount === null) {
    return opts?.unavailableLabel ?? 'N/A';
  }
  const code = (currency || 'USD').trim().toUpperCase();
  if (code === 'VND') {
    return `${Math.round(amount).toLocaleString('en-US')} VND`;
  }
  if (code === 'EUR') {
    return `€${amount.toFixed(2)} EUR`;
  }
  if (code === 'USDT') {
    return `${amount.toFixed(2)} USDT`;
  }
  return `$${amount.toFixed(2)} USD`;
}

export interface AffiliateRevenueSnapshot {
  readonly partnerFeedStatus: 'CONNECTED' | 'NOT_CONNECTED';
  readonly connectedNetworks: readonly string[];
  readonly totalCampaigns: number;
  readonly approvedCampaigns: number;
  readonly clicksCount: number | null;
  readonly clicksSource: 'PARTNER_REPORTED' | 'NOT_CONNECTED';
  readonly signupsCount: number;
  readonly qualifiedConversions: number;
  readonly pendingCommissionUsd: number | null;
  readonly confirmedCommissionUsd: number | null;
  readonly estimatedAiCostUsd: number;
  readonly netRevenueUsd: number | null;
  readonly netRevenueUnavailableReason?: 'MULTI_CURRENCY' | 'NON_USD_COMMISSION' | null;
  readonly currency: string;
  readonly isMultiCurrency: boolean;
  readonly domainBReconciliation: DomainBReconciliationSummary | null;
}

export interface AffiliateStudioSnapshot {
  readonly offers: readonly PilotAffiliateOfferRecord[];
  readonly campaigns: readonly PilotAffiliateCampaignRecord[];
  readonly performanceEntries: readonly PilotAffiliatePerformanceEntry[];
  readonly revenue: AffiliateRevenueSnapshot;
}

async function readConnectedNetworks(d1: D1Database, orgId: string): Promise<readonly string[]> {
  try {
    const res = await d1
      .prepare(
        `SELECT DISTINCT network FROM affiliate_network_credentials
         WHERE (workspace_id = ? OR tenant_id = ?) LIMIT 20`,
      )
      .bind(orgId, orgId)
      .all<{ network?: string }>();
    return (res.results ?? [])
      .map((r) => (r.network ?? '').trim())
      .filter((n) => n.length > 0);
  } catch {
    return [];
  }
}

export async function buildAffiliateStudioSnapshot(
  d1: D1Database,
  args: { readonly orgId: string; readonly userId: string; readonly maxGenerations?: number },
): Promise<AffiliateStudioSnapshot> {
  let offers: readonly PilotAffiliateOfferRecord[] = [];
  let campaigns: readonly PilotAffiliateCampaignRecord[] = [];
  let performanceEntries: readonly PilotAffiliatePerformanceEntry[] = [];
  try {
    [offers, campaigns, performanceEntries] = await Promise.all([
      listPilotAffiliateOffers(d1, { orgId: args.orgId, userId: args.userId, limit: 25 }),
      listPilotAffiliateCampaigns(d1, { orgId: args.orgId, userId: args.userId, limit: 25 }),
      listPartnerPerformanceEntries(d1, { orgId: args.orgId, userId: args.userId, limit: 30 }),
    ]);
  } catch {
    // Graceful empty state if migration 0520 is not applied on legacy test DBs
  }

  const connectedNetworks = await readConnectedNetworks(d1, args.orgId);
  const partnerFeedStatus = connectedNetworks.length > 0 ? 'CONNECTED' : 'NOT_CONNECTED';

  let domainB: DomainBReconciliationSummary | null = null;
  const domainBRes = await fetchWorkspaceDomainBReconciliation(d1, args.orgId);
  if (domainBRes.ok) {
    domainB = domainBRes.value;
  }

  let estimatedAiCostUsd = 0;
  try {
    const quota = await getPilotQuotaStatus(d1, {
      orgId: args.orgId,
      userId: args.userId,
      maxGenerations: args.maxGenerations ?? 20,
    });
    estimatedAiCostUsd = quota.estimatedSpendUsd ?? 0;
  } catch {
    estimatedAiCostUsd =
      campaigns.reduce((sum, c) => sum + c.estimatedAiCostMicroUsd, 0) / 1_000_000;
  }

  const clicksEntries = performanceEntries.filter((e) => e.clicksCount !== null);
  const clicksCount =
    clicksEntries.length > 0
      ? clicksEntries.reduce((sum, e) => sum + (e.clicksCount ?? 0), 0)
      : null;
  const signupsCount = performanceEntries.reduce((sum, e) => sum + e.signupsCount, 0);
  const qualifiedConversions = performanceEntries.reduce(
    (sum, e) => sum + e.qualifiedConversions,
    0,
  );

  const isSingle = domainB ? Boolean(domainB.isSingleCurrency) : true;
  const currency =
    domainB && domainB.currencies && domainB.currencies.length === 1
      ? domainB.currencies[0]
      : 'USD';
  const scale = currencySubunitScale(currency);
  const pendingCommissionUsd =
    domainB && isSingle ? domainB.pendingCents / scale : domainB ? null : 0;
  const confirmedCommissionUsd =
    domainB && isSingle ? domainB.effectiveCommissionCents / scale : domainB ? null : 0;

  let netRevenueUsd: number | null = null;
  let netRevenueUnavailableReason: 'MULTI_CURRENCY' | 'NON_USD_COMMISSION' | null = null;
  if (!isSingle) {
    netRevenueUnavailableReason = 'MULTI_CURRENCY';
  } else if (currency !== 'USD') {
    netRevenueUnavailableReason = 'NON_USD_COMMISSION';
  } else if (confirmedCommissionUsd !== null) {
    netRevenueUsd = Number((confirmedCommissionUsd - estimatedAiCostUsd).toFixed(2));
  }

  return {
    offers,
    campaigns,
    performanceEntries,
    revenue: {
      partnerFeedStatus,
      connectedNetworks,
      totalCampaigns: campaigns.length,
      approvedCampaigns: campaigns.filter((c) => c.reviewState === 'approved').length,
      clicksCount,
      clicksSource: clicksCount !== null ? 'PARTNER_REPORTED' : 'NOT_CONNECTED',
      signupsCount,
      qualifiedConversions,
      pendingCommissionUsd,
      confirmedCommissionUsd,
      estimatedAiCostUsd: Number(estimatedAiCostUsd.toFixed(4)),
      netRevenueUsd,
      netRevenueUnavailableReason,
      currency,
      isMultiCurrency: !isSingle,
      domainBReconciliation: domainB,
    },
  };
}

export async function handleRecordPartnerPerformance(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'record_partner_performance' }>,
  nowMs: number,
): Promise<NextResponse> {
  const campaign = await getPilotAffiliateCampaignById(d1, {
    campaignId: payload.campaignId,
    orgId: payload.orgId,
    userId: user.id,
  });
  if (!campaign) {
    return jsonPrivate(
      { code: 'CAMPAIGN_NOT_FOUND', error: 'Campaign not found in your workspace' },
      404,
    );
  }

  const nowIso = new Date(nowMs).toISOString();
  const scale = currencySubunitScale(payload.currency);
  const pendingSubunits = Math.round(payload.pendingCommissionUsd * scale);
  const confirmedSubunits = Math.round(payload.confirmedCommissionUsd * scale);

  const recorded = await recordPartnerPerformanceReport(d1, {
    id: `pperf_${crypto.randomUUID()}`,
    orgId: payload.orgId,
    userId: user.id,
    campaignId: campaign.id,
    offerId: campaign.offerId,
    vertical: campaign.vertical,
    reportSource: payload.reportSource,
    reportPeriod: payload.reportPeriod,
    externalRefId: payload.externalRefId,
    clicksCount: payload.clicksCount ?? null,
    signupsCount: payload.signupsCount,
    qualifiedConversions: payload.qualifiedConversions,
    pendingCommissionCents: pendingSubunits,
    confirmedCommissionCents: confirmedSubunits,
    currency: payload.currency,
    notes: payload.notes ?? null,
    nowIso,
    nowMs,
  });

  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'PERFORMANCE_RECORDED',
    artifactId: campaign.id,
    metadata: {
      duplicate: recorded.duplicate,
      currency: payload.currency,
      confirmedSubunits,
    },
    nowIso,
  });

  const studio = await buildAffiliateStudioSnapshot(d1, {
    orgId: payload.orgId,
    userId: user.id,
  });

  return jsonPrivate(
    {
      performanceEntry: recorded.entry,
      idempotentReplay: recorded.duplicate,
      revenue: studio.revenue,
      publicPublished: false,
      paidInferenceExecuted: false,
    },
    recorded.duplicate ? 200 : 201,
  );
}
