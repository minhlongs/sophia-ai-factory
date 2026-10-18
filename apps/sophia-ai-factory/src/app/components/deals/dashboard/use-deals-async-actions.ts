'use client';

/**
 * Enterprise Deals Dashboard Async Actions Hook
 *
 * Layer: forest/deals
 *
 * @module app/components/deals/dashboard/use-deals-async-actions
 */

import { useState } from 'react';
import type {
  EnterpriseDeal,
  EnterpriseLeadEnrichment,
  DealStage,
  CreateEnterpriseDealInput,
  MeetingPrepDossier,
  EnterpriseProposalResult,
  SandboxProvisionResult,
} from '@/seed/types/enterprise-deal';
import {
  createEnterpriseDealAction,
  updateEnterpriseDealAction,
  enrichDealAction,
} from '@/land/admin/enterprise-deal-actions';
import { createDealsWorkflowHandlers } from './use-deals-workflow-handlers';

export interface UseDealsAsyncActionsParams {
  selectedDeal: EnterpriseDeal | null;
  setDeals: React.Dispatch<React.SetStateAction<EnterpriseDeal[]>>;
  setSelectedDeal: React.Dispatch<React.SetStateAction<EnterpriseDeal | null>>;
  setSelectedEnrichment: React.Dispatch<React.SetStateAction<EnterpriseLeadEnrichment | null>>;
  setIsNewDealOpen: (open: boolean) => void;
  setPrepDossier: (dossier: MeetingPrepDossier | null) => void;
  setProposalResult: (res: EnterpriseProposalResult | null) => void;
  setSandboxResult: (res: SandboxProvisionResult | null) => void;
}

export function useDealsAsyncActions({
  selectedDeal,
  setDeals,
  setSelectedDeal,
  setSelectedEnrichment,
  setIsNewDealOpen,
  setPrepDossier,
  setProposalResult,
  setSandboxResult,
}: UseDealsAsyncActionsParams) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleCreateDeal = async (input: CreateEnterpriseDealInput) => {
    setLoadingAction('create');
    try {
      const res = await createEnterpriseDealAction(input);
      if (res.success && res.data) {
        setDeals((prev) => [res.data!, ...prev]);
        setIsNewDealOpen(false);
      } else {
        alert(res.error || 'Failed to create deal');
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStageChange = async (newStage: DealStage) => {
    if (!selectedDeal) return;
    const res = await updateEnterpriseDealAction(selectedDeal.id, { dealStage: newStage });
    if (res.success && res.data) {
      setDeals((prev) => prev.map((d) => (d.id === res.data!.id ? res.data! : d)));
      setSelectedDeal(res.data);
    }
  };

  const handleEnrich = async () => {
    if (!selectedDeal) return;
    setLoadingAction('enrich');
    try {
      const res = await enrichDealAction(selectedDeal.id, { forceRefresh: true });
      if (res.success && res.data) {
        setSelectedEnrichment(res.data.enrichment);
        setSelectedDeal(res.data.deal);
        setDeals((prev) => prev.map((d) => (d.id === res.data!.deal.id ? res.data!.deal : d)));
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const {
    handleGeneratePrep,
    handleGenerateProposal,
    handleProvisionSandbox,
  } = createDealsWorkflowHandlers({
    selectedDeal,
    setDeals,
    setLoadingAction,
    setPrepDossier,
    setProposalResult,
    setSandboxResult,
  });

  return {
    loadingAction,
    handleCreateDeal,
    handleStageChange,
    handleEnrich,
    handleGeneratePrep,
    handleGenerateProposal,
    handleProvisionSandbox,
  };
}
