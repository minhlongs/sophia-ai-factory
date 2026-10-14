import type { InboundLeadPayload } from '@/seed/types/autonomous-swarm';

/**
 * Generates an internal Meeting Prep Brief for account executives.
 */
export function generateMeetingPrepBrief(
  lead: InboundLeadPayload,
  result: {
    bantScore: number;
    pipelineTier: string;
    scoringFactors: { budgetScore: number; authorityScore: number; needScore: number; timelineScore: number };
  }
): string {
  return `
[AI SALES QUALIFIER BRIEF]
Company: ${lead.companyName} | Domain: ${lead.companyDomain}
Lead: ${lead.leadName} (${lead.leadTitle ?? 'Title Not Specified'})
Tier: ${result.pipelineTier.toUpperCase()} (${result.bantScore}/100)
Scores: Budget=${result.scoringFactors.budgetScore}/25, Authority=${result.scoringFactors.authorityScore}/25, Need=${result.scoringFactors.needScore}/25, Timeline=${result.scoringFactors.timelineScore}/25

Key Discovery Questions:
1. What is the current bottleneck in ${lead.companyName}'s localized video output?
2. Are they currently evaluating external GPU clusters or in-house models?
3. What is their target timeline for full regional syndication rollout?
Recommended Strategy:
- For Hot Tier: Immediately provision demo sandbox and present 99.999% SLA commitment.
- For Warm Tier: Schedule 20-min technical discovery and share APAC dubbing benchmarks.
`.trim();
}
