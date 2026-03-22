/**
 * Claude AI Proposal & Content Generator
 *
 * Generates proposals and content via Anthropic SDK.
 * Falls back to templates on API failure — never breaks the flow.
 */

import Anthropic from '@anthropic-ai/sdk';

export const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
export const CLAUDE_MAX_TOKENS = 2000;

export function getClaudeClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProposalParams {
  client_name: string;
  product_name?: string;
  tone?: string;
  sections?: string[];
}

export interface ProposalSection {
  title: string;
  content: string;
}

export interface ProposalResult {
  client_name: string;
  product_name: string;
  tone: string;
  sections: ProposalSection[];
  generated_at: string;
}

export interface ContentParams {
  topic?: string;
  company?: string;
  tone?: string;
  target_audience?: string;
}

export interface ContentResult {
  type: string;
  title: string;
  body: string;
  generated_at: string;
}

// ── generateProposal ─────────────────────────────────────────────────────────

export async function generateProposal(params: ProposalParams): Promise<ProposalResult> {
  const sectionNames = params.sections ?? ['executive_summary', 'scope', 'pricing', 'timeline'];
  const product = params.product_name ?? 'Sophia AI Factory';
  const tone = params.tone ?? 'professional';

  const fallback: ProposalResult = {
    client_name: params.client_name,
    product_name: product,
    tone,
    sections: sectionNames.map(s => ({
      title: s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      content: `[Template ${s} content for ${params.client_name}]`,
    })),
    generated_at: new Date().toISOString(),
  };

  try {
    const client = getClaudeClient();
    const prompt = `Write a ${tone} business proposal for ${params.client_name} for "${product}".
Include sections: ${sectionNames.join(', ')}. 2-3 concise paragraphs each.
Return JSON: { "sections": [{ "title": string, "content": string }] }`;

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]) as { sections?: ProposalSection[] };
    if (!Array.isArray(parsed.sections)) return fallback;

    return { ...fallback, sections: parsed.sections };
  } catch {
    return fallback;
  }
}

// ── generateContent ──────────────────────────────────────────────────────────

export async function generateContent(type: 'blog' | 'social', params: ContentParams): Promise<ContentResult> {
  const topic = params.topic ?? 'AI-powered business automation';
  const fallback: ContentResult = {
    type,
    title: `${type === 'blog' ? 'Blog Post' : 'Social Bundle'}: ${topic}`,
    body: `[Template ${type} content for topic: ${topic}]`,
    generated_at: new Date().toISOString(),
  };

  try {
    const client = getClaudeClient();
    const isBlog = type === 'blog';
    const prompt = isBlog
      ? `Write a professional blog post about "${topic}" for ${params.company ?? 'a business'}.
Audience: ${params.target_audience ?? 'business professionals'}.
Include: intro, 3 sections with subheadings, conclusion with CTA.
Return JSON: { "title": string, "body": string }`
      : `Write 3 social posts about "${topic}" for ${params.company ?? 'a business'}.
Platforms: LinkedIn (professional), Twitter/X (concise + hashtags), Instagram (engaging).
Return JSON: { "title": string, "body": string } where body has all 3 posts separated by "---"`;

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]) as { title?: string; body?: string };
    if (!parsed.title || !parsed.body) return fallback;

    return { type, title: parsed.title, body: parsed.body, generated_at: new Date().toISOString() };
  } catch {
    return fallback;
  }
}
