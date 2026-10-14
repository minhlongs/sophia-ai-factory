/**
 * AI Meeting & Demo Prep Dossier Service
 *
 * Generates comprehensive executive sales dossiers for enterprise prospects:
 * - Company & Stakeholder Snapshot
 * - Quantified Pain Point & Bottleneck Analysis
 * - Tailored Sophia AI Factory Solution Blueprint
 * - Competitive Battlecards & Objection Handling
 * - Commercial Deal Recommendation
 *
 * Layer: tree/sales (Pure domain logic - imports only @/seed and tree siblings)
 *
 * @module tree/sales/meeting-prep-service
 */

import type { D1Database } from '@/seed/db/client';
import type {
  EnterpriseDeal,
  MeetingPrepDossier,
  BattlecardItem,
} from '@/seed/types/enterprise-deal';
import { logger } from '@/seed/utils/logger-utility';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import {
  getEnterpriseDealById,
  updateEnterpriseDeal,
  getLeadEnrichmentByDomain,
} from './enterprise-deal-repo';
import {
  DEFAULT_BATTLECARDS,
  buildMeetingPrepPrompt,
} from './meeting-prep-prompts';

/**
 * Builds the executive dossier briefing in markdown format.
 */
export function formatDossierMarkdown(
  deal: EnterpriseDeal, companyOverview: string, keyStakeholders: string,
  painPointAnalysis: string, proposedSolutionBlueprint: string,
  commercialRecommendation: string, battlecards: BattlecardItem[]
): string {
  const battlecardSections = battlecards
    .map((b) => `#### Objection / Competitor: ${b.competitorOrObjection}\n- **Our Edge:** ${b.ourDifferentiator}\n- **Executive Response:** ${b.talkingPoint}`)
    .join('\n\n');

  return `# Executive Sales Dossier: ${deal.companyName}
**Generated Date:** ${new Date().toISOString().split('T')[0]}  
**Lead Contact:** ${deal.leadName} (${deal.leadTitle || 'Executive'}, ${deal.leadEmail})  
**Pipeline Tier:** ${deal.pipelineTier.toUpperCase()} (BANT Score: ${deal.bantScore}/100)  
**Estimated Annual Contract:** $${((deal.dealValueEstimateCents || 0) / 100).toLocaleString()} USD  

---

## 1. Company & Stakeholder Snapshot
${companyOverview}

**Key Stakeholders & Decision Flow:**  
${keyStakeholders}

---

## 2. Quantified Pain Points & Automation Opportunities
${painPointAnalysis}

---

## 3. Recommended Sophia AI Factory Solution Blueprint
${proposedSolutionBlueprint}

---

## 4. Competitive Battlecards & Objection Playbook
${battlecardSections}

---

## 5. Commercial Recommendation & Pilot Terms
${commercialRecommendation}
`;
}

/**
 * Generates an executive sales briefing dossier for a given deal.
 */
export async function generateMeetingPrepDossier(
  db: D1Database,
  dealId: string,
  openRouterApiKey?: string
): Promise<MeetingPrepDossier> {
  const deal = await getEnterpriseDealById(db, dealId);
  if (!deal) {
    throw new Error(`Enterprise deal not found: ${dealId}`);
  }

  const enrichment = await getLeadEnrichmentByDomain(db, deal.companyDomain);
  const prompt = buildMeetingPrepPrompt(deal, enrichment);

  let companyOverview = `${deal.companyName} is an expanding organization in ${enrichment?.industry || 'Digital Media'} evaluating enterprise AI video infrastructure.`;
  let keyStakeholders = `${deal.leadName} (${deal.leadTitle || 'Executive'}) represents the primary champion. Sign-off likely involves CMO and CTO for compliance.`;
  let painPointAnalysis = `Manual video localization in APAC markets costs ~$150/video with 2-week turnaround, causing significant lag in short-form social engagement and creator fatigue.`;
  let proposedSolutionBlueprint = `Deploy Sophia AI Factory 5-Language Video Dubbing (VI, EN, JA, KO, TH) with edge HLS rendering, automated TikTok/YouTube Shorts syndication, and dedicated GPU lane isolation.`;
  let commercialRecommendation = `Propose Enterprise Growth Tier: 100,000 MCU/month ($4,500/month or $45,000/year annual with 17% savings). Activate 1,000 demo MCU sandbox workspace today.`;

  try {
    const raw = await resilientChatCompletion(prompt, {
      openRouterKey: openRouterApiKey || process.env.OPENROUTER_API_KEY || null,
      model: 'openai/gpt-4o-mini',
    });

    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.companyOverview) companyOverview = parsed.companyOverview;
    if (parsed.keyStakeholders) keyStakeholders = parsed.keyStakeholders;
    if (parsed.painPointAnalysis) painPointAnalysis = parsed.painPointAnalysis;
    if (parsed.proposedSolutionBlueprint) proposedSolutionBlueprint = parsed.proposedSolutionBlueprint;
    if (parsed.commercialRecommendation) commercialRecommendation = parsed.commercialRecommendation;
  } catch (err) {
    logger.warn('[meeting-prep] OpenRouter inference unavailable, generated structured deterministic dossier', {
      dealId,
      error: String(err),
    });
  }

  const fullBriefMarkdown = formatDossierMarkdown(
    deal, companyOverview, keyStakeholders, painPointAnalysis,
    proposedSolutionBlueprint, commercialRecommendation, DEFAULT_BATTLECARDS
  );

  // Update deal with meeting brief and transition stage to demo_prepared
  await updateEnterpriseDeal(db, dealId, {
    meetingPrepBrief: fullBriefMarkdown,
    dealStage: deal.dealStage === 'new_lead' || deal.dealStage === 'qualified' ? 'demo_prepared' : deal.dealStage,
  });

  return {
    dealId, companyOverview, keyStakeholders, painPointAnalysis,
    proposedSolutionBlueprint, commercialRecommendation,
    battlecards: DEFAULT_BATTLECARDS, fullBriefMarkdown, generatedAt: Date.now(),
  };
}
