'use client';

/**
 * Enterprise Deals & Autonomous Sales Agent Command Center Component
 *
 * Layer: forest/deals (UI presentation & orchestration)
 *
 * @module app/components/deals/dashboard/deals-dashboard-view
 */

import React from 'react';
import { DealsKanbanBoard } from '@/forest/deals';
import type { DealsAdminDashboardProps } from './dashboard-types';
import { DashboardHeader } from './dashboard-header';
import { MetricsBanner } from './metrics-banner';
import { DealsFilterBar } from './deals-filter-bar';
import { DealsTableView } from './deals-table-view';
import { DealsModalContainer } from './deals-modal-container';
import { useDealsDashboardState } from './use-deals-dashboard-state';

export function DealsAdminDashboardView({
  initialDeals,
  locale = 'en',
}: DealsAdminDashboardProps) {
  const isVi = locale === 'vi';
  const state = useDealsDashboardState(initialDeals);

  return (
    <div className="space-y-6 text-zinc-100">
      <DashboardHeader isVi={isVi} onOpenNewDeal={() => state.setIsNewDealOpen(true)} />
      <MetricsBanner deals={state.deals} isVi={isVi} />
      <DealsFilterBar
        search={state.search}
        onSearchChange={state.setSearch}
        stageFilter={state.stageFilter}
        onStageFilterChange={state.setStageFilter}
        tierFilter={state.tierFilter}
        onTierFilterChange={state.setTierFilter}
        viewMode={state.viewMode}
        onViewModeChange={state.setViewMode}
        isVi={isVi}
      />
      {state.viewMode === 'kanban' ? (
        <DealsKanbanBoard
          deals={state.filteredDeals}
          onSelectDeal={state.handleSelectDeal}
          onOpenMeetingPrep={state.handleOpenMeetingPrep}
          onOpenProposal={state.handleOpenProposal}
          onOpenSandbox={state.handleOpenSandbox}
        />
      ) : (
        <DealsTableView
          deals={state.filteredDeals}
          onSelectDeal={state.handleSelectDeal}
          onOpenMeetingPrep={state.handleOpenMeetingPrep}
          onOpenProposal={state.handleOpenProposal}
          onOpenSandbox={state.handleOpenSandbox}
        />
      )}
      <DealsModalContainer
        selectedDeal={state.selectedDeal}
        selectedEnrichment={state.selectedEnrichment}
        isDrawerOpen={state.isDrawerOpen}
        onCloseDrawer={() => state.setIsDrawerOpen(false)}
        onStageChange={state.handleStageChange}
        onEnrich={state.handleEnrich}
        onOpenMeetingPrep={state.handleOpenMeetingPrep}
        onOpenProposal={state.handleOpenProposal}
        onOpenSandbox={state.handleOpenSandbox}
        isNewDealOpen={state.isNewDealOpen}
        onCloseNewDeal={() => state.setIsNewDealOpen(false)}
        onCreateDeal={state.handleCreateDeal}
        isPrepOpen={state.isPrepOpen}
        onClosePrep={() => state.setIsPrepOpen(false)}
        prepDossier={state.prepDossier}
        onGeneratePrep={state.handleGeneratePrep}
        isProposalOpen={state.isProposalOpen}
        onCloseProposal={() => state.setIsProposalOpen(false)}
        proposalResult={state.proposalResult}
        onGenerateProposal={state.handleGenerateProposal}
        isSandboxOpen={state.isSandboxOpen}
        onCloseSandbox={() => state.setIsSandboxOpen(false)}
        sandboxResult={state.sandboxResult}
        onProvisionSandbox={state.handleProvisionSandbox}
        loadingAction={state.loadingAction}
      />
    </div>
  );
}
