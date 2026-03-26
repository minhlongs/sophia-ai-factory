/**
 * Video Generator for Affiliate Programs
 *
 * Generates video script via Claude, then queues HeyGen video job.
 * Reuses existing heygen-client.ts — no duplicate API calls.
 * Cost: 200 MCU per video.
 */

import { claudeClient } from '@/lib/ai/client';
import { createVideoTask } from '@/lib/video/heygen-client';
import type { AffiliateProgramData, BlogContent } from './blog-generator';

export interface VideoContent {
  script: string;
  heygenVideoId: string;
  estimatedDurationSeconds: number;
}

/**
 * Generate 30-60s video script from program data + blog content,
 * then submit to HeyGen for async rendering.
 */
export async function generateVideoReview(
  program: AffiliateProgramData,
  blog: BlogContent,
  orgId: string
): Promise<VideoContent> {
  const script = await buildVideoScript(program, blog, orgId);

  // Submit to HeyGen (async — returns job ID immediately)
  const heygenTask = await createVideoTask({
    proposalId: `affiliate-${program.id}-${orgId}`,
    videoType: 'custom',
    scriptText: script,
  });

  const heygenVideoId = heygenTask.data?.video_id;
  if (!heygenVideoId) throw new Error('HeyGen did not return a video_id');

  const wordCount = script.trim().split(/\s+/).length;
  const estimatedDurationSeconds = Math.ceil((wordCount / 150) * 60);

  return {
    script,
    heygenVideoId,
    estimatedDurationSeconds,
  };
}

/**
 * Build 30-60s video script with 5-act structure:
 * Hook (5s) → Problem (10s) → Solution (15s) → Proof (10s) → CTA (5s)
 */
async function buildVideoScript(
  program: AffiliateProgramData,
  blog: BlogContent,
  orgId: string
): Promise<string> {
  const utmLink = `${program.affiliate_url}?utm_source=sophia&utm_medium=video&utm_campaign=${orgId}`;
  // Extract a key metric from blog keywords for proof section
  const proofKeyword = blog.keywords[0] || program.category;

  const prompt = `Write a 30-60 second video script for a review of "${program.name}" (${program.category}).

PRODUCT: ${program.description}
KEY BENEFITS: ${blog.keywords.slice(0, 3).join(', ')}
AFFILIATE LINK: ${utmLink}

5-ACT STRUCTURE (label each section):
[HOOK - 5s] Attention-grabbing question about ${program.category} pain
[PROBLEM - 10s] The core frustration that ${program.name} solves
[SOLUTION - 15s] 3 specific features that fix the problem (mention ${program.name} by name)
[PROOF - 10s] One stat or benefit about ${proofKeyword}
[CTA - 5s] "Click the link below to try ${program.name} — affiliate link in description"

RULES:
- Conversational, energetic tone
- ~120-150 words total (fits 45-60 seconds at normal pace)
- No technical jargon
- End with clear call to action

Return only the script text with section labels, no JSON wrapper.`;

  const response = await claudeClient.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0];
  if (text.type !== 'text') throw new Error('Unexpected response from Claude');

  return text.text.trim();
}
