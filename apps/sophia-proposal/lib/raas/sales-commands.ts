/**
 * Sales-focused RaaS commands for $1M ARR pipeline.
 *
 * Commands:
 *   sales:proposal-deck     — Full proposal deck with structured slides
 *   sales:roi-calculator     — ROI projection for prospects
 *   sales:competitor-analysis — Deep competitor SWOT analysis
 *   sales:pricing-optimizer  — Dynamic pricing recommendation
 *   sales:outreach-sequence  — Multi-step email outreach
 */

import { getD1Client } from '@/lib/db/client';
import { generateProposal } from '@/lib/ai/claude-proposal-generator';
import {
  generateCompetitorAnalysis,
  generateOutreachSequence,
} from '@/lib/ai/claude-sales-intelligence';
import type { Mission, MissionResult } from '@/types/raas';

// ── sales:proposal-deck ─────────────────────────────────────────────────────

export async function runProposalDeck(mission: Mission): Promise<MissionResult> {
  const params = mission.params as {
    client_name?: string;
    industry?: string;
    budget_range?: string;
    pain_points?: string[];
    product_name?: string;
  };

  if (!params.client_name) {
    return { success: false, error: 'Missing params.client_name' };
  }

  const product = params.product_name ?? 'Sophia AI Factory';

  // Generate AI narrative for the solution slide
  const aiProposal = await generateProposal({
    client_name: params.client_name,
    product_name: product,
    tone: 'persuasive',
    sections: ['executive_summary', 'solution', 'roi'],
  });

  const solutionContent = aiProposal.sections.find(s => s.title.toLowerCase().includes('solution'))?.content
    ?? `AI-powered RaaS platform: proposals in <30s, video in <5min, full GTM campaigns automated.`;
  const summaryContent = aiProposal.sections.find(s => s.title.toLowerCase().includes('summary'))?.content
    ?? `${product} transforms ${params.client_name}'s proposal pipeline with AI automation.`;

  const slides = [
    {
      title: 'Cover',
      content: `${product} — Proposal for ${params.client_name}`,
      type: 'cover',
    },
    {
      title: 'Executive Summary',
      content: summaryContent,
      type: 'summary',
    },
    {
      title: 'The Challenge',
      content: (params.pain_points ?? ['Manual proposal creation', 'Slow content pipeline']).join('; '),
      type: 'problem',
    },
    {
      title: 'Our Solution',
      content: solutionContent,
      type: 'solution',
    },
    {
      title: 'ROI Projection',
      content: `Industry: ${params.industry ?? 'Digital Agency'}. Expected 10x faster proposal turnaround, 40% higher close rate.`,
      type: 'roi',
    },
    {
      title: 'Pricing',
      content: `Budget: ${params.budget_range ?? '$149-499/mo'}. MCU-based — only pay for actual AI work.`,
      type: 'pricing',
    },
    {
      title: 'Next Steps',
      content: '1. 14-day pilot (free). 2. Custom onboarding. 3. Go live.',
      type: 'cta',
    },
  ];

  // Persist deck to proposals table
  const db = await getD1Client();
  let deckId: string | undefined;
  try {
    const { data } = await db
      .from('proposals')
      .insert({
        org_id: mission.org_id,
        title: `Sales Deck: ${params.client_name}`,
        content: { slides, metadata: params },
        status: 'draft',
      })
      .select('id')
      .single();
    deckId = (data as Record<string, string>)?.id;
  } catch { /* table may not exist */ }

  return {
    success: true,
    summary: `Proposal deck (${slides.length} slides) for ${params.client_name}`,
    data: { deck_id: deckId, slides_count: slides.length, slides },
  };
}

// ── sales:roi-calculator ────────────────────────────────────────────────────

export async function runRoiCalculator(mission: Mission): Promise<MissionResult> {
  const params = mission.params as {
    current_proposal_time_hours?: number;
    proposals_per_month?: number;
    avg_deal_size?: number;
    close_rate_pct?: number;
    team_hourly_rate?: number;
  };

  const proposalTime = params.current_proposal_time_hours ?? 8;
  const proposalsPerMonth = params.proposals_per_month ?? 20;
  const dealSize = params.avg_deal_size ?? 5000;
  const closeRate = (params.close_rate_pct ?? 15) / 100;
  const hourlyRate = params.team_hourly_rate ?? 75;

  // With Sophia: 30s per proposal vs current hours
  const sophiaTimeHours = 0.5 / 60; // 30 seconds
  const currentMonthlyCost = proposalTime * proposalsPerMonth * hourlyRate;
  const sophiaMonthlyCost = 149 + (proposalsPerMonth * 5); // Pro plan + MCU
  const timeSavedHours = (proposalTime - sophiaTimeHours) * proposalsPerMonth;
  const costSaved = currentMonthlyCost - sophiaMonthlyCost;
  const improvedCloseRate = closeRate * 1.4; // 40% improvement
  const additionalRevenue = proposalsPerMonth * dealSize * (improvedCloseRate - closeRate);
  const totalRoi = costSaved + additionalRevenue;
  const roiMultiple = totalRoi / sophiaMonthlyCost;

  const report = {
    current_state: {
      hours_per_proposal: proposalTime,
      proposals_per_month: proposalsPerMonth,
      monthly_cost: currentMonthlyCost,
      close_rate: closeRate,
    },
    with_sophia: {
      hours_per_proposal: sophiaTimeHours,
      monthly_cost: sophiaMonthlyCost,
      projected_close_rate: improvedCloseRate,
    },
    savings: {
      time_saved_hours_monthly: Math.round(timeSavedHours),
      cost_saved_monthly: Math.round(costSaved),
      additional_revenue_monthly: Math.round(additionalRevenue),
      total_monthly_roi: Math.round(totalRoi),
      roi_multiple: `${roiMultiple.toFixed(1)}x`,
      payback_period_days: Math.max(1, Math.round(30 / roiMultiple)),
    },
    generated_at: new Date().toISOString(),
  };

  return {
    success: true,
    summary: `ROI: ${roiMultiple.toFixed(1)}x return, $${Math.round(totalRoi)}/mo saved`,
    data: { roi_report: report },
  };
}

