/**
 * Default Battlecards and Prompt Builder for AI Sales Meeting Prep Dossier Service.
 * @module tree/sales/meeting-prep-prompts
 */

import type {
  EnterpriseDeal,
  BattlecardItem,
  EnterpriseLeadEnrichment,
} from '@/seed/types/enterprise-deal';

export const DEFAULT_BATTLECARDS: BattlecardItem[] = [
  {
    competitorOrObjection: 'Traditional Video Production Agency',
    ourDifferentiator: '100x Faster & 10x Lower Unit Cost ($0.05/video vs $150/video)',
    talkingPoint:
      'Agencies take 2–3 weeks to script, record, and edit a single localized video. Sophia AI Factory renders studio-grade 1080p video in 5 APAC languages in under 90 seconds directly at the Cloudflare edge.',
  },
  {
    competitorOrObjection: 'Standalone Tools (HeyGen / Runway alone)',
    ourDifferentiator: 'End-to-End Autonomous Pipeline & Omnichannel Syndication',
    talkingPoint:
      'Point solutions require humans to copy-paste prompts, download MP4s, and re-upload manually. Sophia AI Factory provides fully autonomous ingestion, AI voice dubbing, creator marketplace hooks, and automated APAC peak-time syndication to YouTube Shorts, TikTok, and Reels.',
  },
  {
    competitorOrObjection: 'Data Security, Compliance & Deepfake Risk',
    ourDifferentiator: 'Cryptographic Hash-Chain Audit Vault & Dedicated Tenant Isolation',
    talkingPoint:
      'Every video frame and voice prompt is logged with SHA-256 hash chains conforming to SOC 2 CC7.2. Enterprise customers retain complete BYOK API key ownership, watermarking, and subaccount isolation.',
  },
];

export function buildMeetingPrepPrompt(
  deal: EnterpriseDeal,
  enrichment: EnterpriseLeadEnrichment | null,
): string {
  return `You are the Lead Enterprise Solutions Architect for Sophia AI Factory ($200K MRR scale-up).
Prepare an executive sales meeting briefing dossier for the following prospect:

Company: ${deal.companyName} (Domain: ${deal.companyDomain})
Lead: ${deal.leadName}, ${deal.leadTitle || 'Leader'} (${deal.leadEmail})
Industry: ${enrichment?.industry || 'Digital Technology & Media'}
Employee Count: ${enrichment?.employeeCountRange || '50-250'}
Estimated Revenue: ${enrichment?.estimatedAnnualRevenue || '$10M-$50M'}
Stated Needs & Notes: ${deal.notes || 'Scaling multi-language video production and social distribution'}
BANT Score: ${deal.bantScore}/100 (${deal.pipelineTier})

Generate a concise, high-impact executive dossier with JSON keys:
1. "companyOverview": 2-3 sentences on their business model and strategic relevance.
2. "keyStakeholders": Who the key buyers are and how to navigate executive sign-off.
3. "painPointAnalysis": 2-3 specific bottlenecks in their current manual video workflow.
4. "proposedSolutionBlueprint": Recommended architecture (e.g. APAC 5-language dubbing, dedicated GPU lane, automated YouTube/TikTok syndication).
5. "commercialRecommendation": Specific tier recommendation (e.g. 100K MCU/mo at $4,500/mo) with volume discount and 14-day sandbox demo.`;
}
