/**
 * Customer BYOK AI Voice-Over Route via OpenRouter Audio Speech API.
 *
 * Uses OpenRouter TTS (`POST https://openrouter.ai/api/v1/audio/speech`,
 * model `openai/gpt-4o-mini-tts`) funded by the customer's OpenRouter BYOK key.
 * Enforces auth, CSRF, pilot allowlist, workspace ownership, pilot consent,
 * live inference & financing controls, and durable D1 atomic quota/concurrency
 * locking (`pilot_usage_quotas` — zero new migrations).
 *
 * @module app/api/first-value/voice/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import {
  isEmailAllowedForPilot,
  isPilotLiveInferenceEnabled,
  PILOT_POLICY_VERSION,
  resolvePilotCostControls,
  resolvePilotFinancingMode,
} from '@/seed/pilot/pilot-access-policy';
import { csrfForbiddenResponse, verifyCsrfToken } from '@/seed/security/csrf';
import {
  recordFailure,
  recordSuccess,
  shouldAllowRequest,
} from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, FailureKind } from '@/seed/types/failure-kind';
import { lookupUserApiKey } from '@/tree/byok/user-api-key-store';
import {
  clearPilotInFlightLock,
  getPilotConsent,
  releasePilotGenerationSlot,
  reservePilotGenerationSlot,
} from '@/tree/first-value/pilot-state-repo';

const OPENROUTER_TTS_URL = 'https://openrouter.ai/api/v1/audio/speech';
const DEFAULT_OPENROUTER_TTS_MODEL = 'microsoft/mai-voice-2.1-flash';
const TTS_PRICE_PER_CHAR_USD = 0.000015; // Published OpenRouter rate: USD 15 / 1,000,000 characters

const ALLOWED_PILOT_VOICES = [
  'vi-VN-Harper:MAI-Voice-2.1-Flash',
  'vi-VN-Grant:MAI-Voice-2.1-Flash',
  'en-US-Harper:MAI-Voice-2.1-Flash',
  'en-US-Grant:MAI-Voice-2.1-Flash',
  'vi-VN-HoaiMyNeural',
  'vi-VN-NamMinhNeural',
  'en-US-JennyNeural',
  'en-US-GuyNeural',
  'alloy',
  'nova',
  'onyx',
] as const;

const VOICE_TO_OPENROUTER_MAP: Record<(typeof ALLOWED_PILOT_VOICES)[number], string> = {
  'vi-VN-Harper:MAI-Voice-2.1-Flash': 'vi-VN-Harper:MAI-Voice-2.1-Flash',
  'vi-VN-Grant:MAI-Voice-2.1-Flash': 'vi-VN-Grant:MAI-Voice-2.1-Flash',
  'en-US-Harper:MAI-Voice-2.1-Flash': 'en-US-Harper:MAI-Voice-2.1-Flash',
  'en-US-Grant:MAI-Voice-2.1-Flash': 'en-US-Grant:MAI-Voice-2.1-Flash',
  'vi-VN-HoaiMyNeural': 'vi-VN-Harper:MAI-Voice-2.1-Flash',
  'vi-VN-NamMinhNeural': 'vi-VN-Grant:MAI-Voice-2.1-Flash',
  'en-US-JennyNeural': 'en-US-Harper:MAI-Voice-2.1-Flash',
  'en-US-GuyNeural': 'en-US-Grant:MAI-Voice-2.1-Flash',
  alloy: 'en-US-Harper:MAI-Voice-2.1-Flash',
  nova: 'vi-VN-Harper:MAI-Voice-2.1-Flash',
  onyx: 'vi-VN-Grant:MAI-Voice-2.1-Flash',
};

const PilotVoiceRequestSchema = z.object({
  orgId: z.string().trim().min(1).max(128),
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

  const hasAccess = await verifyWorkspaceAccess(parsed.data.orgId, user.id).catch(() => false);
  if (!hasAccess) {
    return NextResponse.json(
      { code: 'WORKSPACE_FORBIDDEN', error: 'Workspace access denied' },
      { status: 403 },
    );
  }

  if (!isPilotLiveInferenceEnabled(process.env)) {
    return NextResponse.json(
      { code: 'LIVE_INFERENCE_DISABLED', error: 'Live provider inference is disabled' },
      { status: 403 },
    );
  }

  const costValidation = resolvePilotCostControls(process.env);
  if (!costValidation.ok) {
    return NextResponse.json(
      { code: 'PILOT_COST_CONTROLS_UNCONFIGURED', error: 'Pilot cost controls are not configured' },
      { status: 503 },
    );
  }
  const costConfig = costValidation.config;

  if (resolvePilotFinancingMode(process.env) === 'DISABLED') {
    return NextResponse.json(
      { code: 'PILOT_FINANCING_DISABLED', error: 'Pilot AI financing mode is disabled' },
      { status: 503 },
    );
  }

  const d1 = await getD1();
  if (!d1) {
    return NextResponse.json(
      { code: 'STORAGE_UNAVAILABLE', error: 'Durable quota storage unavailable' },
      { status: 503 },
    );
  }

  const consent = await getPilotConsent(d1, { orgId: parsed.data.orgId, userId: user.id });
  if (!consent || consent.policyVersion !== PILOT_POLICY_VERSION) {
    return NextResponse.json(
      { code: 'PILOT_CONSENT_REQUIRED', error: 'Pilot consent is required before paid TTS' },
      { status: 403 },
    );
  }

  const keyLookup = await lookupUserApiKey(user.id, 'openrouter').catch(() => null);
  const apiKey = keyLookup?.status === 'FOUND' ? keyLookup.key.trim() : '';
  if (apiKey.length < 10) {
    return NextResponse.json(
      {
        code: 'BYOK_KEY_REQUIRED',
        error: 'A valid OpenRouter BYOK API key is required to synthesize voice-over.',
      },
      { status: 422 },
    );
  }

  const breakerScope = `byok:${user.id}`;
  if (!shouldAllowRequest('openrouter', breakerScope)) {
    return NextResponse.json(
      { code: 'OPENROUTER_BREAKER_OPEN', error: 'OpenRouter TTS temporarily paused due to upstream errors' },
      { status: 503 },
    );
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const reservation = await reservePilotGenerationSlot(d1, {
    orgId: parsed.data.orgId,
    userId: user.id,
    maxGenerations: costConfig.maxGenerations,
    cooldownMs: costConfig.cooldownMs,
    nowMs,
    maxEstimatedSpendMicroUsd: costConfig.maxEstimatedSpendMicroUsd,
    estimatedCostPerAttemptMicroUsd: costConfig.estimatedCostPerAttemptMicroUsd,
    inFlightLockMs: costConfig.inFlightLockMs,
  });

  if (reservation.outcome !== 'reserved') {
    const codeMap = {
      quota_exceeded: 'PILOT_QUOTA_EXCEEDED',
      spend_limit_exceeded: 'PILOT_SPEND_LIMIT_EXCEEDED',
      in_flight: 'VOICE_SYNTHESIS_IN_PROGRESS',
      rate_limited: 'VOICE_RATE_LIMIT_EXCEEDED',
    } as const;
    return NextResponse.json(
      { code: codeMap[reservation.outcome], error: 'Durable TTS quota or concurrency limit reached' },
      { status: 429 },
    );
  }

  const mappedVoice = parsed.data.voice
    ? VOICE_TO_OPENROUTER_MAP[parsed.data.voice]
    : parsed.data.locale === 'en'
      ? parsed.data.gender === 'male'
        ? 'en-US-Grant:MAI-Voice-2.1-Flash'
        : 'en-US-Harper:MAI-Voice-2.1-Flash'
      : parsed.data.gender === 'male'
        ? 'vi-VN-Grant:MAI-Voice-2.1-Flash'
        : 'vi-VN-Harper:MAI-Voice-2.1-Flash';

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
    await clearPilotInFlightLock(d1, {
      orgId: parsed.data.orgId,
      userId: user.id,
      nowIso,
      expectedLockUntilMs: reservation.lockUntilMs,
    }).catch(() => {});
    recordFailure('openrouter', FailureKind.NETWORK, breakerScope);
    return NextResponse.json({ code: 'OPENROUTER_TTS_NETWORK_ERROR', error: 'Voice synthesis network error' }, { status: 502 });
  }

  if (!upstreamRes.ok) {
    const isPreChargeAuthRejection =
      upstreamRes.status === 401 || upstreamRes.status === 402 || upstreamRes.status === 403;
    if (isPreChargeAuthRejection) {
      await releasePilotGenerationSlot(d1, {
        orgId: parsed.data.orgId,
        userId: user.id,
        nowIso,
        refundEstimatedSpendMicroUsd: costConfig.estimatedCostPerAttemptMicroUsd,
        expectedLockUntilMs: reservation.lockUntilMs,
      }).catch(() => {});
    } else {
      await clearPilotInFlightLock(d1, {
        orgId: parsed.data.orgId,
        userId: user.id,
        nowIso,
        expectedLockUntilMs: reservation.lockUntilMs,
      }).catch(() => {});
      recordFailure('openrouter', classifyHttpStatus(upstreamRes.status), breakerScope);
    }
    return NextResponse.json(
      { code: `OPENROUTER_TTS_HTTP_${upstreamRes.status}`, error: 'Voice synthesis failed upstream' },
      { status: isPreChargeAuthRejection ? 422 : 502 },
    );
  }

  await clearPilotInFlightLock(d1, {
    orgId: parsed.data.orgId,
    userId: user.id,
    nowIso,
    expectedLockUntilMs: reservation.lockUntilMs,
  }).catch(() => {});
  recordSuccess('openrouter', breakerScope);

  const audioBytes = new Uint8Array(await upstreamRes.arrayBuffer());
  if (audioBytes.byteLength === 0) {
    return NextResponse.json({ code: 'OPENROUTER_TTS_EMPTY', error: 'Empty audio returned' }, { status: 502 });
  }

  const safeName = `${sanitizeFilename(parsed.data.filename)}.mp3`;
  const billableChars = parsed.data.text.length;
  const estimatedCostUsd = Number((billableChars * TTS_PRICE_PER_CHAR_USD).toFixed(6));
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
      'X-Sophia-Tts-Cost-Status': 'COST_ESTIMATE_AVAILABLE',
      'X-Sophia-Tts-Estimated-Cost-Usd': estimatedCostUsd.toFixed(6),
      'X-Sophia-Tts-Billable-Chars': String(billableChars),
    },
  });
}
