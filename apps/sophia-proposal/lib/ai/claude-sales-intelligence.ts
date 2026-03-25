/**
 * AI Sales Intelligence
 *
 * Competitor SWOT analysis and outreach sequence generation via LLM Router.
 * Falls back to static templates on API failure — never breaks the flow.
 */

import { llmGenerate } from './llm-router';
import { CLAUDE_MAX_TOKENS } from './claude-proposal-generator';
import { getModelForCommand, getMaxTokensForCommand } from './command-model-routing';
import { SALES_BATTLECARD_SYSTEM_PROMPT } from './prompts/sales-battlecard-competitor-system-prompt';
import { SALES_OUTREACH_SYSTEM_PROMPT } from './prompts/sales-outreach-sequence-system-prompt';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CompetitorAnalysisParams {
  competitors?: string[];
  product?: string;
  focus_areas?: string[];
}

export interface SwotAnalysis {
  competitor: string;
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  win_strategy: string;
}

export interface OutreachParams {
  prospect_name?: string;
  prospect_company: string;
  prospect_role?: string;
  industry?: string;
  pain_point?: string;
}

export interface OutreachStep {
  day: number;
  subject: string;
  body: string;
  channel: string;
}

// ── Types: Battlecard ────────────────────────────────────────────────────────

export interface BattlecardParams {
  competitor: string;
  product?: string;
}

export interface BattlecardResult {
  competitor: string;
  our_product: string;
  strengths: string[];
  weaknesses_of_competitor: string[];
  key_differentiators: string[];
  objection_handling: Record<string, string>;
  generated_at: string;
}

// ── generateBattlecard ──────────────────────────────────────────────────────

export async function generateBattlecard(params: BattlecardParams): Promise<BattlecardResult> {
  const product = params.product ?? 'Sophia AI Factory';

  const fallback: BattlecardResult = {
    competitor: params.competitor,
    our_product: product,
    strengths: [
      'AI-powered proposal generation in <30s',
      'Integrated video production pipeline',
      'Usage-based MCU pricing — pay for what you use',
      'Full affiliate marketing automation',
    ],
    weaknesses_of_competitor: [
      `${params.competitor} lacks AI video integration`,
      `${params.competitor} uses per-seat pricing (expensive at scale)`,
      `${params.competitor} has no affiliate engine`,
    ],
    key_differentiators: [
      'RaaS model: API-first, automatable',
      'OpenClaw PEV engine for mission orchestration',
      'Multi-channel content generation (blog + social + video)',
    ],
    objection_handling: {
      too_expensive: 'Our MCU model means you only pay for actual AI work. No idle seats.',
      unproven: 'Built by agency operators who understand the proposal-to-close pipeline.',
      switching_cost: 'HubSpot CRM sync means zero data migration needed.',
    },
    generated_at: new Date().toISOString(),
  };

  try {
    const prompt = `Create a sales battlecard for "${product}" vs "${params.competitor}".
Include: 4 strengths of our product, 3 weaknesses of competitor, 3 key differentiators, and objection handling for "too_expensive", "unproven", "switching_cost".
Return JSON: { "strengths": string[], "weaknesses_of_competitor": string[], "key_differentiators": string[], "objection_handling": { "too_expensive": string, "unproven": string, "switching_cost": string } }`;

    const raw = await llmGenerate(prompt, {
      system: SALES_BATTLECARD_SYSTEM_PROMPT,
      maxTokens: getMaxTokensForCommand('sales:battlecard'),
      model: getModelForCommand('sales:battlecard'),
    });
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<BattlecardResult>;
    return {
      ...fallback,
      strengths: parsed.strengths ?? fallback.strengths,
      weaknesses_of_competitor: parsed.weaknesses_of_competitor ?? fallback.weaknesses_of_competitor,
      key_differentiators: parsed.key_differentiators ?? fallback.key_differentiators,
      objection_handling: parsed.objection_handling ?? fallback.objection_handling,
    };
  } catch {
    return fallback;
  }
}

// ── generateCompetitorAnalysis ───────────────────────────────────────────────

