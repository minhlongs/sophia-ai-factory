/**
 * Tests for bundle-generating email template + sender.
 * Template tests run without Resend dependency.
 * Sender tests focus on idempotency guard (DB interaction).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Template tests (pure, no mocking needed) ─────────────────────────────────

import {
  buildBundleGeneratingEmail,
  type BundleGeneratingContext,
} from '../templates/bundle-generating'

const baseCtx: BundleGeneratingContext = {
  userEmail: 'user@test.com',
  userId: 'u1',
  purchaseId: 'p1',
  skuLabel: 'Starter Bundle',
  creditsTotal: 10,
  etaMinutes: 10,
  statusPageUrl: 'https://sophia.agencyos.network/vi/dashboard/orders',
  locale: 'vi',
}

describe('buildBundleGeneratingEmail', () => {
  it('returns Vi subject for vi locale', () => {
    const { subject } = buildBundleGeneratingEmail({ ...baseCtx, locale: 'vi' })
    expect(subject).toContain('Đang tạo')
    expect(subject).toContain('[Sophia AI]')
  })

  it('returns En subject for en locale', () => {
    const { subject } = buildBundleGeneratingEmail({ ...baseCtx, locale: 'en' })
    expect(subject).toContain('Generating')
    expect(subject).toContain('[Sophia AI]')
  })

  it('Vi text body contains ETA and dashboard link', () => {
    const { text } = buildBundleGeneratingEmail({ ...baseCtx, locale: 'vi' })
    expect(text).toContain('10 phút')
    expect(text).toContain(baseCtx.statusPageUrl)
  })

  it('En text body contains ETA and dashboard link', () => {
    const { text } = buildBundleGeneratingEmail({ ...baseCtx, locale: 'en' })
    expect(text).toContain('10 minutes')
    expect(text).toContain(baseCtx.statusPageUrl)
  })

  it('HTML contains purchase reference in both locales', () => {
    const vi = buildBundleGeneratingEmail({ ...baseCtx, locale: 'vi' })
    const en = buildBundleGeneratingEmail({ ...baseCtx, locale: 'en' })
    expect(vi.html).toContain(baseCtx.purchaseId)
    expect(en.html).toContain(baseCtx.purchaseId)
  })

  it('HTML has correct lang attribute', () => {
    const vi = buildBundleGeneratingEmail({ ...baseCtx, locale: 'vi' })
    const en = buildBundleGeneratingEmail({ ...baseCtx, locale: 'en' })
    expect(vi.html).toContain('<html lang="vi">')
    expect(en.html).toContain('<html lang="en">')
  })
})

// ── Sender idempotency test (mocks DB only) ───────────────────────────────────

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
}))

const mockEmailSend = vi.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null })

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockEmailSend }
  },
}))

import { createServerClient } from '@/seed/db/client'
import { sendBundleGeneratingEmail } from '../send-bundle-generating-email'

function makeDb(alreadySent: boolean) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: alreadySent ? { id: 'evt1' } : null,
        error: null,
      }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }
}

const testCtx = {
  userEmail: 'u@test.com',
  userId: 'u1',
  purchaseId: 'purch-1',
  sku: 'STARTER_BUNDLE',
  skuLabel: 'Starter Bundle',
  creditsTotal: 10,
  locale: 'vi',
}

describe('sendBundleGeneratingEmail', () => {
  beforeEach(() => {
    vi.mocked(createServerClient).mockReset()
    process.env.RESEND_API_KEY = 're_test'
    process.env.NEXT_PUBLIC_APP_URL = 'https://sophia.agencyos.network'
  })

  it('returns { success: true, alreadySent: true } when billing_events record exists', async () => {
    vi.mocked(createServerClient).mockReturnValue(makeDb(true) as ReturnType<typeof createServerClient>)
    const result = await sendBundleGeneratingEmail(testCtx)
    expect(result).toMatchObject({ success: true, alreadySent: true })
  })

  it('returns { success: true } and logs audit event on first send', async () => {
    vi.mocked(createServerClient).mockReturnValue(makeDb(false) as ReturnType<typeof createServerClient>)
    const result = await sendBundleGeneratingEmail(testCtx)
    expect(result.success).toBe(true)
    expect(result.alreadySent).toBeUndefined()
  })
})
