/**
 * Customer BYOK AI Voice-Over Route via OpenRouter Audio Speech API.
 *
 * Replaces deprecated HTTP POST Bing Edge TTS (which requires WebSocket + DRM v2
 * and fell back to synthetic beep audio) with genuine OpenRouter TTS
 * (`POST https://openrouter.ai/api/v1/audio/speech`) using the customer's existing
 * 1-Key OpenRouter BYOK key at $0 Founder AI subsidy.
 *
 * @module app/api/first-value/voice/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isEmailAllowedForPilot } from '@/seed/pilot/pilot-access-policy';
import { csrfForbiddenResponse, verifyCsrfToken } from '@/seed/security/csrf';
import {
  recordFailure,
  recordSuccess,
  shouldAllowRequest,
} from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, FailureKind } from '@/seed/types/failure-kind';
import { lookupUserApiKey } from '@/tree/byok/user-api-key-store';

const OPENROUTER_TTS_URL = 'https://openrouter.ai/api/v1/audio/speech';
const DEFAULT_OPENROUTER_TTS_MODEL = 'openai/gpt-4o-mini-tts';
const VOICE_RATE_LIMIT_MAX_REQUESTS = 6;
const VOICE_RATE_LIMIT_WINDOW_MS = 60_000;

const inFlightVoiceUsers = new Set<string>();
const voiceRateWindow = new Map<string, number[]>();

export function resetVoiceRouteGuardsForTests(): void {
  inFlightVoiceUsers.clear();
  voiceRateWindow.clear();
}

function checkVoiceRateLimit(userId: string, nowMs: number): boolean {
  const prev = voiceRateWindow.get(userId) ?? [];
  const recent = prev.filter((ts) => nowMs - ts < VOICE_RATE_LIMIT_WINDOW_MS);
  if (recent.length >= VOICE_RATE_LIMIT_MAX_REQUESTS) {
    voiceRateWindow.set(userId, recent);
    return false;
  }
  recent.push(nowMs);
  voiceRateWindow.set(userId, recent);
  return true;
}

const ALLOWED_PILOT_VOICES = [
  'vi-VN-HoaiMyNeural',
  'vi-VN-NamMinhNeural',
  'en-US-JennyNeural',
  'en-US-GuyNeural',
  'alloy',
  'nova',
  'onyx',
] as const;

const VOICE_TO_OPENROUTER_MAP: Record<(typeof ALLOWED_PILOT_VOICES)[number], string> = {
  'vi-VN-HoaiMyNeural': 'nova',
  'vi-VN-NamMinhNeural': 'onyx',
  'en-US-JennyNeural': 'alloy',
  'en-US-GuyNeural': 'onyx',
  alloy: 'alloy',
  nova: 'nova',
  onyx: 'onyx',
};

const PilotVoiceRequestSchema = z.object({
  text: z.string().trim().min(5).max(4096),
  locale: z.enum(['vi', 'en']).default('vi'),
  gender: z.enum(['female', 'male']).default('female'),
  voice: z.enum(ALLOWED_PILOT_VOICES).optional(),
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

  if (!verifyCsrfToken(request)) {
    return csrfForbiddenResponse();
  }

  if (!isEmailAllowedForPilot(user.email, process.env)) {
    return NextResponse.json(
      { code: 'PILOT_ACCESS_REVOKED', error: 'Pilot access is not active for this account' },
      { status: 403 },
    );
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

  const keyLookup = await lookupUserApiKey(user.id, 'openrouter').catch(() => null);
  const apiKey = keyLookup?.status === 'FOUND' ? keyLookup.key.trim() : '';
  if (!apiKey) {
    return NextResponse.json(
      {
        code: 'BYOK_KEY_REQUIRED',
        error: 'OpenRouter BYOK API key is required to synthesize voice-over.',
      },
      { status: 422 },
    );
  }

  if (inFlightVoiceUsers.has(user.id)) {
    return NextResponse.json(
      { code: 'VOICE_SYNTHESIS_IN_PROGRESS', error: 'A voice synthesis request is already in progress' },
      { status: 429 },
    );
  }

  if (!checkVoiceRateLimit(user.id, Date.now())) {
    return NextResponse.json(
      { code: 'VOICE_RATE_LIMIT_EXCEEDED', error: 'Voice synthesis rate limit exceeded' },
      { status: 429 },
    );
  }

  const breakerScope = `byok:${user.id}`;
  if (!shouldAllowRequest('openrouter', breakerScope)) {
    return NextResponse.json(
      { code: 'OPENROUTER_BREAKER_OPEN', error: 'OpenRouter TTS temporarily paused due to upstream errors' },
      { status: 503 },
    );
  }

  const mappedVoice = parsed.data.voice
    ? VOICE_TO_OPENROUTER_MAP[parsed.data.voice]
    : parsed.data.gender === 'male'
      ? 'onyx'
      : 'nova';

  inFlightVoiceUsers.add(user.id);
  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(OPENROUTER_TTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sophia-ai-factory.agencyos-openclaw.workers.dev',
        'X-Title': 'Sophia AI Factory',
      },
      body: JSON.stringify({
        model: DEFAULT_OPENROUTER_TTS_MODEL,
        voice: mappedVoice,
        input: parsed.data.text,
        response_format: 'mp3',
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    inFlightVoiceUsers.delete(user.id);
    recordFailure('openrouter', FailureKind.NETWORK, breakerScope);
    return NextResponse.json({ code: 'OPENROUTER_TTS_NETWORK_ERROR', error: 'Voice synthesis network error' }, { status: 502 });
  }

  try {
    if (!upstreamRes.ok) {
      if (upstreamRes.status !== 401 && upstreamRes.status !== 402 && upstreamRes.status !== 403) {
        recordFailure('openrouter', classifyHttpStatus(upstreamRes.status), breakerScope);
      }
      return NextResponse.json(
        { code: `OPENROUTER_TTS_HTTP_${upstreamRes.status}`, error: 'Voice synthesis failed upstream' },
        { status: upstreamRes.status === 401 || upstreamRes.status === 402 ? 422 : 502 },
      );
    }

    recordSuccess('openrouter', breakerScope);
    const audioBytes = new Uint8Array(await upstreamRes.arrayBuffer());
    if (audioBytes.byteLength === 0) {
      return NextResponse.json({ code: 'OPENROUTER_TTS_EMPTY', error: 'Empty audio returned' }, { status: 502 });
    }

    const safeName = `${sanitizeFilename(parsed.data.filename)}.mp3`;
    return new NextResponse(audioBytes, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Cache-Control': 'private, no-store',
        'X-Sophia-Voice': mappedVoice,
        'X-Sophia-Tts-Provider': 'openrouter-byok',
        'X-Sophia-Tts-Model': DEFAULT_OPENROUTER_TTS_MODEL,
        'X-Sophia-Tts-Funding': 'customer_byok',
      },
    });
  } finally {
    inFlightVoiceUsers.delete(user.id);
  }
}
