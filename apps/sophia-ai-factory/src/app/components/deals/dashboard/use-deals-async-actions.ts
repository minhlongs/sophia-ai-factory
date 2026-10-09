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
  ProposalLanguage,
} from '@/seed/types/enterprise-deal';
import {
  createEnterpriseDealAction,
  updateEnterpriseDealAction,
  enrichDealAction,
  generateMeetingPrepAction,
  generateProposalAction,
  provisionSandboxAction,
} from '@/land/admin/enterprise-deal-actions';

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

  const handleGeneratePrep = async () => {
    if (!selectedDeal) return;
    setLoadingAction('prep');
    try {
      const res = await generateMeetingPrepAction(selectedDeal.id);
      if (res.success && res.data) {
        setPrepDossier(res.data);
        setDeals((prev) =>
          prev.map((d) =>
            d.id === selectedDeal.id ? { ...d, meetingPrepBrief: res.data!.fullBriefMarkdown, dealStage: 'demo_prepared' } : d
          )
        );
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleGenerateProposal = async (lang: ProposalLanguage) => {
    if (!selectedDeal) return;
    setLoadingAction('proposal');
    try {
      const res = await generateProposalAction(selectedDeal.id, lang);
      if (res.success && res.data) {
        setProposalResult(res.data);
        setDeals((prev) =>
          prev.map((d) =>
            d.id === selectedDeal.id
              ? { ...d, proposalId: res.data!.proposalId, proposalLanguage: lang, proposalContent: res.data!.fullMarkdown, dealStage: 'proposal_sent' }
              : d
          )
        );
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleProvisionSandbox = async () => {
    if (!selectedDeal) return;
    setLoadingAction('sandbox');
    try {
      const res = await provisionSandboxAction(selectedDeal.id);
      if (res.success && res.data) {
        setSandboxResult(res.data);
        setDeals((prev) =>
          prev.map((d) =>
            d.id === selectedDeal.id
              ? { ...d, sandboxSubaccountId: res.data!.subaccountId, sandboxStatus: 'active', sandboxToken: res.data!.sandboxToken, sandboxExpiresAt: res.data!.expiresAt, dealStage: 'demo_active' }
              : d
          )
        );
      }
    } finally {
      setLoadingAction(null);
    }
  };

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
