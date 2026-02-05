import { Tier } from "@/types";

interface GenerateVoiceoverInput {
  text: string;
  tier: Tier;
  voiceId?: string;
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
  const { text, tier, voiceId } = input;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (apiKey) {
    try {
      return await generateElevenLabsVoiceover(text, tier, apiKey, voiceId);
    } catch (error) {
      console.error('ElevenLabs API error:', error);
      console.warn('Falling back to mock voiceover generation');
    }
  } else {
    console.warn('ELEVENLABS_API_KEY not set, using mock voiceover generation');
  }

  // Mock fallback
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

  // Get audio as blob
  const audioBlob = await response.blob();

  // In production, you'd upload this to your storage (S3, Supabase Storage, etc.)
  // For now, we'll use a temporary URL approach
  // TODO: Implement proper file upload to permanent storage

  // Convert blob to base64 data URL (temporary solution)
  const audioBase64 = await blobToBase64(audioBlob);

  // Estimate duration (ElevenLabs doesn't return duration in API response)
  const estimatedDuration = Math.floor(text.length / 15);

  return {
    audio_url: audioBase64, // TODO: Replace with permanent storage URL
    duration: estimatedDuration
  };
}

/**
 * Get default voice ID based on tier
 * These are ElevenLabs pre-made voice IDs
 */
function getDefaultVoiceId(tier: Tier): string {
  const voices = {
    ENTERPRISE: '21m00Tcm4TlvDq8ikWAM', // Rachel - Professional
    PREMIUM: 'EXAVITQu4vr4xnSDxMaL',    // Bella - Friendly
    BASIC: 'pNInz6obpgDQGcFmaJgB'       // Adam - Neutral
  };

  return process.env.ELEVENLABS_VOICE_ID || voices[tier];
}

/**
 * Convert blob to base64 data URL
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
