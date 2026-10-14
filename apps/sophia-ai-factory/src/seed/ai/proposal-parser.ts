/**
 * Proposal generator response parser — splits markdown output into proposal sections.
 */

import type { GeneratedProposal } from "./proposal-types";

export function parseProposalContent(content: string): Omit<GeneratedProposal, 'metadata'> {
  const sections = content.split(/\n##\s+/);

  const findSection = (keywords: string[]): string => {
    for (const section of sections) {
      const title = section.split('\n')[0]?.toLowerCase() || '';
      if (keywords.some((k) => title.includes(k))) {
        return section.trim();
      }
    }
    return '';
  };

  return {
    executiveSummary: findSection(['executive', 'summary', 'overview']) || sections[1]?.trim() || '',
    problemStatement: findSection(['problem', 'challenge', 'pain', 'current']) || '',
    proposedSolution: findSection(['solution', 'approach', 'methodology']) || '',
    timeline: findSection(['timeline', 'schedule', 'roadmap']) || '',
    investment: findSection(['investment', 'pricing', 'cost', 'fee']) || '',
    caseStudies: findSection(['case study', 'success story', 'previous work']) || '',
    nextSteps: findSection(['next step', 'call to action', 'get started', 'conclusion']) || '',
  };
}