export async function generateCompetitorAnalysis(
  params: CompetitorAnalysisParams
): Promise<SwotAnalysis[]> {
  const competitors = params.competitors ?? ['Proposify', 'PandaDoc', 'Qwilr'];
  const product = params.product ?? 'Sophia AI Factory';

  const fallback: SwotAnalysis[] = competitors.map(comp => ({
    competitor: comp,
    swot: {
      strengths: ['Established brand', 'Existing customer base'],
      weaknesses: ['No AI-native workflow', 'Per-seat pricing scales poorly', 'No video integration'],
      opportunities: [`${product} wins on speed + automation`, 'MCU pricing undercuts seat-based'],
      threats: [`${comp} may add AI features`, 'Brand recognition advantage'],
    },
    win_strategy: `Lead with ${product}'s AI speed (<30s proposals) and RaaS API.`,
  }));

  try {
    const focusAreas = (params.focus_areas ?? ['pricing', 'features', 'market position']).join(', ');
    const prompt = `Analyze ${product} vs: ${competitors.join(', ')}.
Focus areas: ${focusAreas}.
For each competitor provide SWOT (4 bullet points each) and a win strategy for ${product}.
Return JSON: { "analyses": [{ "competitor": string, "swot": { "strengths": [], "weaknesses": [], "opportunities": [], "threats": [] }, "win_strategy": string }] }`;

    const raw = await llmGenerate(prompt, {
      maxTokens: getMaxTokensForCommand('sales:competitor-analysis'),
      model: getModelForCommand('sales:competitor-analysis'),
    });
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]) as { analyses?: SwotAnalysis[] };
    if (!Array.isArray(parsed.analyses) || parsed.analyses.length === 0) return fallback;

    return parsed.analyses;
  } catch {
    return fallback;
  }
}

// ── generateOutreachSequence ─────────────────────────────────────────────────

export async function generateOutreachSequence(params: OutreachParams): Promise<OutreachStep[]> {
  const company = params.prospect_company;
  const name = params.prospect_name ?? 'there';
  const role = params.prospect_role ?? 'founder';
  const pain = params.pain_point ?? 'slow proposal turnaround';
  const industry = params.industry ?? 'agency';

  const fallback: OutreachStep[] = [
    {
      day: 1,
      subject: `${company}: Cut proposal time from hours to seconds`,
      body: `Hi ${name},\n\nI noticed ${company} is in the ${industry} space. Many ${role}s tell us their #1 bottleneck is ${pain}.\n\nSophia AI Factory generates client-ready proposals in <30 seconds. Would a 14-day pilot be worth exploring?\n\nBest,\nSophia Team`,
      channel: 'email',
    },
    {
      day: 3,
      subject: `Follow-up — ${company} proposal automation`,
      body: `Hi ${name},\n\nOur agencies report 40% higher close rates after switching to AI-generated proposals.\n\nHere's a 2-min demo: [demo_link]\n\nBest,\nSophia Team`,
      channel: 'email',
    },
    {
      day: 5,
      subject: '[LinkedIn] Connect',
      body: `Hey ${name} — working with teams in ${industry} to automate proposals + content. Thought it'd be relevant.`,
      channel: 'linkedin',
    },
    {
      day: 7,
      subject: `ROI estimate for ${company}`,
      body: `Hi ${name},\n\nQuick estimate for ${company}: ~$12k/month saved, 25x ROI in month one. Want the full breakdown?\n\nBest,\nSophia Team`,
      channel: 'email',
    },
  ];

  try {
    const prompt = `Write a 4-touch outreach sequence for: ${name} at ${company} (${role}).
Industry: ${industry}. Pain point: ${pain}.
Product: Sophia AI Factory (AI proposals in <30s, MCU pricing, video generation).
Touches: Day 1 email, Day 3 email, Day 5 LinkedIn, Day 7 email.
Return JSON: { "sequence": [{ "day": number, "subject": string, "body": string, "channel": string }] }`;

    const raw = await llmGenerate(prompt, {
      system: SALES_OUTREACH_SYSTEM_PROMPT,
      maxTokens: getMaxTokensForCommand('sales:outreach-sequence'),
      model: getModelForCommand('sales:outreach-sequence'),
    });
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]) as { sequence?: OutreachStep[] };
    if (!Array.isArray(parsed.sequence) || parsed.sequence.length === 0) return fallback;

    return parsed.sequence;
  } catch {
    return fallback;
  }
}
