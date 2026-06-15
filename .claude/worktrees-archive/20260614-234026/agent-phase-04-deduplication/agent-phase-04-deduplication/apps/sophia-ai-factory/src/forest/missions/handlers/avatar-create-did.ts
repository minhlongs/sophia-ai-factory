/**
 * Handler: avatar:create-did — Generate a talking avatar via D-ID.
 *
 * BYOK-only. Customer must supply D-ID API key (Settings > Integrations).
 * Without a key, returns a structured 402-style result so UI can prompt setup.
 *
 * Mission params:
 *   - source_url (required): https URL to portrait image
 *   - script (required): text-to-speech input
 *   - voice_id (optional): D-ID voice id (default en-US-JennyNeural)
 *   - voice_provider (optional): 'microsoft' | 'elevenlabs'
 */

import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key'
import { createDidTalk, type DidErrorResponse } from '@/land/did/did-client'
import { logger } from '@/seed/utils/logger-utility'
import type { MissionContext, MissionHandlerResult } from './types'

interface AvatarParams {
  source_url?: string
  script?: string
  voice_id?: string
  voice_provider?: 'microsoft' | 'elevenlabs'
}

function parseParams(raw: Record<string, unknown>): AvatarParams {
  return {
    source_url: typeof raw.source_url === 'string' && raw.source_url.startsWith('https://') ? raw.source_url : undefined,
    script: typeof raw.script === 'string' && raw.script.trim().length > 0 ? raw.script : undefined,
    voice_id: typeof raw.voice_id === 'string' ? raw.voice_id : undefined,
    voice_provider: raw.voice_provider === 'elevenlabs' ? 'elevenlabs' : 'microsoft',
  }
}

function isDidError(value: unknown): value is DidErrorResponse {
  return typeof value === 'object' && value !== null && 'code' in value && 'status' in value
}

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const params = parseParams(ctx.params)

  if (!params.source_url || !params.script) {
    return {
      ok: false,
      error: 'missing_params:source_url+script',
    }
  }

  const apiKey = await resolveUserApiKey(ctx.userId, 'd-id')
  if (!apiKey) {
    return {
      ok: false,
      error: 'no_byok_did_key',
    }
  }

  try {
    const talk = await createDidTalk(apiKey, {
      sourceUrl: params.source_url,
      script: params.script,
      voiceId: params.voice_id,
      voiceProvider: params.voice_provider,
    })
    return {
      ok: true,
      data: {
        talk_id: talk.id,
        status: talk.status,
        poll_url: `https://api.d-id.com/talks/${talk.id}`,
        is_stub: false,
      },
    }
  } catch (err) {
    if (isDidError(err)) {
      logger.warn('[avatar:create-did] D-ID error', { code: err.code, status: err.status })
      return { ok: false, error: err.code }
    }
    logger.error('[avatar:create-did] unexpected', err instanceof Error ? err : new Error(String(err)))
    return { ok: false, error: 'avatar_create_failed' }
  }
}
