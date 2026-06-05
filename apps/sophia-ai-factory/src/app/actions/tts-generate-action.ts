'use server';

/**
 * Server Action: generateTtsAction
 *
 * Flow:
 *  1. Authenticate via getCurrentUser() → 401 if null
 *  2. Validate input with Zod
 *  3. Tier-gate voice access
 *  4. Resolve ElevenLabs API key (BYOK → env fallback)
 *  5. Call generateElevenLabsVoiceover
 *  6. Return { audioUrl }
 */

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { generateElevenLabsVoiceover } from '@/seed/ai/elevenlabs-api-client';
import { getUserApiKey } from '@/tree/byok/user-api-key-store';
import { logger } from '@/seed/utils/logger-utility';

// ─── Input Schema ─────────────────────────────────────────────────────────────

const ttsGenerateSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().default('adam'),
});

export type TtsGenerateInput = z.infer<typeof ttsGenerateSchema>;

// ─── Result Types ─────────────────────────────────────────────────────────────

export type TtsGenerateResult =
  | { success: true; audioUrl: string }
  | { success: false; error: string; code?: string };

// ─── Voice gating per tier ────────────────────────────────────────────────────

/** Voice name → ElevenLabs voice ID (pre-made voices) */
const VOICE_ID_MAP: Record<string, string> = {
  adam: 'pNInz6obpgDQGcFmaJgB',
  bella: 'EXAVITQu4vr4xnSDxMaL',
  josh: 'TxGEqnHWrfWFTfGW9XjX',
};

const TIER_ALLOWED_VOICES: Record<string, string[]> = {
  BASIC: ['adam'],
  PREMIUM: ['adam', 'bella', 'josh'],
  ENTERPRISE: [], // empty = all voices allowed
  MASTER: [],
};

// ─── Action ──────────────────────────────────────────────────────────────────

export async function generateTtsAction(
  input: unknown,
): Promise<TtsGenerateResult> {
  // Step 1: Auth
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHENTICATED' };
  }

  // Step 2: Validate input
  const parsed = ttsGenerateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((e) => e.message).join('; '),
      code: 'VALIDATION_ERROR',
    };
  }

  const { text, voiceId: voiceName } = parsed.data;

  // Step 3: Tier gate (BASIC and PREMIUM have restricted voices)
  const tier = await resolveUserTier(user.id);
  const allowedVoices = TIER_ALLOWED_VOICES[tier];
  if (allowedVoices && allowedVoices.length > 0 && !allowedVoices.includes(voiceName)) {
    return {
      success: false,
      error: `Voice "${voiceName}" is not available for your ${tier} plan.`,
      code: 'TIER_GATE',
    };
  }

  // Step 4: Resolve ElevenLabs API key (BYOK first, then env fallback)
  const byokKey = await getUserApiKey(user.id, 'elevenlabs');
  const apiKey = byokKey ?? process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'ElevenLabs API key not configured. Please add your key in Setup Wizard.',
      code: 'API_KEY_MISSING',
    };
  }

  // Resolve voice name to ElevenLabs voice ID
  const resolvedVoiceId = VOICE_ID_MAP[voiceName] ?? voiceName;

  // Step 5: Generate voiceover
  try {
    const result = await generateElevenLabsVoiceover(text, tier, apiKey, resolvedVoiceId);
    return { success: true, audioUrl: result.audio_url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[tts-generate-action] ElevenLabs call failed', new Error(message));
    return { success: false, error: 'Voice generation failed. Please try again.', code: 'TTS_ERROR' };
  }
}
