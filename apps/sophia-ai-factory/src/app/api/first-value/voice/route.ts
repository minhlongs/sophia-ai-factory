/**
 * Pilot Free AI Voice-Over Route (Edge TTS)
 *
 * Bridges the core `src/forest/edge-tts` module directly into the Customer Pilot
 * workspace so MMO affiliates can generate Vietnamese/English voice-over (.mp3)
 * from approved scripts at $0 Founder AI subsidy and without extra paid API keys.
 *
 * @module app/api/first-value/voice/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { synthesizeEdgeTts } from '@/forest/edge-tts';

const PilotVoiceRequestSchema = z.object({
  text: z.string().trim().min(5).max(3000),
  locale: z.enum(['vi', 'en']).default('vi'),
  gender: z.enum(['female', 'male']).default('female'),
  voice: z.string().trim().min(3).max(80).optional(),
  filename: z.string().trim().min(1).max(80).optional(),
});

function sanitizeFilename(raw?: string): string {
  const base = (raw ?? 'sophia-pilot-voice').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60);
  return base || 'sophia-pilot-voice';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parsed = PilotVoiceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid voice request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await synthesizeEdgeTts(parsed.data.text, parsed.data.locale, {
    gender: parsed.data.gender,
    voice: parsed.data.voice,
  });

  const ext = result.mimeType === 'audio/mpeg' ? 'mp3' : 'wav';
  const safeName = `${sanitizeFilename(parsed.data.filename)}.${ext}`;
  const bytes = new Uint8Array(result.audioBuffer);

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Cache-Control': 'no-store',
      'X-Sophia-Voice': result.voice,
      'X-Sophia-Duration-Sec': String(result.durationSec),
    },
  });
}
