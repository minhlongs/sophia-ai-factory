/**
 * Internal query and mapping helpers for Agency Admin Overview Dashboard
 *
 * Layer: land/agency
 *
 * @module land/agency/portal-actions/dashboard-query-helpers
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  AgencyClientSummary,
  AgencyCampaignSummary,
  AgencyKpiOverview,
} from '@/seed/types';
import { calculateMcuUtilization } from '@/tree/agency/attribution-engine';

export interface SubaccountDbRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  custom_domain: string | null;
  created_at: string;
  allocated_mcu: number;
  used_mcu: number;
}

export interface VideoReviewDbRow {
  id: string;
  subaccount_id: string;
  video_title: string | null;
  status: string;
  created_at: string;
  client_name: string;
}

export const EMPTY_AGENCY_OVERVIEW_KPI: AgencyKpiOverview = {
  totalActiveClients: 0,
  totalAllocatedMcu: 0,
  totalUsedMcu: 0,
  mcuUtilizationRate: 0,
  activeCampaigns: 0,
  attributedMrrUsd: 0,
  growthRatePercent: 0,
};

/**
 * Fetches client subaccounts scoped strictly to agency_org_id and maps to AgencyClientSummary.
 */
export async function fetchAgencyClients(
  db: D1Database,
  agencyOrgId: string
): Promise<AgencyClientSummary[]> {
  const rows = await db
    .prepare(
      `SELECT
         c.id, c.name, c.slug, c.status, c.custom_domain, c.created_at,
         coalesce(a.allocated_mcu, 0) as allocated_mcu,
         coalesce(a.used_mcu, 0) as used_mcu
       FROM client_subaccounts c
       LEFT JOIN subaccount_mcu_allocations a ON c.id = a.subaccount_id
       WHERE c.agency_org_id = ?1
       ORDER BY c.created_at DESC`
    )
    .bind(agencyOrgId)
    .all<SubaccountDbRow>();

  const clientRows = rows.results || [];
  return clientRows.map((r) => {
    const util = calculateMcuUtilization(r.allocated_mcu, r.used_mcu);
    const isSuspended = r.status.toLowerCase() === 'suspended';
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      status: isSuspended ? 'suspended' : 'active',
      allocatedMcu: r.allocated_mcu,
      usedMcu: r.used_mcu,
      mcuUtilizationRate: util.usedRatePercent,
      customDomain: r.custom_domain,
      portalUrl: `/portal/${r.slug}`,
      activeCampaignsCount: 0,
      createdAt: r.created_at,
    };
  });
}

/**
 * Fetches video reviews/campaigns for the given clients and updates activeCampaignsCount in-place.
 */
export async function fetchAndBindAgencyCampaigns(
  db: D1Database,
  clients: AgencyClientSummary[]
): Promise<AgencyCampaignSummary[]> {
  if (clients.length === 0) return [];

  const subaccountIds = clients.map((c) => c.id);
  const placeholders = subaccountIds.map((_, i) => `?${i + 1}`).join(',');
  const reviewRows = await db
    .prepare(
      `SELECT r.id, r.subaccount_id, r.video_title, r.status, r.created_at, c.name as client_name
       FROM video_reviews r
       JOIN client_subaccounts c ON r.subaccount_id = c.id
       WHERE r.subaccount_id IN (${placeholders})
       ORDER BY r.created_at DESC LIMIT 50`
    )
    .bind(...subaccountIds)
    .all<VideoReviewDbRow>();

  const campaigns: AgencyCampaignSummary[] = (reviewRows.results || []).map((rev) => {
    const statusNormalized = rev.status.toLowerCase();
    const campaignStatus: 'draft' | 'in_review' | 'approved' | 'published' =
      statusNormalized === 'approved'
        ? 'approved'
        : statusNormalized === 'changes_requested'
        ? 'draft'
        : 'in_review';

    return {
      id: rev.id,
      subaccountId: rev.subaccount_id,
      clientName: rev.client_name,
      title: rev.video_title || 'Untitled Campaign',
      status: campaignStatus,
      rendersCount: 1,
      mcuConsumed: 10,
      updatedAt: rev.created_at,
    };
  });

  for (const client of clients) {
    client.activeCampaignsCount = campaigns.filter(
      (cmp) => cmp.subaccountId === client.id && (cmp.status === 'in_review' || cmp.status === 'approved')
    ).length;
  }

  return campaigns;
}
