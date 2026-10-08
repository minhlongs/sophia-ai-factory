/**
 * @file recruitment-fsm-engine.ts
 * @description Pure domain engine for KOL quality evaluation, split negotiation FSM & CAN-SPAM headers
 * @layer tree
 */

import type { KolScoutInput, KolStatus } from '@/seed/types/growth-triad-v5-types';

export interface KolEvaluationResult {
  engagementRatePct: number;
  qualityScore: number;
  isQualified: boolean;
  disqualificationReason?: string;
}

export function evaluateKolQuality(input: KolScoutInput): KolEvaluationResult {
  const avgInteractionsPerPost = input.samplePostCount > 0
    ? input.totalInteractions / input.samplePostCount
    : 0;

  const engagementRatePct = input.medianViews > 0
    ? (avgInteractionsPerPost / input.medianViews) * 100
    : 0;

  const viewToFollowerRatio = input.followerCount > 0
    ? input.medianViews / input.followerCount
    : 0;

  let isQualified = true;
  let disqualificationReason: string | undefined;

  if (engagementRatePct < 3.0) {
    isQualified = false;
    disqualificationReason = 'Engagement rate below 3.0% threshold';
  } else if (engagementRatePct > 25.0) {
    isQualified = false;
    disqualificationReason = 'Suspicious engagement rate exceeding 25.0%';
  } else if (viewToFollowerRatio < 0.05) {
    isQualified = false;
    disqualificationReason = 'Low viewership velocity relative to followers';
  }

  const qualityScore = Math.min(
    100,
    Math.max(
      0,
      engagementRatePct * 3.5 + Math.min(50, viewToFollowerRatio * 100)
    )
  );

  return {
    engagementRatePct,
    qualityScore,
    isQualified,
    disqualificationReason,
  };
}

export function calculateNegotiatedSplit(
  creatorAskPct: number,
  qualityScore: number,
  baseSplit = 0.20,
  maxSplit = 0.40
): number {
  const normalizedQuality = Math.max(0, Math.min(100, qualityScore)) / 100;
  // Sigmoid progression from base split up to max split
  const leverageWeight = 1 / (1 + Math.exp(-4 * (normalizedQuality - 0.5)));
  const allowableSplit = baseSplit + (maxSplit - baseSplit) * leverageWeight;

  return Math.min(allowableSplit, Math.max(baseSplit, creatorAskPct));
}

export function advanceKolStatusFsm(
  currentStatus: KolStatus,
  action: 'SEND_INTRO' | 'SEND_CASE_STUDY' | 'START_NEGOTIATION' | 'SIGN_AGREEMENT' | 'OPT_OUT'
): KolStatus {
  if (action === 'OPT_OUT') return 'UNSUBSCRIBED';

  switch (currentStatus) {
    case 'SCOUTED':
      return action === 'SEND_INTRO' ? 'OUTREACH_INTRO_SENT' : currentStatus;
    case 'OUTREACH_INTRO_SENT':
      return action === 'SEND_CASE_STUDY' ? 'OUTREACH_CASE_STUDY_SENT' : currentStatus;
    case 'OUTREACH_CASE_STUDY_SENT':
      return action === 'START_NEGOTIATION' ? 'NEGOTIATING_SPLIT' : currentStatus;
    case 'NEGOTIATING_SPLIT':
      return action === 'SIGN_AGREEMENT' ? 'AGREEMENT_SIGNED' : currentStatus;
    default:
      return currentStatus;
  }
}

export function generateCanSpamOneClickHeader(kolId: string, hmacSecret: string): string {
  // Edge-friendly lightweight digest
  let hash = 0;
  const raw = `${kolId}:${hmacSecret}`;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `<https://sophia.agencyos.network/api/optout?id=${kolId}&token=${Math.abs(hash).toString(16)}>`;
}
