/**
 * Agency Admin Overview Dashboard Query Action
 *
 * Layer: land/agency
 *
 * @module land/agency/portal-actions/dashboard-query
 */

'use server';

import { logger } from '@/seed/utils/logger-utility';
import type { AgencyAdminDashboardData } from '@/seed/types';
import {
  buildRevenueAttribution,
  aggregateAgencyKpis,
} from '@/tree/agency/attribution-engine';
import { resolveDb } from './common';
import {
  EMPTY_AGENCY_OVERVIEW_KPI,
  fetchAgencyClients,
  fetchAndBindAgencyCampaigns,
} from './dashboard-query-helpers';

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
    const clients = await fetchAgencyClients(db, agencyOrgId);

    // 2. Fetch video reviews / campaigns for these subaccounts
    const campaigns = await fetchAndBindAgencyCampaigns(db, clients);

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
      kpi: { ...EMPTY_AGENCY_OVERVIEW_KPI },
      clients: [],
      campaigns: [],
      attribution: [],
      agencyContext,
    };
  }
}
