/**
 * POST /api/v1/demo
 *
 * Public demo endpoint — rate limited to 3 requests per IP per 10 minutes.
 * Calls LLM with Haiku model and returns a short preview.
 * No auth required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { llmGenerateWithUsage } from '@/lib/ai/llm-router';

// ── Rate limiting ─────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

// ── Validation ────────────────────────────────────────────────────────────────

const DemoCommandSchema = z.object({
  command: z.enum(['proposal:create', 'content:blog', 'lead:generate']),
  topic: z.string().min(1).max(200),
});

// ── System prompts ────────────────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<string, string> = {
  'proposal:create':
    "You are a business proposal expert. Generate a SHORT compelling proposal preview (300-500 words) for the given topic. End with: '--- Full version includes 12-page proposal with ROI analysis, timeline, pricing, and case studies. Sign up for full access.'",
  'content:blog':
    "You are a content marketing expert. Generate a SHORT blog post preview (300-500 words). End with: '--- Full version includes 1,500+ word SEO-optimized post with meta tags, images, and social media snippets. Sign up for full access.'",
  'lead:generate':
    "You are a B2B sales research expert. Generate 3 sample prospect leads for the given industry/topic. End with: '--- Full version generates 10-20 scored leads with contact details, pain points, and personalized outreach. Sign up for full access.'",
};

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const { allowed, retryAfterSeconds } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retry_after_seconds: retryAfterSeconds },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = DemoCommandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { command, topic } = parsed.data;
  const systemPrompt = SYSTEM_PROMPTS[command];

  try {
    const start = Date.now();
    const result = await llmGenerateWithUsage(topic, {
      system: systemPrompt,
      maxTokens: 700,
      model: 'claude-haiku-4-5-20251001',
    });

    return NextResponse.json({
      result: result.content,
      command,
      duration_ms: Date.now() - start,
      tokens_used: result.inputTokens + result.outputTokens,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `LLM error: ${message}` }, { status: 500 });
  }
}
