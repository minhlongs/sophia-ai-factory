/**
 * Unit tests for complete-video-from-webhook.ts
 * Tests idempotency, state transitions, CAS atomicity, and M4 refund-mid-render.
 *
 * M2: CAS variants (markPermanentFailureCAS, recordAttemptCAS) prevent double
 *   email + double compensation when webhook + cron race on the same row.
 * M4: completeVideoFromWebhook skips ready email when purchase is refunded.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock deps ────────────────────────────────────────────────────────────────

vi.mock('@/seed/db/repositories/videos-repo', () => ({
  findByHeygenJobId: vi.fn(),
  markPermanentFailureCAS: vi.fn().mockResolvedValue(true),
  recordAttemptCAS: vi.fn().mockResolvedValue(2),
}))

vi.mock('@/seed/db/client', () => ({
  getD1Raw: vi.fn(),
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/video/video-storage-service', () => ({
  downloadAndStore: vi.fn().mockResolvedValue({ path: 'videos/u1/v1.mp4', sizeBytes: 1024, permanentUrl: '', bucket: 'test' }),
}))

vi.mock('@/land/billing/email/send-one-time-bundle-ready-email', () => ({
  sendOneTimeBundleReadyEmail: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/land/billing/email/send-bundle-render-failed-email', () => ({
  sendBundleRenderFailedEmail: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/fulfillment/compensation', () => ({
  grantCompensationCredit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/seed/db/get-user-credits', () => ({
  getUserCredits: vi.fn().mockResolvedValue({ creditsRemaining: 5, expiresAt: null }),
}))

vi.mock('@/lib/fulfillment/retry-backoff', () => ({
  MAX_ATTEMPTS: 5,
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

import {
  findByHeygenJobId,
  markPermanentFailureCAS,
  recordAttemptCAS,
} from '@/seed/db/repositories/videos-repo'
import { getD1Raw, createServerClient } from '@/seed/db/client'
import { sendOneTimeBundleReadyEmail } from '@/land/billing/email/send-one-time-bundle-ready-email'
import { sendBundleRenderFailedEmail } from '@/land/billing/email/send-bundle-render-failed-email'
import { grantCompensationCredit } from '@/lib/fulfillment/compensation'
import { completeVideoFromWebhook, failVideoFromWebhook } from '../complete-video-from-webhook'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const processingRow = {
  id: 'vid-1',
  user_id: 'user-1',
  purchase_id: 'purch-1',
  heygen_job_id: 'heygen-abc',
  title: 'Test',
  status: 'processing' as const,
  script: 'Hello',
  locale: 'vi',
  provider: 'heygen',
  attempt_count: 1,
  last_attempt_at: 1000,
  last_error: null,
  created_at: 900,
}

function makeD1() {
  const runFn = vi.fn().mockResolvedValue({ success: true })
  const bindFn = vi.fn().mockReturnValue({ run: runFn })
  const prepareFn = vi.fn().mockReturnValue({ bind: bindFn })
  return { prepare: prepareFn }
}

/**
 * makeDb: returns a mock Supabase client.
 * purchaseStatus defaults to 'paid' — pass 'refunded' to test M4 path.
 */
function makeDb(
  userRow: { email: string; locale: string } | null = { email: 'u@test.com', locale: 'vi' },
  purchaseStatus = 'paid',
) {
  const makeSingle = (data: unknown) =>
    vi.fn().mockResolvedValue({ data, error: null })

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'user') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: makeSingle(userRow),
        }
      }
      if (table === 'user_purchases') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: makeSingle({ status: purchaseStatus }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: makeSingle(null),
      }
    }),
  }
}

// ── completeVideoFromWebhook ─────────────────────────────────────────────────

