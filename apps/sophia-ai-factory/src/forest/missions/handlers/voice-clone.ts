/**
 * Handler: voice:clone — KOL Voice Cloning via ElevenLabs Instant Voice Cloning.
 *
 * Live wiring (Phase 04 Batch C, P15): when the user has an ElevenLabs BYOK key
 * stored and supplies `sample_urls`, this handler proxies a multipart upload to
 * ElevenLabs `POST /v1/voices/add` and returns the resulting `voice_id`. Without
 * a key or samples it falls back to the historical stub response so existing
 * callers (and Telegram demo) remain unbroken.
 *
 * Mission params (all optional except `sample_urls` for live mode):
 *   - voice_name?:   string
 *   - description?:  string
 *   - sample_urls?:  string[]  (HTTPS URLs to audio samples — R2, S3, etc.)
 *   - labels?:       Record<string, string>  (passed verbatim to ElevenLabs)
 */

import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key'
import type { MissionContext, MissionHandlerResult } from './types'
import { logger } from '@/seed/utils/logger-utility'

const ELEVENLABS_VOICES_ADD_URL = 'https://api.elevenlabs.io/v1/voices/add'

interface VoiceCloneParams {
  voice_name?: string
  description?: string
  sample_urls?: string[]
  labels?: Record<string, string>
}

interface ElevenLabsAddResponse {
  voice_id?: string
  name?: string
  status?: string
  requires_verification?: boolean
}

function parseParams(raw: Record<string, unknown>): VoiceCloneParams {
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

function stubResponse(name: string, description: string, reason: string): MissionHandlerResult {
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

async function fetchAudioBlob(url: string): Promise<Blob> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`audio fetch failed for ${url}: HTTP ${res.status}`)
  return await res.blob()
}

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const params = parseParams(ctx.params)
  const name = params.voice_name ?? 'My Voice Clone'
  const description = params.description ?? ''

  const apiKey = await resolveUserApiKey(ctx.userId, 'elevenlabs')

  if (!apiKey) return stubResponse(name, description, 'no_byok_key')
  if (!params.sample_urls || params.sample_urls.length === 0) {
    return stubResponse(name, description, 'no_sample_urls')
  }

  try {
    const form = new FormData()
    form.append('name', name)
    if (description) form.append('description', description)
    if (params.labels) form.append('labels', JSON.stringify(params.labels))

    for (const url of params.sample_urls) {
      const blob = await fetchAudioBlob(url)
      form.append('files', blob, 'sample.mp3')
    }

    const res = await fetch(ELEVENLABS_VOICES_ADD_URL, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '<unreadable>')
      logger.warn('[voice:clone] ElevenLabs rejected', { status: res.status, body: errorText.slice(0, 500) })
      return {
        ok: false,
        error: `elevenlabs_${res.status}`,
      }
    }

    const data = (await res.json()) as ElevenLabsAddResponse
    return {
      ok: true,
      data: {
        voice_id: data.voice_id ?? 'unknown',
        name: data.name ?? name,
        description,
        status: data.status ?? 'ready',
        requires_verification: data.requires_verification ?? false,
        is_stub: false,
      },
    }
  } catch (err) {
    logger.error('[voice:clone] live call failed', err instanceof Error ? err : new Error(String(err)))
    return { ok: false, error: 'voice_clone_failed' }
  }
}
