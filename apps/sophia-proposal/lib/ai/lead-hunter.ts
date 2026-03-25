/**
 * LeadHunter — AI-powered lead generation via LLM Router.
 *
 * Generates qualified prospect lists based on ICP (Ideal Customer Profile).
 * Uses LLM to research and score leads by industry, company size, and pain points.
 */

import { llmGenerate } from './llm-router';
import { getModelForCommand, getMaxTokensForCommand } from './command-model-routing';
import { LEAD_GENERATION_SYSTEM_PROMPT } from './prompts/lead-generation-icp-system-prompt';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LeadHunterParams {
  industry: string;
  company_size?: string;
  region?: string;
  pain_points?: string[];
  max_leads?: number;
}

export interface GeneratedLead {
  company_name: string;
  industry: string;
  estimated_size: string;
  decision_maker_title: string;
  pain_points: string[];
  fit_score: number; // 1-10
  approach_angle: string;
  suggested_first_touch: string;
}

export interface LeadHunterResult {
  leads: GeneratedLead[];
  icp_summary: string;
  generated_at: string;
}

// ── Lead Generation ──────────────────────────────────────────────────────────

export async function generateLeads(params: LeadHunterParams): Promise<LeadHunterResult> {
  const industry = params.industry;
  const size = params.company_size ?? '10-200 employees';
  const region = params.region ?? 'Global';
  const painPoints = params.pain_points ?? ['slow proposal creation', 'manual content production'];
  const maxLeads = Math.min(params.max_leads ?? 10, 20);

  const fallback: LeadHunterResult = {
    leads: [
      {
        company_name: `Sample ${industry} Agency`,
        industry,
        estimated_size: size,
        decision_maker_title: 'CEO / Founder',
        pain_points: painPoints,
        fit_score: 7,
        approach_angle: 'AI automation for proposal pipeline',
        suggested_first_touch: `Hi — noticed your team at Sample ${industry} Agency is growing. Many ${industry} companies use Sophia AI to cut proposal time from 8h to 30s. Worth a quick chat?`,
      },
    ],
    icp_summary: `${industry} companies, ${size}, ${region}`,
    generated_at: new Date().toISOString(),
  };

  try {
    const prompt = `You are a B2B sales research expert. Generate ${maxLeads} realistic prospect leads for an AI proposal automation SaaS product (Sophia AI Factory).

Target ICP:
- Industry: ${industry}
- Company size: ${size}
- Region: ${region}
- Pain points: ${painPoints.join(', ')}

For each lead provide:
- company_name (realistic but fictional)
- industry
- estimated_size
- decision_maker_title (CEO, VP Sales, Head of Ops, etc.)
- pain_points (2-3 specific to that company)
- fit_score (1-10, how well they match ICP)
- approach_angle (one sentence on WHY they'd buy)
- suggested_first_touch (personalized opening message, 2-3 sentences)

Return JSON: { "leads": [...], "icp_summary": string }`;

    const raw = await llmGenerate(prompt, {
      system: LEAD_GENERATION_SYSTEM_PROMPT,
      maxTokens: getMaxTokensForCommand('lead:generate'),
      jsonMode: true,
      model: getModelForCommand('lead:generate'),
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<LeadHunterResult>;
    if (!Array.isArray(parsed.leads) || parsed.leads.length === 0) return fallback;

    return {
      leads: parsed.leads.slice(0, maxLeads),
      icp_summary: parsed.icp_summary ?? fallback.icp_summary,
      generated_at: new Date().toISOString(),
    };
  } catch {
    return fallback;
  }
}
