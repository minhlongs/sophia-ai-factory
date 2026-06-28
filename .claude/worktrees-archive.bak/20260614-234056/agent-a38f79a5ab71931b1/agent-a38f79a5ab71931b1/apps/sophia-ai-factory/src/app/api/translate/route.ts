/**
 * POST /api/translate
 *
 * Delivers the homepage "global reach" promise: translate any script using
 * the caller's BYOK OpenRouter key. No operator credential required.
 *
 * Body:
 *   {
 *     text: string,         // required, non-empty, max 8000 chars used
 *     fromLang: string,     // 'en' | 'vi' | display name
 *     toLang: string,
 *     tone?: 'literal' | 'natural',
 *     model?: string
 *   }
 *
 * Auth: session cookie OR OpenClaw Bearer.
 *
 * Errors:
 *   400 INVALID_BODY     — zod validation failed
 *   401 Unauthorized     — no session and no valid Bearer
 *   422 BYOK_REQUIRED    — user has no OpenRouter key configured
 *   502 UPSTREAM_FAILED  — OpenRouter returned non-2xx or empty body
 *
 * @module app/api/translate
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserOrOpenclawBearer } from '@/seed/auth/openclaw-token';
import { translateScript, TranslateConfigurationError } from '@/land/i18n/translate-script';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  text: z.string().min(1, 'text is required'),
  fromLang: z.string().min(2).max(40),
  toLang: z.string().min(2).max(40),
  tone: z.enum(['literal', 'natural']).optional(),
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
    const result = await translateScript({
      userId: user.id,
      text: parsed.data.text,
      fromLang: parsed.data.fromLang,
      toLang: parsed.data.toLang,
      tone: parsed.data.tone,
      model: parsed.data.model,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TranslateConfigurationError) {
      const status = err.code === 'BYOK_REQUIRED' ? 422 : 400;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    return NextResponse.json(
      { error: 'UPSTREAM_FAILED', message: err instanceof Error ? err.message : 'unknown' },
      { status: 502 },
    );
  }
}
