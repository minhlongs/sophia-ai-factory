/**
 * Channel Distribution Dispatcher
 * Layer: forest/publishing/bundle
 */

import type { ChannelProvider } from '../publisher-interface'
import {
  SERVICE_NAME,
  type ChannelPublishResult,
} from './types'
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind'

export interface DispatchChannelPublishOptions {
  videoId: string;
  provider: ChannelProvider;
  caption?: string;
  scheduledAt?: number;
}

/**
 * Dispatches a publish job to the video distribution API endpoint with circuit breaker protection.
 */
export async function dispatchChannelPublish(
  opts: DispatchChannelPublishOptions
): Promise<ChannelPublishResult> {
  const { videoId, provider, caption, scheduledAt } = opts

  if (!shouldAllowRequest(SERVICE_NAME)) {
    return {
      provider,
      status: 'failed',
      errorMessage: `[circuit-breaker] Circuit open for ${SERVICE_NAME}`,
    }
  }

  try {
    const res = await fetch(`/api/v1/videos/${videoId}/distribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelProviders: [provider],
        caption: caption || undefined,
        scheduledAt,
      }),
    })

    if (!res.ok) {
      const kind = classifyHttpStatus(res.status)
      recordFailure(SERVICE_NAME, kind)
      const errorData = (await res.json().catch(() => ({}))) as { error?: string }
      return {
        provider,
        status: 'failed',
        errorMessage: errorData.error ?? `HTTP ${res.status}`,
      }
    }

    recordSuccess(SERVICE_NAME)
    const data = (await res.json()) as { jobIds?: string[] }
    return {
      provider,
      status: 'success',
      jobId: data.jobIds?.[0],
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('[circuit-breaker]')) throw err
    const kind = classifyError(err)
    recordFailure(SERVICE_NAME, kind)
    return {
      provider,
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : 'Network error',
    }
  }
}
