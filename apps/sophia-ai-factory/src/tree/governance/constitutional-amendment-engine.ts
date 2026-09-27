/**
 * @file constitutional-amendment-engine.ts
 * @layer tree/governance
 * @description Pure domain engine for Autonomous Constitutional Amendment verification and anti-takeover invariants.
 */

import {
  ConstitutionalAmendmentProposal,
  RatificationStatus,
} from '@/seed/types/zk-mpc-constitution';

/**
 * Immutable articles that cannot be repealed or altered by any legislative majority
 */
const IMMUTABLE_CONSTITUTIONAL_ARTICLES = [
  'CONST_ARTICLE_I_FUNDAMENTAL_HUMAN_SOVEREIGNTY',
  'CONST_ARTICLE_IV_ANTI_CENTRALIZED_COERCION',
  'CONST_ARTICLE_VII_MANDATORY_RESERVE_SOLVENCY',
  'CONST_ARTICLE_XII_AI_AUTONOMOUS_PEACE_PACT',
];

export interface ConstitutionalEvaluationResult {
  ratificationStatus: RatificationStatus;
  affirmativeRatioBps: number;
  isSupermajorityMet: boolean;
  antiTakeoverGuardrailIntact: boolean;
  timelockEnactmentAt?: string;
  rejectionReason?: string;
}

/**
 * Evaluates an amendment proposal against constitutional invariants and voting power
 */
export function evaluateConstitutionalAmendment(
  proposal: ConstitutionalAmendmentProposal,
  affirmativeWeight: number,
  dissentingWeight: number
): ConstitutionalEvaluationResult {
  const totalWeight = affirmativeWeight + dissentingWeight;
  if (totalWeight <= 0) {
    return {
      ratificationStatus: 'PROPOSED',
      affirmativeRatioBps: 0,
      isSupermajorityMet: false,
      antiTakeoverGuardrailIntact: true,
      rejectionReason: 'Total voting weight must be strictly positive',
    };
  }

  // 1. Anti-Takeover Guardrail: check immutable articles
  if (IMMUTABLE_CONSTITUTIONAL_ARTICLES.includes(proposal.articleReference)) {
    return {
      ratificationStatus: 'VETOED_UNCONSTITUTIONAL',
      affirmativeRatioBps: 0,
      isSupermajorityMet: false,
      antiTakeoverGuardrailIntact: false,
      rejectionReason: `Article ${proposal.articleReference} is immutable under the Perpetual Sovereignty Charter`,
    };
  }

  // 2. Formal Verification Check
  if (!proposal.formalVerificationPassed) {
    return {
      ratificationStatus: 'VETOED_UNCONSTITUTIONAL',
      affirmativeRatioBps: 0,
      isSupermajorityMet: false,
      antiTakeoverGuardrailIntact: true,
      rejectionReason: 'Proposal failed formal mathematical verification under Lean 4 theorem checker',
    };
  }

  // 3. Supermajority Voting Check (e.g. 7500 bps = 75.00%)
  const affirmativeRatioBps = Math.round((affirmativeWeight / totalWeight) * 10000);
  const isSupermajorityMet = affirmativeRatioBps >= proposal.supermajorityRequirementBps;

  if (!isSupermajorityMet) {
    return {
      ratificationStatus: 'DELIBERATING',
      affirmativeRatioBps,
      isSupermajorityMet: false,
      antiTakeoverGuardrailIntact: true,
      rejectionReason: `Affirmative voting power ${affirmativeRatioBps / 100}% has not reached required supermajority ${proposal.supermajorityRequirementBps / 100}%`,
    };
  }

  // 4. Enact with mandatory 72-hour timelock
  const timelockEnactmentAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();

  return {
    ratificationStatus: 'RATIFIED_INTO_LAW',
    affirmativeRatioBps,
    isSupermajorityMet: true,
    antiTakeoverGuardrailIntact: true,
    timelockEnactmentAt,
  };
}
