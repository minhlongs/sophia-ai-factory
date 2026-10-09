/**
 * Agency Admin Overview Dashboard Query Action
 *
 * Layer: land/agency
 *
 * @module land/agency/portal-actions/dashboard-query
 */

'use server';

import { logger } from '@/seed/utils/logger-utility';
import type {
  AgencyAdminDashboardData,
  AgencyClientSummary,
  AgencyCampaignSummary,
} from '@/seed/types';
import {
  calculateMcuUtilization,
  buildRevenueAttribution,
  aggregateAgencyKpis,
} from '@/tree/agency/attribution-engine';
import { resolveDb } from './common';

/**
 * Retrieves the comprehensive Agency Admin Portal dashboard data with tenant isolation.
 */
export async function getAgencyAdminOverviewAction(
  agencyOrgId: string,
  agencyContext = { agencyId: agencyOrgId, agencyName: 'My Agency', agencySlug: 'my-agency' },
  dbOverride?: unknown
): Promise<AgencyAdminDashboardData> {
  const db = resolveDb(dbOverride);

  try {
    // 1. Fetch subaccounts scoped strictly to agency_org_id
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
      .all<{
        id: string;
        name: string;
        slug: string;
        status: string;
        custom_domain: string | null;
        created_at: string;
        allocated_mcu: number;
        used_mcu: number;
      }>();

    const clientRows = rows.results || [];
    const clients: AgencyClientSummary[] = clientRows.map((r) => {
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

    // 2. Fetch video reviews / campaigns for these subaccounts
    const campaigns: AgencyCampaignSummary[] = [];
    if (clients.length > 0) {
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
        .all<{
          id: string;
          subaccount_id: string;
          video_title: string | null;
          status: string;
          created_at: string;
          client_name: string;
        }>();

      for (const rev of reviewRows.results || []) {
        const statusNormalized = rev.status.toLowerCase();
        const campaignStatus: 'draft' | 'in_review' | 'approved' | 'published' =
          statusNormalized === 'approved'
            ? 'approved'
            : statusNormalized === 'changes_requested'
            ? 'draft'
            : 'in_review';

        campaigns.push({
          id: rev.id,
          subaccountId: rev.subaccount_id,
          clientName: rev.client_name,
          title: rev.video_title || 'Untitled Campaign',
          status: campaignStatus,
          rendersCount: 1,
          mcuConsumed: 10,
          updatedAt: rev.created_at,
        });
      }

      // Update activeCampaignsCount on clients
      for (const client of clients) {
        client.activeCampaignsCount = campaigns.filter(
          (cmp) => cmp.subaccountId === client.id && (cmp.status === 'in_review' || cmp.status === 'approved')
        ).length;
      }
    }

    // 3. Build attributions
    const attributions = clients.map((c) =>
      buildRevenueAttribution(c.id, c.name, 'growth', c.allocatedMcu, c.usedMcu)
    );

    // 4. Aggregate KPIs
    const kpi = aggregateAgencyKpis(clients, campaigns, attributions);

    return {
      kpi,
      clients,
      campaigns,
      attribution: attributions,
      agencyContext,
    };
  } catch (err) {
    logger.error('[Agency Actions] Failed to load agency admin overview', {
      error: String(err),
      agencyOrgId,
    });
    return {
      kpi: {
        totalActiveClients: 0,
        totalAllocatedMcu: 0,
        totalUsedMcu: 0,
        mcuUtilizationRate: 0,
        activeCampaigns: 0,
        attributedMrrUsd: 0,
        growthRatePercent: 0,
      },
      clients: [],
      campaigns: [],
      attribution: [],
      agencyContext,
    };
  }
}
