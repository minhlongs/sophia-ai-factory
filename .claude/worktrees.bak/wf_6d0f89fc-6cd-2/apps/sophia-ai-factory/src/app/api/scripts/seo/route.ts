/**
 * POST /api/scripts/seo
 *
 * Delivers the homepage "AI Script Generation — SEO-optimized" promise.
 * Generates a script via the caller's BYOK OpenRouter key and returns
 * both the script and an explainable SEO score so users can iterate
 * before committing the script to a video render.
 *
 * Body:
 *   {
 *     topic: string,            // required
 *     keywords?: string[],      // 0–10 keywords for coverage scoring
 *     language?: 'en' | 'vi',
 *     lengthHint?: { min: number, max: number },
 *     model?: string
 *   }
 *
 * Auth: session cookie OR OpenClaw Bearer.
 *
 * Errors:
 *   400 INVALID_BODY     — zod validation failed
 *   401 Unauthorized
 *   422 BYOK_REQUIRED    — user has no OpenRouter key configured
 *   502 UPSTREAM_FAILED  — OpenRouter returned non-2xx or empty body
 *
 * @module app/api/scripts/seo
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserOrOpenclawBearer } from '@/seed/auth/openclaw-token';
import { generateSeoScript, SeoScriptConfigurationError } from '@/land/scripts/generate-seo-script';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  topic: z.string().min(1).max(200),
  keywords: z.array(z.string().min(1).max(40)).max(10).optional(),
  language: z.enum(['en', 'vi']).optional(),
  lengthHint: z
    .object({ min: z.number().int().positive(), max: z.number().int().positive() })
    .refine((v) => v.max >= v.min, { message: 'max must be >= min' })
    .optional(),
  model: z.string().max(120).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserOrOpenclawBearer(req.headers);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_BODY', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await generateSeoScript({ userId: user.id, ...parsed.data });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SeoScriptConfigurationError) {
      const status = err.code === 'BYOK_REQUIRED' ? 422 : 400;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    return NextResponse.json(
      { error: 'UPSTREAM_FAILED', message: err instanceof Error ? err.message : 'unknown' },
      { status: 502 },
    );
  }
}
