/**
 * Multi-Agent Pre-Render Creative Deliberation Consensus Engine
 * Layer: tree/growth-v13 | Max LOC: < 200 | Zero :any | Zero IO
 * @module tree/growth-v13/deliberation-consensus
 */

import {
  LensEvaluation,
  CreativeDeliberationReport,
  DeliberationVerdict,
} from '@/seed/types/growth-triad-v13';
import { DELIBERATION_CONFIG } from '@/seed/config/growth/bandit-weights';

export function calculateDeliberationComposite(
  evaluations: LensEvaluation[]
): number {
  let composite = 0;
  for (const evalItem of evaluations) {
    switch (evalItem.lens) {
      case 'HOOK_ANALYST':
        composite += evalItem.score * DELIBERATION_CONFIG.WEIGHT_HOOK_ANALYST;
        break;
      case 'RETENTION_CRITIC':
        composite += evalItem.score * DELIBERATION_CONFIG.WEIGHT_RETENTION_CRITIC;
        break;
      case 'COMPLIANCE_GUARD':
        composite += evalItem.score * DELIBERATION_CONFIG.WEIGHT_COMPLIANCE_GUARD;
        break;
    }
  }
  return Number(composite.toFixed(2));
}

export function determineDeliberationVerdict(
  compositeScore: number,
  evaluations: LensEvaluation[]
): DeliberationVerdict {
  const complianceEval = evaluations.find((e) => e.lens === 'COMPLIANCE_GUARD');
  if (complianceEval && complianceEval.score < DELIBERATION_CONFIG.COMPLIANCE_HARD_FLOOR) {
    return 'REJECTED';
  }

  if (compositeScore >= DELIBERATION_CONFIG.MIN_PASSING_SCORE) {
    return 'APPROVED';
  }
  if (compositeScore >= DELIBERATION_CONFIG.AUTO_REVISE_THRESHOLD) {
    return 'REVISE';
  }
  return 'REJECTED';
}

export function aggregateDeliberationReport(
  scriptId: string,
  userId: string,
  originalScript: string,
  evaluations: [LensEvaluation, LensEvaluation, LensEvaluation],
  refinedScript?: string
): CreativeDeliberationReport {
  const compositeScore = calculateDeliberationComposite(evaluations);
  const verdict = determineDeliberationVerdict(compositeScore, evaluations);

  return {
    scriptId,
    userId,
    originalScript,
    compositeScore,
    verdict,
    evaluations,
    refinedScript: verdict === 'REVISE' ? refinedScript : undefined,
  };
}
