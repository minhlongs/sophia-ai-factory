import type { GeneratedProposal } from './proposal-generator';

export interface QualityCheckResult {
  overallScore: number;
  scores: {
    completeness: number;
    coherence: number;
    specificity: number;
    actionability: number;
    professionalism: number;
  };
  feedback: string[];
  passed: boolean;
}

export function scoreFormattingAndSpecificity(
  allContent: string,
  feedback: string[],
): { specificity: number; professionalism: number } {
  const hasNumbers = /\d+%|\$\d+|\d+ weeks?|\d+ days?|\d+ months?/.test(allContent);
  const hasMetrics = /ROI|conversion|revenue|growth|increase|decrease/i.test(allContent);

  let specificity = 40;
  if (hasNumbers && hasMetrics) {
    specificity = 90;
  } else if (hasNumbers || hasMetrics) {
    specificity = 70;
    feedback.push('Add more specific metrics and numbers');
  } else {
    feedback.push('Lacks specific numbers and measurable outcomes');
  }

  const hasMarkdownHeaders = /^## |^### /m.test(allContent);
  const hasBulletPoints = /^[-*] /m.test(allContent);
  const hasBoldText = /\*\*.*\*\*/.test(allContent);

  let professionalism = 40;
  if (hasMarkdownHeaders && hasBulletPoints && hasBoldText) {
    professionalism = 90;
  } else if (hasMarkdownHeaders || hasBulletPoints) {
    professionalism = 70;
    feedback.push('Improve formatting with headers, bullets, and emphasis');
  } else {
    feedback.push('Poor formatting - add structure with headers and lists');
  }

  return { specificity, professionalism };
}

export function extractQualitySignals(proposal: GeneratedProposal): {
  wordCount: number;
  sectionCount: number;
  hasCaseStudies: boolean;
  hasNumbers: boolean;
  hasCallToAction: boolean;
} {
  const allContent = Object.values(proposal)
    .filter((v) => typeof v === 'string')
    .join(' ');

  return {
    wordCount: allContent.split(/\s+/).length,
    sectionCount: Object.keys(proposal).filter((k) => k !== 'metadata').length,
    hasCaseStudies: /case study|success story|client result|similar/i.test(allContent),
    hasNumbers: /\d+%|\$\d+|\d+ weeks?|\d+ days?/.test(allContent),
    hasCallToAction: /schedule|call|meeting|contact|get started|next step/i.test(
      proposal.nextSteps || '',
    ),
  };
}
