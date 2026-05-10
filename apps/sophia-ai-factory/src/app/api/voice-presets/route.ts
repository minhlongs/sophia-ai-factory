/**
 * Voice Presets Library API
 *
 * GET /api/voice-presets — List voice presets accessible to the caller's tier.
 *
 * Response shape: only public-facing fields. The internal `coquiSpeaker` reference
 * is intentionally OMITTED — clients pass `id` to the TTS API which resolves the
 * Coqui speaker server-side. This keeps the speaker mapping a server secret that
 * may evolve without breaking client contracts.
 *
 * Auth: requires session. Tier resolved via `getUserTier(user.id)`.
 *
 * @module app/api/voice-presets/route
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { listPresetsForTier, type VoicePreset } from '@/seed/voices/presets';
import { logger } from '@/seed/utils/logger-utility';

/** Public projection of a VoicePreset — strips internal `coquiSpeaker`. */
interface PublicVoicePreset {
  id: string;
  displayName: string;
  language: VoicePreset['language'];
  gender: VoicePreset['gender'];
  vibe: string;
  samplePath: string;
  minTier: VoicePreset['minTier'];
}

function toPublic(preset: VoicePreset): PublicVoicePreset {
  return {
    id: preset.id,
    displayName: preset.displayName,
    language: preset.language,
    gender: preset.gender,
    vibe: preset.vibe,
    samplePath: preset.samplePath,
    minTier: preset.minTier,
  };
}

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let tier;
  try {
    tier = await getUserTier(user.id);
  } catch (err) {
    logger.warn('[voice-presets] getUserTier failed', { userId: user.id, error: String(err) });
    return NextResponse.json({ error: 'Failed to resolve tier' }, { status: 500 });
  }

  const presets = listPresetsForTier(tier).map(toPublic);
  return NextResponse.json({ tier, presets });
}
