/**
 * Agency Admin Portal Types
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/admin-portal/types
 */

import type {
  AgencyAdminDashboardData,
  AgencyClientSummary,
  AgencyCampaignSummary,
  AgencyRevenueAttribution,
  VelocityAlertStatus,
} from '@/seed/types';

export interface AgencyAdminPortalActions {
  updateClientStatus?: (
    subaccountId: string,
    agencyOrgId: string,
    status: 'active' | 'suspended'
  ) => Promise<{ success: boolean; error?: string }>;
  reallocateQuota?: (
    subaccountId: string,
    agencyOrgId: string,
    allocatedMcu: number
  ) => Promise<{ success: boolean; remainingMcu?: number; error?: string }>;
}

export interface AgencyAdminPortalProps {
  initialData: AgencyAdminDashboardData;
  locale?: 'en' | 'vi';
  actions?: AgencyAdminPortalActions;
}

export type {
  AgencyAdminDashboardData,
  AgencyClientSummary,
  AgencyCampaignSummary,
  AgencyRevenueAttribution,
  VelocityAlertStatus,
};
