'use client';

/**
 * Workflow action handlers for Enterprise Deals Dashboard (prep, proposal, sandbox).
 *
 * @module app/components/deals/dashboard/use-deals-workflow-handlers
 */

import type {
  EnterpriseDeal,
  MeetingPrepDossier,
  EnterpriseProposalResult,
  SandboxProvisionResult,
  ProposalLanguage,
} from '@/seed/types/enterprise-deal';
import {
  generateMeetingPrepAction,
  generateProposalAction,
  provisionSandboxAction,
} from '@/land/admin/enterprise-deal-actions';

export interface DealsWorkflowHandlersParams {
  selectedDeal: EnterpriseDeal | null;
  setDeals: React.Dispatch<React.SetStateAction<EnterpriseDeal[]>>;
  setLoadingAction: React.Dispatch<React.SetStateAction<string | null>>;
  setPrepDossier: (dossier: MeetingPrepDossier | null) => void;
  setProposalResult: (res: EnterpriseProposalResult | null) => void;
  setSandboxResult: (res: SandboxProvisionResult | null) => void;
}

export function createDealsWorkflowHandlers({
  selectedDeal,
  setDeals,
  setLoadingAction,
  setPrepDossier,
  setProposalResult,
  setSandboxResult,
}: DealsWorkflowHandlersParams) {
  const handleGeneratePrep = async () => {
    if (!selectedDeal) return;
    setLoadingAction('prep');
    try {
      const res = await generateMeetingPrepAction(selectedDeal.id);
      if (res.success && res.data) {
        setPrepDossier(res.data);
        setDeals((prev) =>
          prev.map((d) =>
            d.id === selectedDeal.id
              ? {
                  ...d,
                  meetingPrepBrief: res.data!.fullBriefMarkdown,
                  dealStage: 'demo_prepared',
                }
              : d,
          ),
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
              ? {
                  ...d,
                  proposalId: res.data!.proposalId,
                  proposalLanguage: lang,
                  proposalContent: res.data!.fullMarkdown,
                  dealStage: 'proposal_sent',
                }
              : d,
          ),
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
              ? {
                  ...d,
                  sandboxSubaccountId: res.data!.subaccountId,
                  sandboxStatus: 'active',
                  sandboxToken: res.data!.sandboxToken,
                  sandboxExpiresAt: res.data!.expiresAt,
                  dealStage: 'demo_active',
                }
              : d,
          ),
        );
      }
    } finally {
      setLoadingAction(null);
    }
  };

  return {
    handleGeneratePrep,
    handleGenerateProposal,
    handleProvisionSandbox,
  };
}
