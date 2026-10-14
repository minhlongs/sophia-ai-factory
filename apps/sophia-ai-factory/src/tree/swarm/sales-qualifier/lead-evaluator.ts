import type {
  InboundLeadPayload,
  QualificationResult,
} from '@/seed/types/autonomous-swarm';
import type { BantScoreInput } from '@/seed/types/enterprise-deal';
import {
  calculateBantScore,
  isCorporateEmailDomain,
} from '@/tree/sales/bant-scoring-service';
import { generateBilingualProposal } from './proposal-generator';
import { generateMeetingPrepBrief } from './meeting-brief-generator';

/**
 * Pure function: Qualifies an inbound enterprise lead using BANT framework.
 */
export function qualifyInboundLead(payload: InboundLeadPayload): QualificationResult {
  const isCorporate = isCorporateEmailDomain(payload.leadEmail);
  const notesLower = (payload.notes ?? '').toLowerCase();

  // Extract needs signals from notes and payload
  const needsApacDubbing = notesLower.includes('dub') || notesLower.includes('vietnam') || notesLower.includes('apac') || notesLower.includes('language');
  const needsDedicatedGpuLane = notesLower.includes('gpu') || notesLower.includes('dedicated') || (payload.requestedMcuMonthly ?? 0) >= 50_000;
  const needsHighVolumeSyndication = notesLower.includes('syndicat') || notesLower.includes('bulk') || notesLower.includes('youtube') || notesLower.includes('tiktok');
  const needsCustomApiOrWhiteLabel = notesLower.includes('api') || notesLower.includes('white') || notesLower.includes('reseller');

  const bantInput: BantScoreInput = {
    statedBudgetArr: payload.dealValueEstimateCents
      ? Math.floor(payload.dealValueEstimateCents / 100)
      : undefined,
    statedMonthlyMcu: payload.requestedMcuMonthly,
    jobTitle: payload.leadTitle,
    isCorporateEmail: isCorporate,
    leadEmail: payload.leadEmail,
    needsApacDubbing,
    needsDedicatedGpuLane,
    needsHighVolumeSyndication,
    needsCustomApiOrWhiteLabel,
    statedBottleneckOrPainPoint: payload.notes,
    timeframe: payload.timeframe ?? '1_to_3_months',
  };

  const bantResult = calculateBantScore(bantInput);
  const totalScore = bantResult.totalScore;
  const pipelineTier = bantResult.pipelineTier;

  let dealStage: string;
  let assignedAgentRole: string;
  let autoQualified = false;
  let recommendedTier = 'ENTERPRISE';

  if (pipelineTier === 'hot') {
    dealStage = 'qualified';
    assignedAgentRole = 'ai_sales_executive';
    autoQualified = true;
    recommendedTier = (payload.requestedMcuMonthly ?? 0) >= 200_000 ? 'MASTER' : 'ENTERPRISE';
  } else if (pipelineTier === 'warm') {
    dealStage = 'enriching';
    assignedAgentRole = 'ai_sales_executive';
    autoQualified = false;
    recommendedTier = 'PREMIUM';
  } else {
    dealStage = 'new_lead';
    assignedAgentRole = 'unassigned';
    autoQualified = false;
    recommendedTier = 'BASIC';
  }

  const scoringFactors = {
    budgetScore: bantResult.budgetScore,
    authorityScore: bantResult.authorityScore,
    needScore: bantResult.needScore,
    timelineScore: bantResult.timelineScore,
  };

  const dealId = `deal_${payload.companyDomain.replace(/[^a-zA-Z0-9]/g, '_')}_${Math.random().toString(16).slice(2, 10)}`;

  const proposalContent = (pipelineTier === 'hot' || pipelineTier === 'warm')
    ? generateBilingualProposal(payload, totalScore, recommendedTier)
    : undefined;

  const meetingPrepBrief = generateMeetingPrepBrief(payload, {
    bantScore: totalScore,
    pipelineTier,
    scoringFactors,
  });

  return {
    dealId,
    bantScore: totalScore,
    pipelineTier,
    dealStage,
    assignedAgentRole,
    proposalContent,
    meetingPrepBrief,
    autoQualified,
    scoringFactors,
  };
}
