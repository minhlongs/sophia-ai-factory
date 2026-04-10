/**
 * MuAPI Media Generation Client
 *
 * REST client for muapi.ai — unified API for 100+ AI media models.
 * Supports image (Midjourney, Flux), video (Kling, Seedance, Veo3),
 * and audio (Suno, MMAudio) generation with async polling.
 *
 * Ref: github.com/SamurAIGPT/Generative-Media-Skills
 */

const MUAPI_BASE = 'https://api.muapi.ai/v1'

export type MediaType = 'image' | 'video' | 'audio'
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface MediaGenerationRequest {
  type: MediaType
  model: string
  prompt: string
  negativePrompt?: string
  aspectRatio?: string
  duration?: number
  style?: string
  seed?: number
  imageUrl?: string
}

export interface MediaJob {
  id: string
  status: JobStatus
  type: MediaType
  model: string
  resultUrl?: string
  thumbnailUrl?: string
  progress?: number
  error?: string
  createdAt: string
  completedAt?: string
}

export interface MediaGenerationResult {
  success: boolean
  job?: MediaJob
  error?: string
}

/** Supported models per media type */
export const SUPPORTED_MODELS: Record<MediaType, string[]> = {
  image: ['midjourney-v7', 'flux-schnell', 'flux-dev', 'hidream', 'flux-kontext'],
  video: ['kling-3.0', 'seedance-2.0', 'veo3', 'kling-lip-sync'],
  audio: ['suno-v4', 'mmaudio'],
}

function getApiKey(): string {
  const key = process.env.MUAPI_API_KEY
  if (!key) throw new Error('MUAPI_API_KEY not configured')
  return key
}

/**
 * Submit a media generation job to muapi.ai
 */
export async function submitMediaJob(
  req: MediaGenerationRequest
): Promise<MediaGenerationResult> {
  try {
    const res = await fetch(`${MUAPI_BASE}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        type: req.type,
        model: req.model,
        prompt: req.prompt,
        negative_prompt: req.negativePrompt,
        aspect_ratio: req.aspectRatio || '16:9',
        duration: req.duration,
        style: req.style,
        seed: req.seed,
        image_url: req.imageUrl,
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      return { success: false, error: `MuAPI ${res.status}: ${errBody.slice(0, 200)}` }
    }

    const data = (await res.json()) as {
      id: string
      status: string
      created_at: string
    }

    return {
      success: true,
      job: {
        id: data.id,
        status: (data.status as JobStatus) || 'pending',
        type: req.type,
        model: req.model,
        createdAt: data.created_at,
      },
    }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Poll job status from muapi.ai
 */
export async function getJobStatus(jobId: string): Promise<MediaGenerationResult> {
  try {
    const res = await fetch(`${MUAPI_BASE}/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${getApiKey()}` },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      return { success: false, error: `MuAPI ${res.status}` }
    }

    const data = (await res.json()) as {
      id: string
      status: string
      type: string
      model: string
      result_url?: string
      thumbnail_url?: string
      progress?: number
      error?: string
      created_at: string
      completed_at?: string
    }

    return {
      success: true,
      job: {
        id: data.id,
        status: data.status as JobStatus,
        type: data.type as MediaType,
        model: data.model,
        resultUrl: data.result_url,
        thumbnailUrl: data.thumbnail_url,
        progress: data.progress,
        error: data.error,
        createdAt: data.created_at,
        completedAt: data.completed_at,
      },
    }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Check if a model is supported
 */
export function isModelSupported(type: MediaType, model: string): boolean {
  return SUPPORTED_MODELS[type]?.includes(model) ?? false
}
