import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { NextRequest } from 'next/server'
import { getD1 } from '@/seed/db/client'

// Mock dependencies
vi.mock('@/seed/security/cron-auth', () => ({
  verifyCronAuth: vi.fn().mockReturnValue(null),
}))

vi.mock('@/land/fulfillment/compensation', () => ({
  grantCompensationCredit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/land/billing/email/send-bundle-render-failed-email', () => ({
  sendBundleRenderFailedEmail: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/land/cron/run-tracker', () => ({
  recordCronRun: vi.fn().mockResolvedValue(true),
  wasRecentlyRun: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/seed/observability/cron-check-in', () => ({
  startCronCheckIn: vi.fn().mockReturnValue({}),
  finishCronCheckIn: vi.fn(),
  failCronCheckIn: vi.fn(),
}))

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn(),
}))

vi.mock('@/land/video/heygen-helpers', () => ({
  createHeyGenVideo: vi.fn().mockResolvedValue({ videoId: 'heygen-job-1' }),
}))

vi.mock('@/tree/credentials/get-provider-key', () => ({
  getHeyGenKey: vi.fn().mockResolvedValue({ key: 'user-heygen-key' }),
}))

vi.mock('@/seed/db/repositories/videos-repo', () => ({
  listQueuedForRetry: vi.fn().mockResolvedValue([]),
  markVideoProcessing: vi.fn().mockResolvedValue(true),
  recordAttemptCAS: vi.fn().mockResolvedValue(2),
  markPermanentFailureCAS: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/land/fulfillment/retry-backoff', () => ({
  MAX_ATTEMPTS: 5,
  isRetryDue: vi.fn().mockReturnValue(true),
}))

