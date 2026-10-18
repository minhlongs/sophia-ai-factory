'use client';

import React from 'react';
import type {
  EnterpriseDeal,
  MeetingPrepDossier,
  EnterpriseProposalResult,
  SandboxProvisionResult,
  ProposalLanguage,
} from '@/seed/types/enterprise-deal';
import {
  MeetingPrepModal,
  ProposalGeneratorModal,
  SandboxProvisionModal,
} from '@/forest/deals';

export interface DealActionModalsProps {
  deal: EnterpriseDeal;
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

export function DealActionModals({
  deal,
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
}: DealActionModalsProps) {
  return (
    <>
      <MeetingPrepModal
        deal={deal}
        dossier={prepDossier}
        isOpen={isPrepOpen}
        onClose={onClosePrep}
        onGenerate={onGeneratePrep}
        isLoading={loadingAction === 'prep'}
      />

      <ProposalGeneratorModal
        deal={deal}
        proposal={proposalResult}
        isOpen={isProposalOpen}
        onClose={onCloseProposal}
        onGenerate={onGenerateProposal}
        isLoading={loadingAction === 'proposal'}
      />

      <SandboxProvisionModal
        deal={deal}
        sandbox={sandboxResult}
        isOpen={isSandboxOpen}
        onClose={onCloseSandbox}
        onProvision={onProvisionSandbox}
        isLoading={loadingAction === 'sandbox'}
      />
    </>
  );
}