describe('completeVideoFromWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getD1Raw).mockResolvedValue(makeD1() as unknown as D1Database)
    vi.mocked(createServerClient).mockReturnValue(makeDb() as unknown as ReturnType<typeof createServerClient>)
  })

  it('updates video to completed and sends ready email', async () => {
    vi.mocked(findByHeygenJobId).mockResolvedValue(processingRow)

    await completeVideoFromWebhook({
      video_id: 'heygen-abc',
      video_url: 'https://cdn.heygen.com/video.mp4',
    })

    expect(sendOneTimeBundleReadyEmail).toHaveBeenCalledOnce()
  })

  it('is idempotent: no mutation when row is already completed', async () => {
    vi.mocked(findByHeygenJobId).mockResolvedValue({ ...processingRow, status: 'completed' })

    await completeVideoFromWebhook({
      video_id: 'heygen-abc',
      video_url: 'https://cdn.heygen.com/video.mp4',
    })

    // D1 should NOT have been called to update
    expect(getD1Raw).not.toHaveBeenCalled()
  })

  it('returns early and does not send email when heygen_job_id unknown', async () => {
    vi.mocked(findByHeygenJobId).mockResolvedValue(null)

    await completeVideoFromWebhook({ video_id: 'unknown-id', video_url: 'https://cdn.heygen.com/video.mp4' })

    expect(sendOneTimeBundleReadyEmail).not.toHaveBeenCalled()
  })

  it('does not send email when purchase_id is null (non-bundle video)', async () => {
    vi.mocked(findByHeygenJobId).mockResolvedValue({ ...processingRow, purchase_id: null })

    await completeVideoFromWebhook({ video_id: 'heygen-abc', video_url: 'https://cdn.heygen.com/video.mp4' })

    expect(sendOneTimeBundleReadyEmail).not.toHaveBeenCalled()
  })

  it('M4: skips ready email when purchase is refunded (refund-mid-render)', async () => {
    vi.mocked(findByHeygenJobId).mockResolvedValue(processingRow)
    // Override DB to return refunded purchase status
    vi.mocked(createServerClient).mockReturnValue(
      makeDb({ email: 'u@test.com', locale: 'vi' }, 'refunded') as unknown as ReturnType<typeof createServerClient>,
    )

    await completeVideoFromWebhook({
      video_id: 'heygen-abc',
      video_url: 'https://cdn.heygen.com/video.mp4',
    })

    // Email must NOT be sent post-refund
    expect(sendOneTimeBundleReadyEmail).not.toHaveBeenCalled()
  })
})

// ── failVideoFromWebhook ────────────────────────────────────────────────────

describe('failVideoFromWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getD1Raw).mockResolvedValue(makeD1() as unknown as D1Database)
    vi.mocked(createServerClient).mockReturnValue(makeDb() as unknown as ReturnType<typeof createServerClient>)
    vi.mocked(markPermanentFailureCAS).mockResolvedValue(true)
    vi.mocked(recordAttemptCAS).mockResolvedValue(2)
  })

  it('records attempt (CAS) when below MAX_ATTEMPTS threshold', async () => {
    vi.mocked(findByHeygenJobId).mockResolvedValue({ ...processingRow, attempt_count: 2 })

    await failVideoFromWebhook({ video_id: 'heygen-abc', error: 'timeout' })

    expect(recordAttemptCAS).toHaveBeenCalledWith('vid-1', 'timeout')
    expect(markPermanentFailureCAS).not.toHaveBeenCalled()
  })

  it('marks permanent failure (CAS) and compensates when attempt_count reaches MAX_ATTEMPTS', async () => {
    vi.mocked(findByHeygenJobId).mockResolvedValue({ ...processingRow, attempt_count: 4 })

    await failVideoFromWebhook({ video_id: 'heygen-abc', error: 'api_error' })

    expect(markPermanentFailureCAS).toHaveBeenCalledWith('vid-1', 'api_error', 4)
    expect(grantCompensationCredit).toHaveBeenCalledWith('purch-1', 'render_failed_permanent')
    expect(sendBundleRenderFailedEmail).toHaveBeenCalledOnce()
  })

  it('M2: CAS lost on permanent failure — skips email + compensation', async () => {
    vi.mocked(findByHeygenJobId).mockResolvedValue({ ...processingRow, attempt_count: 4 })
    // Simulate CAS loss: another caller already won
    vi.mocked(markPermanentFailureCAS).mockResolvedValue(false)

    await failVideoFromWebhook({ video_id: 'heygen-abc', error: 'api_error' })

    // Must NOT double-send email or grant credit
    expect(grantCompensationCredit).not.toHaveBeenCalled()
    expect(sendBundleRenderFailedEmail).not.toHaveBeenCalled()
  })

  it('M2: CAS lost on recordAttempt — skips duplicate increment', async () => {
    vi.mocked(findByHeygenJobId).mockResolvedValue({ ...processingRow, attempt_count: 2 })
    // Simulate CAS loss: row already transitioned
    vi.mocked(recordAttemptCAS).mockResolvedValue(null)

    await failVideoFromWebhook({ video_id: 'heygen-abc', error: 'timeout' })

    // No permanent failure should be triggered
    expect(markPermanentFailureCAS).not.toHaveBeenCalled()
    expect(sendBundleRenderFailedEmail).not.toHaveBeenCalled()
  })

  it('is idempotent: no-op when row is already failed_permanent', async () => {
    vi.mocked(findByHeygenJobId).mockResolvedValue({ ...processingRow, status: 'failed_permanent' })

    await failVideoFromWebhook({ video_id: 'heygen-abc', error: 'timeout' })

    expect(recordAttemptCAS).not.toHaveBeenCalled()
    expect(markPermanentFailureCAS).not.toHaveBeenCalled()
  })
})
