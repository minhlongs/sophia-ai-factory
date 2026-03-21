/**
 * Social Media Generator for Affiliate Programs
 *
 * Generates LinkedIn + Twitter + TikTok script bundle in one AI call.
 * Cost: 10 MCU per bundle.
 */

import { claudeClient } from '@/lib/ai/client';
import type { AffiliateProgramData } from './blog-generator';

export interface SocialContent {
  linkedin: string;  // Max 3000 chars
  twitter: string;   // Max 280 chars
  tiktokScript: string; // 15-30s spoken script
}

/**
 * Generate social media post bundle for affiliate promotion.
 * All 3 variants generated in a single Claude call for efficiency.
 */
export async function generateSocialBundle(
  program: AffiliateProgramData,
  orgId: string
): Promise<SocialContent> {
  const utmLink = `${program.affiliate_url}?utm_source=sophia&utm_medium=social&utm_campaign=${orgId}`;
  const commissionPct = (program.commission_rate * 100).toFixed(0);

  const prompt = `Generate 3 social media posts promoting "${program.name}" (${program.category} tool).

PRODUCT: ${program.description}
AFFILIATE LINK: ${utmLink}
COMMISSION: ${commissionPct}% recurring

Generate all 3 in one JSON response:

1. LINKEDIN (professional tone, 150-300 words, storytelling format, ends with link)
2. TWITTER (max 260 chars including link, punchy hook + benefit + link)
3. TIKTOK_SCRIPT (15-30s spoken script, energetic, starts with hook question, ends with "link in bio")

Return JSON:
{
  "linkedin": "...",
  "twitter": "...",
  "tiktokScript": "..."
}

Rules:
- LinkedIn: value-first, no hard sell, add 3 relevant hashtags at end
- Twitter: one clear benefit, curiosity gap, include link
- TikTok: casual spoken word, no hashtags (they go in caption separately)
- All posts must feel authentic, not like ads`;

  const response = await claudeClient.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0];
  if (text.type !== 'text') throw new Error('Unexpected response from Claude');

  const jsonMatch = text.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse social content from AI response');

  const parsed = JSON.parse(jsonMatch[0]) as {
    linkedin: string;
    twitter: string;
    tiktokScript: string;
  };

  // Enforce platform limits
  if (parsed.twitter.length > 280) {
    parsed.twitter = parsed.twitter.slice(0, 277) + '...';
  }
  if (parsed.linkedin.length > 3000) {
    parsed.linkedin = parsed.linkedin.slice(0, 2997) + '...';
  }

  return {
    linkedin: parsed.linkedin,
    twitter: parsed.twitter,
    tiktokScript: parsed.tiktokScript,
  };
}
