/**
 * Helpers and types for voice:clone ElevenLabs Instant Voice Cloning handler.
 * @module forest/voice/missions/voice-clone-helpers
 */

import type { MissionHandlerResult } from '@/forest/missions/types'

export const ELEVENLABS_VOICES_ADD_URL = 'https://api.elevenlabs.io/v1/voices/add'

export interface VoiceCloneParams {
  voice_name?: string
  description?: string
  sample_urls?: string[]
  labels?: Record<string, string>
}

export interface ElevenLabsAddResponse {
  voice_id?: string
  name?: string
  status?: string
  requires_verification?: boolean
}

export function parseParams(raw: Record<string, unknown>): VoiceCloneParams {
  return {
    voice_name: typeof raw.voice_name === 'string' ? raw.voice_name : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    sample_urls: Array.isArray(raw.sample_urls)
      ? raw.sample_urls.filter((u): u is string => typeof u === 'string' && u.startsWith('https://'))
      : undefined,
    labels:
      typeof raw.labels === 'object' && raw.labels !== null
        ? (raw.labels as Record<string, string>)
        : undefined,
  }
}

export function stubResponse(name: string, description: string, reason: string): MissionHandlerResult {
  return {
    ok: true,
    data: {
      voice_id: 'stub-voice-preview-001',
      name,
      description,
      preview_url: 'https://sophia.agencyos.network/api/media/stub-voice-preview.mp3',
      status: 'processing',
      is_stub: true,
      stub_reason: reason,
      upgrade_path:
        'Add an ElevenLabs API key in Settings > Integrations and provide sample_urls[] to create a real voice clone.',
    },
  }
}

export async function fetchAudioBlob(url: string): Promise<Blob> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`audio fetch failed for ${url}: HTTP ${res.status}`)
  return await res.blob()
}