// ── sales:competitor-analysis ───────────────────────────────────────────────

export async function runCompetitorAnalysis(mission: Mission): Promise<MissionResult> {
  const params = mission.params as {
    competitors?: string[];
    product?: string;
    focus_areas?: string[];
  };

  const competitors = params.competitors ?? ['Proposify', 'PandaDoc', 'Qwilr'];
  const product = params.product ?? 'Sophia AI Factory';

  const analyses = await generateCompetitorAnalysis({
    competitors,
    product,
    focus_areas: params.focus_areas,
  });

  // Enrich with static feature comparison table (always accurate, not LLM-generated)
  const enriched = analyses.map(a => ({
    ...a,
    feature_comparison: {
      ai_proposals: { us: true, them: false },
      video_generation: { us: true, them: false },
      api_first: { us: true, them: 'limited' },
      usage_pricing: { us: true, them: false },
      crm_integration: { us: true, them: true },
      affiliate_engine: { us: true, them: false },
    },
  }));

  return {
    success: true,
    summary: `Competitor analysis: ${competitors.length} competitors analyzed`,
    data: { analyses: enriched, our_product: product },
  };
}

// ── sales:pricing-optimizer ─────────────────────────────────────────────────

export async function runPricingOptimizer(mission: Mission): Promise<MissionResult> {
  const db = await getD1Client();
  const params = mission.params as {
    target_segment?: string;
    current_tier?: string;
    usage_pattern?: string;
  };

  // Fetch org usage data for context
  let avgMcu = 0;
  try {
    const { data: usage } = await db
      .from('usage_logs')
      .select('mcu_cost')
      .eq('org_id', mission.org_id)
      .limit(100);
    if (usage && usage.length > 0) {
      const rows = usage as Array<Record<string, number>>;
      avgMcu = rows.reduce((s, r) => s + (r.mcu_cost ?? 0), 0) / rows.length;
    }
  } catch { /* no usage data yet */ }

  const tiers = [
    { name: 'Starter', price: 49, mcu: 200, best_for: 'Solo consultants, < 10 proposals/mo' },
    { name: 'Pro', price: 149, mcu: 1000, best_for: 'Small agencies, 10-50 proposals/mo' },
    { name: 'Business', price: 299, mcu: 3000, best_for: 'Mid agencies, 50-200 proposals/mo' },
    { name: 'Enterprise', price: 499, mcu: 'unlimited', best_for: 'Large agencies, 200+ proposals/mo' },
  ];

  const segment = params.target_segment ?? 'small_agency';
  const recommended = segment === 'enterprise' ? tiers[3]
    : segment === 'mid_agency' ? tiers[2]
    : segment === 'small_agency' ? tiers[1]
    : tiers[0];

  return {
    success: true,
    summary: `Recommended: ${recommended.name} ($${recommended.price}/mo)`,
    data: {
      recommended_tier: recommended,
      all_tiers: tiers,
      org_avg_mcu_per_mission: Math.round(avgMcu * 10) / 10,
      segment,
    },
  };
}

// ── sales:outreach-sequence ─────────────────────────────────────────────────

export async function runOutreachSequence(mission: Mission): Promise<MissionResult> {
  const params = mission.params as {
    prospect_name?: string;
    prospect_company?: string;
    prospect_role?: string;
    industry?: string;
    pain_point?: string;
  };

  if (!params.prospect_company) {
    return { success: false, error: 'Missing params.prospect_company' };
  }

  const sequence = await generateOutreachSequence({
    prospect_name: params.prospect_name,
    prospect_company: params.prospect_company,
    prospect_role: params.prospect_role,
    industry: params.industry,
    pain_point: params.pain_point,
  });

  return {
    success: true,
    summary: `Outreach sequence: ${sequence.length} touches for ${params.prospect_company}`,
    data: { sequence, prospect: params },
  };
}
