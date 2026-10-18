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
} from '@/seed/types';
import {
  EMPTY_AGENCY_OVERVIEW_KPI,
  mapSubaccountRow,
  mapVideoReviewRow,
  type SubaccountDbRow,
  type VideoReviewDbRow,
} from './dashboard-query-mappers';

export {
  EMPTY_AGENCY_OVERVIEW_KPI,
  type SubaccountDbRow,
  type VideoReviewDbRow,
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

  return (rows.results || []).map(mapSubaccountRow);
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

  const campaigns: AgencyCampaignSummary[] = (reviewRows.results || []).map(mapVideoReviewRow);

  for (const client of clients) {
    client.activeCampaignsCount = campaigns.filter(
      (cmp) => cmp.subaccountId === client.id && (cmp.status === 'in_review' || cmp.status === 'approved')
    ).length;
  }

  return campaigns;
}
