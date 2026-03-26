import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import { Tier } from "@/types";
import { trackUsage, hashLicenseKey, calculateCredits, startTimer } from '@/lib/usage-metering';
import { getUsageContext } from '@/lib/usage-metering/context';

interface GenerateVoiceoverInput {
  text: string;
  tier: Tier;
  voiceId?: string;
  userId?: string;
  licenseKey?: string;
  licenseNonce?: string;
}

interface VoiceoverOutput {
  audio_url: string;
  duration: number; // in seconds
}

/**
 * Generates voiceover using ElevenLabs API.
 *
 * CURRENTLY SUPPORTS: Real ElevenLabs integration with mock fallback
 *
 * To use ElevenLabs:
 * 1. Sign up: https://elevenlabs.io/
 * 2. Add ELEVENLABS_API_KEY to .env
 * 3. (Optional) Add ELEVENLABS_VOICE_ID for custom voice
 *
 * Default voices by tier:
 * - ENTERPRISE: Premium voice (Rachel - professional)
 * - PREMIUM: Standard voice (Bella - friendly)
 * - BASIC: Standard voice (Adam - neutral)
 */
export async function generateVoiceover(input: GenerateVoiceoverInput): Promise<VoiceoverOutput> {
  const { text, tier, voiceId, userId, licenseKey, licenseNonce } = input;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const stopTimer = startTimer();

  // Get context if available
  const context = getUsageContext();
  const finalUserId = userId || context?.userId || 'unknown';
  const finalLicenseKey = licenseKey || '';
  const finalLicenseNonce = licenseNonce || context?.licenseNonce || 'unknown';
  const licenseKeyHash = hashLicenseKey(finalLicenseKey || 'unknown');

  if (apiKey) {
    try {
      const result = await generateElevenLabsVoiceover(text, tier, apiKey, voiceId);
      // Track successful usage
      await trackUsage({
        userId: finalUserId,
        licenseKeyHash: licenseKeyHash,
        licenseNonce: finalLicenseNonce,
        service: 'elevenlabs',
        endpoint: `/text-to-speech/${voiceId || 'default'}`,
        action: 'text_to_speech',
        creditsUsed: calculateCredits('elevenlabs', 'textToSpeech', undefined, tier),
        tierAtRequest: tier,
        statusCode: 200,
        responseTimeMs: stopTimer(),
      });
      return result;
    } catch (error) {
      // Log and fall through to mock fallback
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.warn(`[ElevenLabs] API failed, falling back to mock`, { error: errMsg });
      // Track failed usage
      await trackUsage({
        userId: finalUserId,
        licenseKeyHash: licenseKeyHash,
        licenseNonce: finalLicenseNonce,
        service: 'elevenlabs',
        endpoint: `/text-to-speech/${voiceId || 'default'}`,
        action: 'text_to_speech',
        tierAtRequest: tier,
        statusCode: 500,
        errorMessage: errMsg,
        responseTimeMs: stopTimer(),
        creditsUsed: 0,
      });
    }
  }

  // Mock fallback
  const mockResult = await generateMockVoiceover(text, tier);
  // Track mock usage
  await trackUsage({
    userId: finalUserId,
    licenseKeyHash: 'mock',
    licenseNonce: finalLicenseNonce,
    service: 'elevenlabs',
    endpoint: '/mock',
    action: 'text_to_speech_mock',
    creditsUsed: 0, // Mock is free
    tierAtRequest: tier,
    statusCode: 200,
    responseTimeMs: stopTimer(),
  });

  return mockResult;
}

/**
 * Real ElevenLabs API integration
 */
async function generateElevenLabsVoiceover(
  text: string,
  tier: Tier,
  apiKey: string,
  voiceId?: string
): Promise<VoiceoverOutput> {
  // Select voice based on tier if not provided
  const defaultVoiceId = voiceId || getDefaultVoiceId(tier);

  // ElevenLabs API endpoint
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${defaultVoiceId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text: text,
      model_id: tier === 'ENTERPRISE' ? 'eleven_multilingual_v2' : 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: tier === 'ENTERPRISE' ? 0.5 : 0.0,
        use_speaker_boost: tier !== 'BASIC'
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API failed: ${response.status} - ${errorText}`);
  }

  // Get audio as ArrayBuffer for Supabase Storage upload
  const audioBuffer = await response.arrayBuffer();

  // Upload to Supabase Storage for permanent storage
  const audioUrl = await uploadAudioToStorage(new Uint8Array(audioBuffer));

  // Estimate duration (ElevenLabs doesn't return duration in API response)
  const estimatedDuration = Math.floor(text.length / 15);

  return {
    audio_url: audioUrl,
    duration: estimatedDuration
  };
}

/**
 * Get default voice ID based on tier
 * These are ElevenLabs pre-made voice IDs
 */
function getDefaultVoiceId(tier: Tier): string {
  const voices: Record<Tier, string> = {
    MASTER: '21m00Tcm4TlvDq8ikWAM',     // Rachel - Professional (same as Enterprise)
    ENTERPRISE: '21m00Tcm4TlvDq8ikWAM', // Rachel - Professional
    PREMIUM: 'EXAVITQu4vr4xnSDxMaL',    // Bella - Friendly
    BASIC: 'pNInz6obpgDQGcFmaJgB'       // Adam - Neutral
  };

  return process.env.ELEVENLABS_VOICE_ID || voices[tier];
}

/**
 * Upload audio buffer to Supabase Storage and return the public URL.
 * Uses service role key for server-side uploads.
 * Falls back to a data URI when Supabase is not configured.
 */
async function uploadAudioToStorage(audioData: Uint8Array): Promise<string> {
  if (!isAdminClientConfigured()) {
    logger.warn('[ElevenLabs] Supabase not configured, returning data URI for audio');
    const base64 = Buffer.from(audioData).toString('base64');
    return `data:audio/mpeg;base64,${base64}`;
  }

  const supabase = createAdminClient();

  const fileName = `voiceover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
  const filePath = `voiceovers/${fileName}`;

  const { error: uploadError } = await supabase
    .storage
    .from('audio')
    .upload(filePath, audioData, {
      contentType: 'audio/mpeg',
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabase
    .storage
    .from('audio')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

/**
 * Mock voiceover generator for fallback
 */
async function generateMockVoiceover(text: string, tier: Tier): Promise<VoiceoverOutput> {
  await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing

  // Return mock audio URLs (public domain sample files)
  const mockAudioUrls = tier === 'ENTERPRISE'
    ? [
        "https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav",
        "https://www2.cs.uic.edu/~i101/SoundFiles/CantinaBand60.wav"
      ]
    : [
        "https://www2.cs.uic.edu/~i101/SoundFiles/ImperialMarch60.wav",
        "https://www2.cs.uic.edu/~i101/SoundFiles/StarWars60.wav"
      ];

  const selectedUrl = mockAudioUrls[Math.floor(Math.random() * mockAudioUrls.length)];

  return {
    audio_url: selectedUrl,
    duration: Math.floor(text.length / 15) // Rough estimate: ~15 chars per second
  };
}
