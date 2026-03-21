import { GeneratedProposal } from "./client";

/**
 * Quality check for AI-generated proposals
 * Returns a score 0-100 and feedback
 */
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

export function checkProposalQuality(
  proposal: GeneratedProposal,
  minLength: number = 1500
): QualityCheckResult {
  const feedback: string[] = [];
  const scores = {
    completeness: 0,
    coherence: 0,
    specificity: 0,
    actionability: 0,
    professionalism: 0,
  };

  // 1. Completeness - Check all required sections exist
  const requiredSections = [
    "executiveSummary",
    "problemStatement",
    "proposedSolution",
    "timeline",
    "investment",
    "nextSteps",
  ];

  let completeSections = 0;
  for (const section of requiredSections) {
    const content = proposal[section as keyof GeneratedProposal] as string;
    if (content && content.length > 50) {
      completeSections++;
    } else {
      feedback.push(`Missing or too short: ${section}`);
    }
  }
  scores.completeness = (completeSections / requiredSections.length) * 100;

  // 2. Coherence - Check logical flow (simple heuristic)
  const { executiveSummary, problemStatement, proposedSolution } = proposal;
  if (
    executiveSummary &&
    problemStatement &&
    proposedSolution &&
    executiveSummary.length > 100 &&
    problemStatement.length > 100 &&
    proposedSolution.length > 100
  ) {
    scores.coherence = 85;
  } else {
    scores.coherence = 50;
    feedback.push("Some sections lack sufficient content for coherent flow");
  }

  // 3. Specificity - Check for numbers and metrics
  const allContent = Object.values(proposal).join(" ");
  const hasNumbers = /\d+%|\$\d+|\d+ weeks?|\d+ days?|\d+ months?/.test(allContent);
  const hasMetrics = /ROI|conversion|revenue|growth|increase|decrease/i.test(allContent);

  if (hasNumbers && hasMetrics) {
    scores.specificity = 90;
  } else if (hasNumbers || hasMetrics) {
    scores.specificity = 70;
    feedback.push("Add more specific metrics and numbers");
  } else {
    scores.specificity = 40;
    feedback.push("Lacks specific numbers and measurable outcomes");
  }

  // 4. Actionability - Check for clear next steps
  const nextSteps = proposal.nextSteps || "";
  const actionWords = /schedule|call|meeting|contact|get started|next step|click here/i;
  const hasDeadline = /within|by [A-Z]|deadline|offer expires/i;

  if (actionWords.test(nextSteps) && nextSteps.length > 50) {
    scores.actionability = hasDeadline.test(nextSteps) ? 95 : 85;
  } else {
    scores.actionability = 50;
    feedback.push("Next steps lack clear call-to-action or deadline");
  }

  // 5. Professionalism - Check for typos and formatting (basic)
  const hasMarkdownHeaders = /^## |^### /m.test(allContent);
  const hasBulletPoints = /^[-*] /m.test(allContent);
  const hasBoldText = /\*\*.*\*\*/.test(allContent);

  if (hasMarkdownHeaders && hasBulletPoints && hasBoldText) {
    scores.professionalism = 90;
  } else if (hasMarkdownHeaders || hasBulletPoints) {
    scores.professionalism = 70;
    feedback.push("Improve formatting with headers, bullets, and emphasis");
  } else {
    scores.professionalism = 40;
    feedback.push("Poor formatting - add structure with headers and lists");
  }

  // Calculate overall score (weighted average)
  const weights = {
    completeness: 0.25,
    coherence: 0.2,
    specificity: 0.2,
    actionability: 0.2,
    professionalism: 0.15,
  };

  const overallScore = Math.round(
    scores.completeness * weights.completeness +
      scores.coherence * weights.coherence +
      scores.specificity * weights.specificity +
      scores.actionability * weights.actionability +
      scores.professionalism * weights.professionalism
  );

  // Minimum length check
  const totalLength = Object.values(proposal)
    .filter((v) => typeof v === "string")
    .join(" ").length;

  if (totalLength < minLength) {
    feedback.push(`Proposal too short (${totalLength} chars, minimum ${minLength})`);
    scores.completeness = Math.min(scores.completeness, 60);
  }

  return {
    overallScore,
    scores,
    feedback,
    passed: overallScore >= 80 && feedback.length <= 2,
  };
}

/**
 * Extract quality signals from proposal for analytics
 */
export function extractQualitySignals(proposal: GeneratedProposal): {
  wordCount: number;
  sectionCount: number;
  hasCaseStudies: boolean;
  hasNumbers: boolean;
  hasCallToAction: boolean;
} {
  const allContent = Object.values(proposal).filter((v) => typeof v === "string").join(" ");

  return {
    wordCount: allContent.split(/\s+/).length,
    sectionCount: Object.keys(proposal).filter((k) => k !== "metadata").length,
    hasCaseStudies: /case study|success story|client result|similar/i.test(allContent),
    hasNumbers: /\d+%|\$\d+|\d+ weeks?|\d+ days?/.test(allContent),
    hasCallToAction: /schedule|call|meeting|contact|get started|next step/i.test(
      proposal.nextSteps || ""
    ),
  };
}