vi.mock('@/land/fulfillment/circuit-breaker', () => ({
  shouldDispatch: vi.fn().mockResolvedValue({ allowed: true }),
  recordHeyGenAttempt: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { listQueuedForRetry, markPermanentFailureCAS } from '@/seed/db/repositories/videos-repo'
import { isRetryDue } from '@/land/fulfillment/retry-backoff'
import { createHeyGenVideo } from '@/land/video/heygen-helpers'
import { createServerClient } from '@/seed/db/client'
import { grantCompensationCredit } from '@/land/fulfillment/compensation'
import { sendBundleRenderFailedEmail } from '@/land/billing/email/send-bundle-render-failed-email'

describe('fulfillment-retry cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock getD1() to return raw D1Database with prepare() for wasRecentlyRun/recordCronRun
    const mockRawDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({}),
        }),
      }),
    }
    vi.mocked(getD1).mockReturnValue(mockRawDb as any)

    const makeSingle = (data: unknown) =>
      vi.fn().mockResolvedValue({ data, error: null })
    const mockDb = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'user_purchases') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: makeSingle({ status: 'paid' }),
          }
        }
        if (table === 'user') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: makeSingle({ email: 'user@test.com', locale: 'vi' }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: makeSingle(null),
        }
      }),
    }
    vi.mocked(createServerClient).mockReturnValue(mockDb as any)
  })

  it('runs successfully when no due rows exist', async () => {
    vi.mocked(listQueuedForRetry).mockResolvedValue([])
    
    const req = new NextRequest('http://localhost/api/cron/fulfillment-retry')
    const res = await GET(req)
    const data = (await res.json()) as any
    
    expect(res.status).toBe(200)
    expect(data.status).toBe('ok')
    expect(data.retried).toBe(0)
  })

  it('processes due rows concurrently in chunks', async () => {
    // Return 6 queued rows
    const mockRows = Array.from({ length: 6 }, (_, i) => ({
      id: `vid-${i}`,
      user_id: `user-${i}`,
      purchase_id: `purch-${i}`,
      status: 'queued' as const,
      attempt_count: 1,
      last_attempt_at: 1000,
      script: 'hello',
    }))
    
    vi.mocked(listQueuedForRetry).mockResolvedValue(mockRows as any)
    vi.mocked(isRetryDue).mockReturnValue(true) // all are due
    
    const req = new NextRequest('http://localhost/api/cron/fulfillment-retry')
    const res = await GET(req)
    const data = (await res.json()) as any
    
    expect(res.status).toBe(200)
    expect(data.status).toBe('ok')
    expect(data.retried).toBe(6)
    expect(data.succeeded).toBe(6)
    
    // Check that createHeyGenVideo was called for each row
    expect(createHeyGenVideo).toHaveBeenCalledTimes(6)
  })

  it('filters rows that are not due', async () => {
    const mockRows = [
      { id: 'vid-0', user_id: 'user-0', status: 'queued', attempt_count: 1 },
      { id: 'vid-1', user_id: 'user-1', status: 'queued', attempt_count: 2 },
    ]
    
    vi.mocked(listQueuedForRetry).mockResolvedValue(mockRows as any)
    // Only first row is due
    vi.mocked(isRetryDue).mockImplementation((attempt_count) => attempt_count === 1)
    
    const req = new NextRequest('http://localhost/api/cron/fulfillment-retry')
    const res = await GET(req)
    const data = (await res.json()) as any
    
    expect(data.retried).toBe(1)
    expect(data.skipped).toBe(1)
    expect(createHeyGenVideo).toHaveBeenCalledTimes(1)
  })

  it('M4: handles permanent failure retry — grants compensation and sends email if paid', async () => {
    const mockRows = [
      { id: 'vid-0', user_id: 'user-0', purchase_id: 'purch-0', status: 'queued', attempt_count: 4 },
    ]
    vi.mocked(listQueuedForRetry).mockResolvedValue(mockRows as any)
    vi.mocked(isRetryDue).mockReturnValue(true)
    vi.mocked(createHeyGenVideo).mockRejectedValue(new Error('HeyGen offline'))
    vi.mocked(markPermanentFailureCAS).mockResolvedValue(true)

    const req = new NextRequest('http://localhost/api/cron/fulfillment-retry')
    const res = await GET(req)
    const data = (await res.json()) as any

    expect(data.status).toBe('ok')
    expect(data.retried).toBe(1)
    expect(data.permanent).toBe(1)
    expect(vi.mocked(grantCompensationCredit)).toHaveBeenCalledWith('purch-0', 'render_failed_permanent')
    expect(vi.mocked(sendBundleRenderFailedEmail)).toHaveBeenCalledOnce()
  })

  it('M4: handles permanent failure retry — skips email and compensation if refunded', async () => {
    const mockRows = [
      { id: 'vid-0', user_id: 'user-0', purchase_id: 'purch-0', status: 'queued', attempt_count: 4 },
    ]
    vi.mocked(listQueuedForRetry).mockResolvedValue(mockRows as any)
    vi.mocked(isRetryDue).mockReturnValue(true)
    vi.mocked(createHeyGenVideo).mockRejectedValue(new Error('HeyGen offline'))
    vi.mocked(markPermanentFailureCAS).mockResolvedValue(true)

    // Override DB to return refunded status
    const makeSingle = (data: unknown) =>
      vi.fn().mockResolvedValue({ data, error: null })
    const mockDbRefunded = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'user_purchases') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: makeSingle({ status: 'refunded' }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: makeSingle(null),
        }
      }),
    }
    vi.mocked(createServerClient).mockReturnValue(mockDbRefunded as any)

    const req = new NextRequest('http://localhost/api/cron/fulfillment-retry')
    const res = await GET(req)
    const data = (await res.json()) as any

    expect(data.status).toBe('ok')
    expect(data.retried).toBe(1)
    expect(data.permanent).toBe(1)
    expect(vi.mocked(grantCompensationCredit)).not.toHaveBeenCalled()
    expect(vi.mocked(sendBundleRenderFailedEmail)).not.toHaveBeenCalled()
  })
})
