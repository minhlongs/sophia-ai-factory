/**
 * Agency Operations Cockpit Main Client Component
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/admin-portal/agency-admin-portal
 */

'use client';

import React, { useState } from 'react';
import { PortalHeader, KpiCardsGrid } from './kpi-cards';
import { ClientTable } from './client-table';
import { CampaignRevenueCards } from './campaign-revenue-cards';
import { QuotaModal } from './quota-modal';
import type {
  AgencyAdminDashboardData,
  AgencyClientSummary,
  AgencyAdminPortalProps,
} from './types';

function applyStatusUpdate(
  prev: AgencyAdminDashboardData,
  subaccountId: string,
  newStatus: 'active' | 'suspended',
): AgencyAdminDashboardData {
  return {
    ...prev,
    clients: prev.clients.map((c) => (c.id === subaccountId ? { ...c, status: newStatus } : c)),
    kpi: {
      ...prev.kpi,
      totalActiveClients:
        newStatus === 'active'
          ? prev.kpi.totalActiveClients + 1
          : Math.max(0, prev.kpi.totalActiveClients - 1),
    },
  };
}

function applyQuotaUpdate(
  prev: AgencyAdminDashboardData,
  subaccountId: string,
  newQuota: number,
): AgencyAdminDashboardData {
  const updatedClients = prev.clients.map((c) =>
    c.id === subaccountId
      ? {
          ...c,
          allocatedMcu: newQuota,
          mcuUtilizationRate: newQuota > 0 ? Math.min(100, Math.round((c.usedMcu / newQuota) * 100)) : 0,
        }
      : c,
  );
  const totalAllocated = updatedClients.reduce((acc, c) => acc + c.allocatedMcu, 0);
  const totalUsed = updatedClients.reduce((acc, c) => acc + c.usedMcu, 0);
  return {
    ...prev,
    clients: updatedClients,
    kpi: {
      ...prev.kpi,
      totalAllocatedMcu: totalAllocated,
      mcuUtilizationRate: totalAllocated > 0 ? Math.round((totalUsed / totalAllocated) * 100) : 0,
    },
  };
}

export function AgencyAdminPortal({ initialData, locale = 'vi', actions }: AgencyAdminPortalProps) {
  const isVi = locale === 'vi';
  const [data, setData] = useState<AgencyAdminDashboardData>(initialData);
  const [selectedClientForQuota, setSelectedClientForQuota] = useState<AgencyClientSummary | null>(null);

  async function handleToggleStatus(subaccountId: string, newStatus: 'active' | 'suspended') {
    if (actions?.updateClientStatus) {
      const res = await actions.updateClientStatus(subaccountId, data.agencyContext.agencyId, newStatus);
      if (!res.success) throw new Error(res.error || 'Failed to update client status');
    }
    setData((prev) => applyStatusUpdate(prev, subaccountId, newStatus));
  }

  async function handleSaveQuota(subaccountId: string, newQuota: number) {
    if (actions?.reallocateQuota) {
      const res = await actions.reallocateQuota(subaccountId, data.agencyContext.agencyId, newQuota);
      if (!res.success) throw new Error(res.error || 'Failed to reallocate quota');
    }
    setData((prev) => applyQuotaUpdate(prev, subaccountId, newQuota));
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PortalHeader agencyContext={data.agencyContext} locale={locale} />
      <KpiCardsGrid kpi={data.kpi} isVi={isVi} />
      <ClientTable
        clients={data.clients}
        onOpenQuotaModal={(c) => setSelectedClientForQuota(c)}
        onToggleStatus={handleToggleStatus}
        isVi={isVi}
      />
      <CampaignRevenueCards
        campaigns={data.campaigns}
        revenues={data.attribution}
        locale={locale}
        isVi={isVi}
      />
      <QuotaModal
        client={selectedClientForQuota}
        isOpen={selectedClientForQuota !== null}
        onClose={() => setSelectedClientForQuota(null)}
        onSave={handleSaveQuota}
        isVi={isVi}
      />
    </div>
  );
}
