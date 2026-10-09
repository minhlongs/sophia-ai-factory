'use client';

/**
 * Enterprise Deals Dashboard State Hook
 *
 * Layer: forest/deals
 *
 * @module app/components/deals/dashboard/use-deals-dashboard-state
 */

import { useState } from 'react';
import type {
  EnterpriseDeal,
  EnterpriseLeadEnrichment,
  MeetingPrepDossier,
  EnterpriseProposalResult,
  SandboxProvisionResult,
} from '@/seed/types/enterprise-deal';
import {
  createMeetingPrepDossier,
  createProposalResult,
  createSandboxResult,
} from './deals-modal-handlers';
import { useDealsAsyncActions } from './use-deals-async-actions';

export function useDealsDashboardState(initialDeals: EnterpriseDeal[]) {
  const [deals, setDeals] = useState<EnterpriseDeal[]>(initialDeals);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');

  const [selectedDeal, setSelectedDeal] = useState<EnterpriseDeal | null>(null);
  const [selectedEnrichment, setSelectedEnrichment] = useState<EnterpriseLeadEnrichment | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  const [isPrepOpen, setIsPrepOpen] = useState(false);
  const [prepDossier, setPrepDossier] = useState<MeetingPrepDossier | null>(null);
  const [isProposalOpen, setIsProposalOpen] = useState(false);
  const [proposalResult, setProposalResult] = useState<EnterpriseProposalResult | null>(null);
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<SandboxProvisionResult | null>(null);

  const asyncActions = useDealsAsyncActions({
    selectedDeal,
    setDeals,
    setSelectedDeal,
    setSelectedEnrichment,
    setIsNewDealOpen,
    setPrepDossier,
    setProposalResult,
    setSandboxResult,
  });

  const filteredDeals = deals.filter((deal) => {
    const matchesSearch =
      !search ||
      deal.companyName.toLowerCase().includes(search.toLowerCase()) ||
      deal.companyDomain.toLowerCase().includes(search.toLowerCase()) ||
      deal.leadName.toLowerCase().includes(search.toLowerCase()) ||
      deal.leadEmail.toLowerCase().includes(search.toLowerCase());
    const matchesStage = stageFilter === 'all' || deal.dealStage === stageFilter;
    const matchesTier = tierFilter === 'all' || deal.pipelineTier === tierFilter;
    return matchesSearch && matchesStage && matchesTier;
  });

  const handleSelectDeal = (deal: EnterpriseDeal) => {
    setSelectedDeal(deal);
    setIsDrawerOpen(true);
  };

  const handleOpenMeetingPrep = (deal: EnterpriseDeal) => {
    setSelectedDeal(deal);
    setPrepDossier(createMeetingPrepDossier(deal));
    setIsPrepOpen(true);
  };

  const handleOpenProposal = (deal: EnterpriseDeal) => {
    setSelectedDeal(deal);
    setProposalResult(createProposalResult(deal));
    setIsProposalOpen(true);
  };

  const handleOpenSandbox = (deal: EnterpriseDeal) => {
    setSelectedDeal(deal);
    setSandboxResult(createSandboxResult(deal));
    setIsSandboxOpen(true);
  };

  return {
    deals,
    viewMode,
    setViewMode,
    search,
    setSearch,
    stageFilter,
    setStageFilter,
    tierFilter,
    setTierFilter,
    filteredDeals,
    selectedDeal,
    selectedEnrichment,
    isDrawerOpen,
    setIsDrawerOpen,
    isNewDealOpen,
    setIsNewDealOpen,
    isPrepOpen,
    setIsPrepOpen,
    prepDossier,
    isProposalOpen,
    setIsProposalOpen,
    proposalResult,
    isSandboxOpen,
    setIsSandboxOpen,
    sandboxResult,
    handleSelectDeal,
    handleOpenMeetingPrep,
    handleOpenProposal,
    handleOpenSandbox,
    ...asyncActions,
  };
}
