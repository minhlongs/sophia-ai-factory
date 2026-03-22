/**
 * Claude AI Sales Intelligence
 *
 * Competitor SWOT analysis and outreach sequence generation via Anthropic SDK.
 * Falls back to static templates on API failure — never breaks the flow.
 */

import { getClaudeClient, CLAUDE_MODEL, CLAUDE_MAX_TOKENS } from './claude-proposal-generator';

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
    const client = getClaudeClient();
    const focusAreas = (params.focus_areas ?? ['pricing', 'features', 'market position']).join(', ');
    const prompt = `Analyze ${product} vs: ${competitors.join(', ')}.
Focus areas: ${focusAreas}.
For each competitor provide SWOT (4 bullet points each) and a win strategy for ${product}.
Return JSON: { "analyses": [{ "competitor": string, "swot": { "strengths": [], "weaknesses": [], "opportunities": [], "threats": [] }, "win_strategy": string }] }`;

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
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
    const client = getClaudeClient();
    const prompt = `Write a 4-touch outreach sequence for: ${name} at ${company} (${role}).
Industry: ${industry}. Pain point: ${pain}.
Product: Sophia AI Factory (AI proposals in <30s, MCU pricing, video generation).
Touches: Day 1 email, Day 3 email, Day 5 LinkedIn, Day 7 email.
Return JSON: { "sequence": [{ "day": number, "subject": string, "body": string, "channel": string }] }`;

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]) as { sequence?: OutreachStep[] };
    if (!Array.isArray(parsed.sequence) || parsed.sequence.length === 0) return fallback;

    return parsed.sequence;
  } catch {
    return fallback;
  }
}
