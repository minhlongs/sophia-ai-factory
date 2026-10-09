'use client';

/**
 * Enterprise Deals Modal Handlers
 *
 * Layer: forest/deals
 *
 * @module app/components/deals/dashboard/deals-modal-handlers
 */

import type {
  EnterpriseDeal,
  MeetingPrepDossier,
  EnterpriseProposalResult,
  SandboxProvisionResult,
} from '@/seed/types/enterprise-deal';

export function createMeetingPrepDossier(deal: EnterpriseDeal): MeetingPrepDossier | null {
  if (!deal.meetingPrepBrief) return null;
  return {
    dealId: deal.id,
    companyOverview: `${deal.companyName} (${deal.companyDomain})`,
    keyStakeholders: deal.leadName,
    painPointAnalysis: deal.notes || 'APAC multi-language video automation',
    proposedSolutionBlueprint: 'Sophia AI Factory 5-Language Video Dubbing & GPU Mesh',
    commercialRecommendation: 'Enterprise Growth Tier (100K MCU/mo)',
    battlecards: [],
    fullBriefMarkdown: deal.meetingPrepBrief,
    generatedAt: deal.updatedAt,
  };
}

export function createProposalResult(deal: EnterpriseDeal): EnterpriseProposalResult | null {
  if (!deal.proposalContent) return null;
  return {
    proposalId: deal.proposalId || `prop_${deal.id.slice(0, 8)}`,
    dealId: deal.id,
    language: deal.proposalLanguage,
    title: `Enterprise Proposal — ${deal.companyName}`,
    sections: [],
    fullMarkdown: deal.proposalContent,
    wordCount: deal.proposalContent.split(/\s+/).length,
    qualityPassed: true,
    generatedAt: deal.updatedAt,
  };
}

export function createSandboxResult(deal: EnterpriseDeal): SandboxProvisionResult | null {
  if (!deal.sandboxSubaccountId) return null;
  return {
    dealId: deal.id,
    subaccountId: deal.sandboxSubaccountId,
    subaccountName: `${deal.companyName} Sandbox Demo`,
    slug: `demo-${deal.companyDomain.split('.')[0]}`,
    allocatedMcu: 1000,
    expiresAt: deal.sandboxExpiresAt || Date.now() + 14 * 86400000,
    sandboxToken: deal.sandboxToken || '',
    demoMagicUrl: `https://sophia.agencyos.network/sandbox/${deal.sandboxToken || ''}`,
    watermarkEnabled: true,
  };
}
