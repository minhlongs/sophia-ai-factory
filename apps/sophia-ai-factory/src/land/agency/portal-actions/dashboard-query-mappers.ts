/**
 * Row types and mappers for Agency Admin Overview Dashboard
 *
 * Layer: land/agency
 *
 * @module land/agency/portal-actions/dashboard-query-mappers
 */

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

export function mapSubaccountRow(r: SubaccountDbRow): AgencyClientSummary {
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
}

export function mapVideoReviewRow(rev: VideoReviewDbRow): AgencyCampaignSummary {
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
}
