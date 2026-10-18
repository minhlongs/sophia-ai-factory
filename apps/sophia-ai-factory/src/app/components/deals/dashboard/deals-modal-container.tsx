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
  NewDealModal,
} from '@/forest/deals';
import { DealActionModals, type DealActionModalsProps } from './deal-action-modals';

export { DealActionModals, type DealActionModalsProps };

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
        <DealActionModals
          deal={selectedDeal}
          isPrepOpen={isPrepOpen}
          onClosePrep={onClosePrep}
          prepDossier={prepDossier}
          onGeneratePrep={onGeneratePrep}
          isProposalOpen={isProposalOpen}
          onCloseProposal={onCloseProposal}
          proposalResult={proposalResult}
          onGenerateProposal={onGenerateProposal}
          isSandboxOpen={isSandboxOpen}
          onCloseSandbox={onCloseSandbox}
          sandboxResult={sandboxResult}
          onProvisionSandbox={onProvisionSandbox}
          loadingAction={loadingAction}
        />
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
