/**
 * Blog Generator for Affiliate Programs
 *
 * Generates SEO-optimized affiliate review blog posts via Claude API.
 * Cost: 50 MCU per post.
 */

import { claudeClient } from '@/lib/ai/client';

export interface AffiliateProgramData {
  id: string;
  name: string;
  description: string;
  category: string;
  website_url: string;
  affiliate_url: string;
  commission_rate: number;
  pricing_info?: string;
  key_features?: string[];
}

export interface BlogContent {
  title: string;
  body: string; // markdown
  metaDescription: string;
  keywords: string[];
}

/**
 * Generate SEO-optimized affiliate review post
 * Structure: hook → overview → features → pricing → pros/cons → best for → CTA
 */
export async function generateBlogReview(
  program: AffiliateProgramData,
  orgId: string
): Promise<BlogContent> {
  const utmLink = `${program.affiliate_url}?utm_source=sophia&utm_medium=blog&utm_campaign=${orgId}`;
  const features = program.key_features?.join(', ') || 'AI automation, efficiency tools, analytics';

  const prompt = `Write an SEO blog review for "${program.name}" (${program.category} tool).

PRODUCT INFO:
- Description: ${program.description}
- Pricing: ${program.pricing_info || 'Contact for pricing'}
- Key features: ${features}
- Affiliate link: ${utmLink}
- Commission: ${(program.commission_rate * 100).toFixed(0)}% recurring

REQUIRED STRUCTURE (600-800 words total, markdown):
1. # [Hook headline addressing pain point]
2. ## What is ${program.name}?
3. ## Key Features (top 5 bullet points)
4. ## Pricing Breakdown
5. ## Pros and Cons
6. ## Who Should Use It?
7. ## Final Verdict + CTA with the affiliate link

RULES:
- Include the UTM link naturally in the CTA section
- Add disclaimer: "This post contains affiliate links. We may earn a commission."
- SEO-friendly: use keywords naturally
- Be honest — include 2-3 genuine cons

Return JSON: { "title": "...", "body": "...(markdown)...", "metaDescription": "...(155 chars max)...", "keywords": ["kw1","kw2","kw3","kw4","kw5"] }`;

  const response = await claudeClient.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0];
  if (text.type !== 'text') throw new Error('Unexpected response from Claude');

  // Extract JSON from response
  const jsonMatch = text.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse blog content from AI response');

  return JSON.parse(jsonMatch[0]) as BlogContent;
}

/**
 * Generate comparison article for multiple affiliate programs
 * Cost: 50 MCU (same as single review)
 */
export async function generateComparisonArticle(
  programs: AffiliateProgramData[],
  orgId: string
): Promise<BlogContent> {
  if (programs.length < 2) throw new Error('Need at least 2 programs to compare');

  const names = programs.map((p) => p.name).join(' vs ');
  const programDetails = programs.map((p) => {
    const utmLink = `${p.affiliate_url}?utm_source=sophia&utm_medium=blog&utm_campaign=${orgId}`;
    return `- ${p.name}: ${p.description} | Commission: ${(p.commission_rate * 100).toFixed(0)}% | Link: ${utmLink}`;
  }).join('\n');

  const prompt = `Write a comparison article: "${names}"

PRODUCTS:
${programDetails}

Write 700-900 word comparison (markdown) with: intro, comparison table, individual summaries, verdict.
Include UTM links for each tool in their summary section.
Add affiliate disclaimer at top.

Return JSON: { "title": "...", "body": "...(markdown)...", "metaDescription": "...(155 chars)...", "keywords": ["kw1","kw2","kw3","kw4","kw5"] }`;

  const response = await claudeClient.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0];
  if (text.type !== 'text') throw new Error('Unexpected response from Claude');

  const jsonMatch = text.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse comparison content from AI response');

  return JSON.parse(jsonMatch[0]) as BlogContent;
}
