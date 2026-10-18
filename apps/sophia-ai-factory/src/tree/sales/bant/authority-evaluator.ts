/**
 * BANT Authority Factor Evaluator (0–25 points)
 *
 * Layer: tree/sales/bant
 *
 * @module tree/sales/bant/authority-evaluator
 */

import type {
  BantScoreInput,
  BantFactorBreakdown,
} from '@/seed/types/enterprise-deal';
import { isCorporateEmailDomain } from './types';

/**
 * Evaluates the Authority factor (0–25 points).
 */
export function scoreAuthority(input: BantScoreInput): BantFactorBreakdown {
  let score = 0;
  let reason = '';
  const details: Record<string, unknown> = {};

  const title = (input.jobTitle || '').toLowerCase().trim();
  const isCorporate = input.isCorporateEmail ?? isCorporateEmailDomain(input.leadEmail);

  const cLevelRegex = /\b(ceo|chief executive|cto|chief technology|cmo|chief marketing|cro|coo|founder|co-founder|president|owner)\b/i;
  const vpRegex = /\b(vp|vice president|head of|managing director|general manager)\b/i;
  const directorRegex = /\b(director|principal|lead architect|chief architect)\b/i;
  const managerRegex = /\b(senior manager|lead|project lead|team lead|manager)\b/i;

  if (cLevelRegex.test(title)) {
    score = 22;
    reason = 'Executive Decision Maker (C-Level / Founder / President)';
  } else if (vpRegex.test(title)) {
    score = 18;
    reason = 'Senior Leadership (VP / Head of Department / MD)';
  } else if (directorRegex.test(title)) {
    score = 15;
    reason = 'Technical or Business Director / Principal';
  } else if (managerRegex.test(title)) {
    score = 10;
    reason = 'Department Manager / Team Lead';
  } else if (title.length > 0) {
    score = 4;
    reason = 'Individual Contributor / Specialist';
  } else {
    score = 2;
    reason = 'Unspecified role';
  }

  if (isCorporate) {
    score = Math.min(25, score + 3);
    reason += ' + verified corporate domain bonus (+3)';
    details.corporateDomainBonus = true;
  }

  score = Math.max(0, Math.min(25, Math.round(score)));
  details.jobTitle = input.jobTitle || 'N/A';
  details.isCorporateEmail = isCorporate;

  return {
    score,
    maxScore: 25,
    factor: 'authority',
    reason,
    details,
  };
}
