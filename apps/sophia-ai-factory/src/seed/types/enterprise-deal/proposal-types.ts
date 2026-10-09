/**
 * Meeting Prep Dossier, Proposal Models & Sandbox Provisioning Types
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 * Conforms to: Sophia 4-Layer Architecture Doctrine (< 200 LOC)
 *
 * @module seed/types/enterprise-deal/proposal-types
 */

import type { ProposalLanguage } from './deal-constants';

export interface BattlecardItem {
  competitorOrObjection: string;
  ourDifferentiator: string;
  talkingPoint: string;
}

export interface MeetingPrepDossier {
  dealId: string;
  companyOverview: string;
  keyStakeholders: string;
  painPointAnalysis: string;
  proposedSolutionBlueprint: string;
  commercialRecommendation: string;
  battlecards: BattlecardItem[];
  fullBriefMarkdown: string;
  generatedAt: number;
}

export interface ProposalSection {
  title: string;
  content: string;
}

export interface EnterpriseProposalResult {
  proposalId: string;
  dealId: string;
  language: ProposalLanguage;
  title: string;
  sections: ProposalSection[];
  fullMarkdown: string;
  wordCount: number;
  qualityPassed: boolean;
  generatedAt: number;
}

export interface SandboxProvisionResult {
  dealId: string;
  subaccountId: string;
  subaccountName: string;
  slug: string;
  allocatedMcu: number;
  expiresAt: number;
  sandboxToken: string;
  demoMagicUrl: string;
  watermarkEnabled: boolean;
}
