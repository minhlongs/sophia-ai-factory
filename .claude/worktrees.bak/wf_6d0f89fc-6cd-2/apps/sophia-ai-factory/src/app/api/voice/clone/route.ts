/**
 * POST /api/voice/clone
 *
 * Delivers the homepage "ElevenLabs Voice Integration (BYOK)" promise.
 * Customer supplies their ElevenLabs key (Setup Wizard) plus a list of
 * audio sample URLs; we forward to /v1/voices/add and return the new
 * voice_id ready to drive downstream TTS calls.
 *
 * Body:
 *   {
 *     name: string,           // 1–80 chars
 *     audioUrls: string[],    // 1–25 URLs, ≤11MB each
 *     description?: string,
 *     labels?: Record<string,string>
 *   }
 *
 * Auth: session cookie OR OpenClaw Bearer.
 *
 * Errors:
 *   400 INVALID_BODY      — zod validation failed
 *   401 Unauthorized
 *   422 BYOK_REQUIRED     — user has no ElevenLabs key configured
 *   422 SAMPLE_TOO_LARGE  — audio sample > 11MB
 *   502 UPSTREAM_FAILED   — ElevenLabs returned non-2xx
 *
 * @module app/api/voice/clone
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserOrOpenclawBearer } from '@/seed/auth/openclaw-token';
import { cloneVoice, VoiceCloneConfigurationError } from '@/land/voice/clone-voice';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  name: z.string().min(1).max(80),
  audioUrls: z.array(z.string().url()).min(1).max(25),
  description: z.string().max(500).optional(),
  labels: z.record(z.string(), z.string()).optional(),
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
    const result = await cloneVoice({ userId: user.id, ...parsed.data });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof VoiceCloneConfigurationError) {
      const status = err.code === 'BYOK_REQUIRED' || err.code === 'SAMPLE_TOO_LARGE' ? 422 : 400;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    return NextResponse.json(
      { error: 'UPSTREAM_FAILED', message: err instanceof Error ? err.message : 'unknown' },
      { status: 502 },
    );
  }
}
