/**
 * GET /api/media/status?id=<jobId>
 *
 * Poll media generation job status.
 * Enforces strict per-user job ownership via D1 `media_jobs` before polling provider,
 * returns terminal (`completed` / `failed`) rows directly from D1 cache, and uses the
 * caller's own BYOK `'muapi'` key when refreshing in-flight jobs.
 */

// @allow-mutating-get: syncs owned media_jobs status from MuAPI scoped by id and user_id

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getJobStatus,
  type JobStatus,
  type MediaJob,
  type MediaType,
} from '@/tree/clients/muapi-media-client'
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key'
import { logger } from '@/seed/utils/logger-utility'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { getD1 } from '@/seed/db/client'

const StatusParams = z.object({
  id: z
    .string()
    .min(1)
    .max(128)
    .refine((val) => val === val.trim() && !/[/\\?#%\s]/.test(val) && val !== '.' && val !== '..', {
      message: 'Invalid job id format',
    }),
})

interface MediaJobOwnershipRow {
  id?: string
  user_id: string
  type?: string | null
  model?: string | null
  status?: string | null
  result_url?: string | null
  thumbnail_url?: string | null
  error?: string | null
  created_at?: number | string | null
  completed_at?: number | string | null
}

type D1Handle = NonNullable<Awaited<ReturnType<typeof getD1>>>

function toIsoTimestamp(value: number | string | null | undefined): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString()
  }
  if (typeof value === 'string' && value.length > 0) {
    return value
  }
  return undefined
}

function toCachedMediaJob(jobId: string, row: MediaJobOwnershipRow): MediaJob {
  return {
    id: row.id ?? jobId,
    status: (row.status ?? 'completed') as JobStatus,
    type: (row.type ?? 'video') as MediaType,
    model: row.model ?? '',
    resultUrl: row.result_url ?? undefined,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    error: row.error ?? undefined,
    createdAt: toIsoTimestamp(row.created_at) ?? new Date(0).toISOString(),
    completedAt: toIsoTimestamp(row.completed_at),
  }
}

function isTerminalStatus(status: string | null | undefined): boolean {
  return status === 'completed' || status === 'failed'
}

async function persistMediaJobStatus(
  d1: D1Handle,
  jobId: string,
  userId: string,
  remote: MediaJob,
): Promise<void> {
  const completedAtSec = isTerminalStatus(remote.status) ? Math.floor(Date.now() / 1000) : null
  try {
    const updateStmt = d1
      .prepare(
        "UPDATE media_jobs SET status = ?1, result_url = ?2, thumbnail_url = ?3, error = ?4, completed_at = COALESCE(?5, completed_at) WHERE id = ?6 AND user_id = ?7 AND status NOT IN ('completed', 'failed')",
      )
      .bind(
        remote.status,
        remote.resultUrl ?? null,
        remote.thumbnailUrl ?? null,
        remote.error ?? null,
        completedAtSec,
        jobId,
        userId,
      )
    if (typeof updateStmt.run === 'function') {
      await updateStmt.run()
    }
  } catch (writeErr) {
    logger.warn('[media/status] D1 status write-back failed', {
      id: jobId,
      error: writeErr instanceof Error ? writeErr.message : String(writeErr),
    })
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const parsed = StatusParams.safeParse({ id: req.nextUrl.searchParams.get('id') })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Missing or invalid id parameter', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const { id: jobId } = parsed.data

    const d1 = await getD1()
    if (!d1) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    }
    const ownerRow = await d1
      .prepare(
        'SELECT id, user_id, type, model, status, result_url, thumbnail_url, error, created_at, completed_at FROM media_jobs WHERE id = ?1 AND user_id = ?2 LIMIT 1',
      )
      .bind(jobId, user.id)
      .first<MediaJobOwnershipRow>()

    if (!ownerRow || ownerRow.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: job does not belong to current user' },
        { status: 403 },
      )
    }

    if (isTerminalStatus(ownerRow.status)) {
      return NextResponse.json(toCachedMediaJob(jobId, ownerRow))
    }

    const rawApiKey = await resolveUserApiKey(user.id, 'muapi')
    const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : ''
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'MuAPI API key not configured. Add your MuAPI key in the Setup Wizard.',
          code: 'NO_API_KEY',
        },
        { status: 422 },
      )
    }

    const result = await getJobStatus(jobId, { fund: 'byok', apiKey })
    if (!result.success || !result.job) {
      return NextResponse.json(
        { error: result.error || 'Failed to get job status' },
        { status: 502 },
      )
    }

    await persistMediaJobStatus(d1, jobId, user.id, result.job)
    return NextResponse.json(result.job)
  } catch (error) {
    logger.error('[media/status] GET error', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: 'Failed to get media status' }, { status: 500 })
  }
}
