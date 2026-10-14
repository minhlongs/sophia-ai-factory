/**
 * Proposal generator shared types.
 */

export interface ProposalGenerationParams {
  clientInfo: {
    name: string;
    company: string;
    industry: string;
    painPoints: string[];
    goals: string[];
  };
  solutionInfo: {
    description: string;
    timeline: string;
    investment: string;
    deliverables: string[];
  };
  companyInfo: {
    name: string;
    caseStudies: Array<{
      title: string;
      result: string;
      metric: string;
    }>;
    differentiators: string[];
  };
  templateId: string;
  tone: 'professional' | 'friendly' | 'technical';
  length: 'short' | 'medium' | 'long';
  apiKey?: string;
}

export interface GeneratedProposal {
  executiveSummary: string;
  problemStatement: string;
  proposedSolution: string;
  timeline: string;
  investment: string;
  caseStudies: string;
  nextSteps: string;
  metadata: {
    tokenCount: number;
    generationTimeMs: number;
    model: string;
  };
}
