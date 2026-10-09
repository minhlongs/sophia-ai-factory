'use client';

/**
 * Deals Admin Dashboard Modal & Drawer Container
 *
 * Layer: forest/deals
 *
 * @module app/components/deals/dashboard/deals-modal-container
 */

import React from 'react';
import type {
  EnterpriseDeal,
  EnterpriseLeadEnrichment,
  DealStage,
  MeetingPrepDossier,
  EnterpriseProposalResult,
  SandboxProvisionResult,
  CreateEnterpriseDealInput,
  ProposalLanguage,
} from '@/seed/types/enterprise-deal';
import {
  DealDetailDrawer,
  MeetingPrepModal,
  ProposalGeneratorModal,
  SandboxProvisionModal,
  NewDealModal,
} from '@/forest/deals';

export interface DealsModalContainerProps {
  selectedDeal: EnterpriseDeal | null;
  selectedEnrichment: EnterpriseLeadEnrichment | null;
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
  onStageChange: (stage: DealStage) => Promise<void>;
  onEnrich: () => Promise<void>;
  onOpenMeetingPrep: (deal: EnterpriseDeal) => void;
  onOpenProposal: (deal: EnterpriseDeal) => void;
  onOpenSandbox: (deal: EnterpriseDeal) => void;
  isNewDealOpen: boolean;
  onCloseNewDeal: () => void;
  onCreateDeal: (input: CreateEnterpriseDealInput) => Promise<void>;
  isPrepOpen: boolean;
  onClosePrep: () => void;
  prepDossier: MeetingPrepDossier | null;
  onGeneratePrep: () => Promise<void>;
  isProposalOpen: boolean;
  onCloseProposal: () => void;
  proposalResult: EnterpriseProposalResult | null;
  onGenerateProposal: (lang: ProposalLanguage) => Promise<void>;
  isSandboxOpen: boolean;
  onCloseSandbox: () => void;
  sandboxResult: SandboxProvisionResult | null;
  onProvisionSandbox: () => Promise<void>;
  loadingAction: string | null;
}

export function DealsModalContainer({
  selectedDeal,
  selectedEnrichment,
  isDrawerOpen,
  onCloseDrawer,
  onStageChange,
  onEnrich,
  onOpenMeetingPrep,
  onOpenProposal,
  onOpenSandbox,
  isNewDealOpen,
  onCloseNewDeal,
  onCreateDeal,
  isPrepOpen,
  onClosePrep,
  prepDossier,
  onGeneratePrep,
  isProposalOpen,
  onCloseProposal,
  proposalResult,
  onGenerateProposal,
  isSandboxOpen,
  onCloseSandbox,
  sandboxResult,
  onProvisionSandbox,
  loadingAction,
}: DealsModalContainerProps) {
  return (
    <>
      <DealDetailDrawer
        deal={selectedDeal}
        enrichment={selectedEnrichment}
        isOpen={isDrawerOpen}
        onClose={onCloseDrawer}
        onStageChange={onStageChange}
        onEnrich={onEnrich}
        onOpenMeetingPrep={() => selectedDeal && onOpenMeetingPrep(selectedDeal)}
        onOpenProposal={() => selectedDeal && onOpenProposal(selectedDeal)}
        onOpenSandbox={() => selectedDeal && onOpenSandbox(selectedDeal)}
        isEnriching={loadingAction === 'enrich'}
      />

      {selectedDeal && (
        <>
          <MeetingPrepModal
            deal={selectedDeal}
            dossier={prepDossier}
            isOpen={isPrepOpen}
            onClose={onClosePrep}
            onGenerate={onGeneratePrep}
            isLoading={loadingAction === 'prep'}
          />

          <ProposalGeneratorModal
            deal={selectedDeal}
            proposal={proposalResult}
            isOpen={isProposalOpen}
            onClose={onCloseProposal}
            onGenerate={onGenerateProposal}
            isLoading={loadingAction === 'proposal'}
          />

          <SandboxProvisionModal
            deal={selectedDeal}
            sandbox={sandboxResult}
            isOpen={isSandboxOpen}
            onClose={onCloseSandbox}
            onProvision={onProvisionSandbox}
            isLoading={loadingAction === 'sandbox'}
          />
        </>
      )}

      <NewDealModal
        isOpen={isNewDealOpen}
        onClose={onCloseNewDeal}
        onSubmit={onCreateDeal}
        isLoading={loadingAction === 'create'}
      />
    </>
  );
}
