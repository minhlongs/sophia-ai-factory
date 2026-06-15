/**
 * Tests for handover email service.
 *
 * Wraps Resend SDK + renderEmail registry for 4 lifecycle emails:
 * sendWelcomeEmail (admin wizard, RETURNS result), sendAutoHandoverWelcomeEmail,
 * sendTierUpgradeEmail, sendPromoCodeWelcomeEmail (all void, swallow errors).
 *
 * Pins: env-gated Resend client, template selection by event, locale-branched
 * promo subject/body, graceful no-key behavior (logs but does not throw).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('resend', () => {
  class MockResend {
    emails = { send: mockSend }
    constructor(public key: string) {}
  }
  return { Resend: MockResend }
})

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

const { mockRenderEmail } = vi.hoisted(() => ({ mockRenderEmail: vi.fn() }))

vi.mock('@/forest/email/render-email', () => ({
  renderEmail: mockRenderEmail,
}))

vi.mock('@/forest/email/templates/shared-layout', () => ({
  SENDER_FROM: 'Sophia AI <noreply@test>',
}))

import {
  sendWelcomeEmail,
  sendAutoHandoverWelcomeEmail,
  sendTierUpgradeEmail,
  sendPromoCodeWelcomeEmail,
} from './handover-email-service'
import { logger } from '@/seed/utils/logger-utility'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('RESEND_API_KEY', 'sk-test-resend')
  mockRenderEmail.mockReturnValue({
    html: '<p>hi</p>',
    text: 'hi',
    subject: 'Welcome',
  })
  mockSend.mockResolvedValue({ data: { id: 'email-1' }, error: null })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('sendWelcomeEmail (admin-wizard variant — returns result)', () => {
  const baseInput = {
    toEmail: 'user@example.com',
    ownerFullName: 'Jane',
    agencyName: 'Acme',
    tier: 'PREMIUM' as const,
    magicLinkUrl: 'https://magic.example/abc',
    locale: 'en',
    handoverMarkdown: '# welcome',
  }

  it('returns logged-only success when RESEND_API_KEY missing (no send)', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const result = await sendWelcomeEmail(baseInput)
    expect(result).toEqual({ success: true, emailId: 'logged-only' })
    expect(mockSend).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Resend not configured'),
      expect.objectContaining({ to: 'user@example.com' }),
    )
  })

  it('renders welcome-magic-link template with input fields', async () => {
    await sendWelcomeEmail(baseInput)
    expect(mockRenderEmail).toHaveBeenCalledWith('welcome-magic-link', {
      ownerFullName: 'Jane',
      tier: 'PREMIUM',
      magicLinkUrl: 'https://magic.example/abc',
      locale: 'en',
      agencyName: 'Acme',
    })
  })

  it('sends via Resend with SENDER_FROM + rendered html/text/subject', async () => {
    await sendWelcomeEmail(baseInput)
    expect(mockSend).toHaveBeenCalledWith({
      from: 'Sophia AI <noreply@test>',
      to: ['user@example.com'],
      subject: 'Welcome',
      html: '<p>hi</p>',
      text: 'hi',
    })
  })

  it('returns success + emailId on Resend success', async () => {
    const result = await sendWelcomeEmail(baseInput)
    expect(result).toEqual({ success: true, emailId: 'email-1' })
  })

  it('returns error result when Resend response carries result.error (stringified)', async () => {
    // service uses String(result.error) — pass Error so .toString() returns message
    mockSend.mockResolvedValueOnce({ data: null, error: new Error('invalid recipient') })
    const result = await sendWelcomeEmail(baseInput)
    expect(result.success).toBe(false)
    expect(result.error).toContain('invalid recipient')
    expect(logger.error).toHaveBeenCalled()
  })

  it('returns error result when send throws', async () => {
    mockSend.mockRejectedValueOnce(new Error('network down'))
    const result = await sendWelcomeEmail(baseInput)
    expect(result).toEqual({ success: false, error: 'network down' })
    expect(logger.error).toHaveBeenCalled()
  })
})

describe('sendAutoHandoverWelcomeEmail (auto-payment variant — void, no return)', () => {
  const baseInput = {
    toEmail: 'auto@example.com',
    ownerFullName: 'Auto User',
    tier: 'BASIC' as const,
    magicLinkUrl: 'https://magic.example/auto',
    locale: 'en',
  }

  it('skips send + logs when RESEND_API_KEY missing', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    await sendAutoHandoverWelcomeEmail(baseInput)
    expect(mockSend).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Auto welcome — Resend not configured'),
      expect.objectContaining({ to: 'auto@example.com' }),
    )
  })

  it('renders welcome-magic-link without agencyName (auto framing)', async () => {
    await sendAutoHandoverWelcomeEmail(baseInput)
    expect(mockRenderEmail).toHaveBeenCalledWith('welcome-magic-link', {
      ownerFullName: 'Auto User',
      tier: 'BASIC',
      magicLinkUrl: 'https://magic.example/auto',
      locale: 'en',
    })
  })

  it('swallows send errors (warn-level, no throw)', async () => {
    mockSend.mockRejectedValueOnce(new Error('timeout'))
    await expect(sendAutoHandoverWelcomeEmail(baseInput)).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Auto welcome send failed'),
      expect.objectContaining({ to: 'auto@example.com', error: 'timeout' }),
    )
  })
})

describe('sendTierUpgradeEmail', () => {
  const baseInput = {
    toEmail: 'up@example.com',
    ownerFullName: 'Up User',
    newTier: 'ENTERPRISE' as const,
    locale: 'en',
  }

  it('skips send when RESEND_API_KEY missing', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    await sendTierUpgradeEmail(baseInput)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('renders tier-upgrade template (not welcome-magic-link)', async () => {
    await sendTierUpgradeEmail(baseInput)
    expect(mockRenderEmail).toHaveBeenCalledWith('tier-upgrade', {
      ownerFullName: 'Up User',
      newTier: 'ENTERPRISE',
      locale: 'en',
    })
  })

  it('swallows send errors (warn-level, no throw)', async () => {
    mockSend.mockRejectedValueOnce(new Error('rate limit'))
    await expect(sendTierUpgradeEmail(baseInput)).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Tier upgrade send failed'),
      expect.objectContaining({ error: 'rate limit' }),
    )
  })
})

describe('sendPromoCodeWelcomeEmail (locale-branched, inline HTML)', () => {
  const baseInput = {
    toEmail: 'promo@example.com',
    ownerFullName: 'Promo User',
    promoCode: 'LAUNCH50',
    discountDescription: '50% off first month',
    tier: 'PREMIUM' as const,
    magicLinkUrl: 'https://magic.example/promo',
    locale: 'en',
  }

  it('skips send when RESEND_API_KEY missing', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    await sendPromoCodeWelcomeEmail(baseInput)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('uses English subject + greeting when locale is en', async () => {
    await sendPromoCodeWelcomeEmail(baseInput)
    const call = mockSend.mock.calls[0][0]
    expect(call.subject).toBe('Code LAUNCH50 activated — Sophia AI Factory')
    expect(call.html).toContain('Hello Promo User,')
    expect(call.html).toContain('Promo code <strong>LAUNCH50</strong>')
    expect(call.html).toContain('Access Sophia Now')
  })

  it('uses Vietnamese subject + greeting when locale starts with vi', async () => {
    await sendPromoCodeWelcomeEmail({ ...baseInput, locale: 'vi-VN' })
    const call = mockSend.mock.calls[0][0]
    expect(call.subject).toBe('Mã LAUNCH50 đã kích hoạt — Sophia AI Factory')
    expect(call.html).toContain('Xin chào Promo User,')
    expect(call.html).toContain('Mã khuyến mãi <strong>LAUNCH50</strong>')
    expect(call.html).toContain('Truy Cập Sophia Ngay')
  })

  it('embeds discountDescription verbatim in HTML', async () => {
    await sendPromoCodeWelcomeEmail(baseInput)
    expect(mockSend.mock.calls[0][0].html).toContain('50% off first month')
  })

  it('embeds magicLinkUrl as CTA href', async () => {
    await sendPromoCodeWelcomeEmail(baseInput)
    expect(mockSend.mock.calls[0][0].html).toContain('href="https://magic.example/promo"')
  })

  it('includes trial note when trialDaysGranted > 0 (en)', async () => {
    await sendPromoCodeWelcomeEmail({ ...baseInput, trialDaysGranted: 14 })
    expect(mockSend.mock.calls[0][0].html).toContain('<strong>14-day free trial</strong>')
  })

  it('includes Vietnamese trial note when locale is vi + trialDaysGranted > 0', async () => {
    await sendPromoCodeWelcomeEmail({ ...baseInput, locale: 'vi', trialDaysGranted: 7 })
    expect(mockSend.mock.calls[0][0].html).toContain('<strong>7 ngày</strong>')
  })

  it('omits trial note when trialDaysGranted is 0 or undefined', async () => {
    await sendPromoCodeWelcomeEmail(baseInput)
    expect(mockSend.mock.calls[0][0].html).not.toMatch(/free trial|dùng thử/)

    mockSend.mockClear()
    await sendPromoCodeWelcomeEmail({ ...baseInput, trialDaysGranted: 0 })
    expect(mockSend.mock.calls[0][0].html).not.toMatch(/free trial|dùng thử/)
  })

  it('embeds support email link', async () => {
    await sendPromoCodeWelcomeEmail(baseInput)
    expect(mockSend.mock.calls[0][0].html).toContain('mailto:support@mekongmind.com')
  })

  it('swallows send errors (warn-level, no throw)', async () => {
    mockSend.mockRejectedValueOnce(new Error('forbidden'))
    await expect(sendPromoCodeWelcomeEmail(baseInput)).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Promo welcome send failed'),
      expect.objectContaining({ error: 'forbidden' }),
    )
  })
})
