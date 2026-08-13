/**
 * D-ID API client — Talking Avatar generation.
 *
 * Single endpoint covered: POST https://api.d-id.com/talks
 * BYOK-only — caller must pass an API key resolved via resolveUserApiKey().
 *
 * D-ID `/talks` returns a `talk_id` (job reference). The caller is responsible
 * for polling `GET /talks/{id}` until `status === 'done'` to retrieve `result_url`.
 * This thin client only initiates the job; polling lives in callers / cron.
 */

import { logger } from '@/seed/utils/logger-utility'
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError } from '@/seed/types/failure-kind'

const DID_TALKS_URL = 'https://api.d-id.com/talks'

export interface DidTalkRequest {
  /** Public URL to a portrait image of the speaker. */
  sourceUrl: string
  /** Text-to-speech script to be spoken. */
  script: string
  /** D-ID provider voice ID (e.g. `en-US-JennyNeural`). Default: en-US-JennyNeural. */
  voiceId?: string
  /** Speech provider — `microsoft` or `elevenlabs`. Default microsoft. */
  voiceProvider?: 'microsoft' | 'elevenlabs'
}

export interface DidTalkResponse {
  /** D-ID talk ID — use to poll for completion. */
  id: string
  /** Initial status returned by D-ID (usually `created`). */
  status: string
}

export interface DidErrorResponse {
  code: string
  status: number
  message: string
}

/**
 * Initiate a D-ID talking avatar generation job.
 *
 * @throws DidErrorResponse on non-2xx HTTP response.
 */
export async function createDidTalk(apiKey: string, req: DidTalkRequest): Promise<DidTalkResponse> {
  if (!shouldAllowRequest('did')) {
    throw { code: 'did_circuit_open', status: 503, message: 'Circuit breaker open for D-ID — too many failures' } as DidErrorResponse
  }

  const payload = {
    source_url: req.sourceUrl,
    script: {
      type: 'text',
      input: req.script,
      provider: {
        type: req.voiceProvider ?? 'microsoft',
        voice_id: req.voiceId ?? 'en-US-JennyNeural',
      },
    },
  }

  try {
    const res = await fetch(DID_TALKS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const body = await res.text().catch((err) => {
        logger.warn('Failed to read response text', { error: String(err), context: 'createDidTalk' });
        return '<unreadable>';
      })
      logger.warn('[did-client] /talks rejected', { status: res.status, body: body.slice(0, 500) })
      const kind = classifyError(new Error(`HTTP ${res.status}`))
      recordFailure('did', kind)
      const err: DidErrorResponse = {
        code: `did_${res.status}`,
        status: res.status,
        message: body.slice(0, 300),
      }
      throw err
    }

    const data = (await res.json()) as { id?: string; status?: string }
    if (!data.id) {
      const err: DidErrorResponse = { code: 'did_no_id', status: 500, message: 'D-ID response missing id' }
      throw err
    }
    recordSuccess('did')
    return { id: data.id, status: data.status ?? 'created' }
  } catch (err) {
    if ((err as DidErrorResponse).code) throw err
    const kind = classifyError(err)
    recordFailure('did', kind)
    throw err
  }
}
