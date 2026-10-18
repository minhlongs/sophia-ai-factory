import type { GeneratedProposal } from './proposal-generator';
import {
  extractQualitySignals,
  scoreFormattingAndSpecificity,
  type QualityCheckResult,
} from './proposal-quality-signals';

export { extractQualitySignals, type QualityCheckResult };

const REQUIRED_SECTIONS: Array<keyof GeneratedProposal> = [
  'executiveSummary',
  'problemStatement',
  'proposedSolution',
  'timeline',
  'investment',
  'nextSteps',
];

export function checkProposalQuality(
  proposal: GeneratedProposal,
  minLength: number = 1500,
): QualityCheckResult {
  const feedback: string[] = [];

  let completeSections = 0;
  for (const section of REQUIRED_SECTIONS) {
    const content = proposal[section] as string;
    if (content && content.length > 50) {
      completeSections++;
    } else {
      feedback.push(`Missing or too short: ${section}`);
    }
  }
  let completeness = (completeSections / REQUIRED_SECTIONS.length) * 100;

  const { executiveSummary, problemStatement, proposedSolution } = proposal;
  const hasCoreFlow =
    Boolean(executiveSummary && executiveSummary.length > 100) &&
    Boolean(problemStatement && problemStatement.length > 100) &&
    Boolean(proposedSolution && proposedSolution.length > 100);
  const coherence = hasCoreFlow ? 85 : 50;
  if (!hasCoreFlow) {
    feedback.push('Some sections lack sufficient content for coherent flow');
  }

  const allContent = Object.values(proposal).join(' ');
  const { specificity, professionalism } = scoreFormattingAndSpecificity(allContent, feedback);

  const nextSteps = proposal.nextSteps || '';
  const actionWords = /schedule|call|meeting|contact|get started|next step|click here/i;
  const hasDeadline = /within|by [A-Z]|deadline|offer expires/i;

  let actionability = 50;
  if (actionWords.test(nextSteps) && nextSteps.length > 50) {
    actionability = hasDeadline.test(nextSteps) ? 95 : 85;
  } else {
    feedback.push('Next steps lack clear call-to-action or deadline');
  }

  const overallScore = Math.round(
    completeness * 0.25 +
      coherence * 0.2 +
      specificity * 0.2 +
      actionability * 0.2 +
      professionalism * 0.15,
  );

  const totalLength = Object.values(proposal)
    .filter((v) => typeof v === 'string')
    .join(' ').length;

  if (totalLength < minLength) {
    feedback.push(`Proposal too short (${totalLength} chars, minimum ${minLength})`);
    completeness = Math.min(completeness, 60);
  }

  return {
    overallScore,
    scores: {
      completeness,
      coherence,
      specificity,
      actionability,
      professionalism,
    },
    feedback,
    passed: overallScore >= 80 && feedback.length <= 2,
  };
}
