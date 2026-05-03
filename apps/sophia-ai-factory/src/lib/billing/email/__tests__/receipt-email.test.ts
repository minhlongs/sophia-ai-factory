/**
 * Receipt email tests — template rendering + idempotency logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderReceipt } from '../receipt-email-template'

const baseInput = {
  email: 'user@example.com',
  tier: 'PREMIUM',
  period: 'monthly' as const,
  amountUsd: 399,
  paymentId: 'pay_abc12345_full',
  paymentMethod: 'nowpayments' as const,
  orderId: 'sophia_user123_1700000000000',
  locale: 'en',
}

describe('renderReceipt', () => {
  it('renders correct subject and HTML in English', () => {
    const { subject, html, text } = renderReceipt(baseInput)
    expect(subject).toContain('Receipt')
    expect(subject).toContain('Growth')
    expect(html).toContain('$399.00 USD')
    expect(html).toContain('pay_abc1') // truncated paymentId
    expect(text).toContain('support@sophia.agencyos.network')
  })

  it('renders Vietnamese subject and HTML', () => {
    const { subject, html, text } = renderReceipt({ ...baseInput, locale: 'vi' })
    expect(subject).toContain('Hóa đơn')
    expect(html).toContain('VAT 10%')
    expect(text).toContain('VAT')
    expect(html).toContain('Gói dịch vụ')
  })

  it('includes truncated paymentId (only first 8 chars)', () => {
    const { html } = renderReceipt(baseInput)
    // full paymentId: pay_abc12345_full — first 8 chars: pay_abc1
    expect(html).toContain('pay_abc1')
    expect(html).not.toContain('pay_abc12345_full')
  })

  it('renders lifetime period correctly for MASTER', () => {
    const { html, text } = renderReceipt({ ...baseInput, period: 'lifetime', tier: 'MASTER', amountUsd: 4999 })
    expect(html).toContain('4999')
    expect(text).toContain('Lifetime')
  })
})

describe('sendReceiptEmail idempotency (skips when receipt_sent=1)', () => {
  const receiptSentMap = new Map<string, number>()

  vi.mock('@/seed/db/client', () => ({
    createServerClient: () => ({
      from: () => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: { receipt_sent: receiptSentMap.get('nowpayments_pay_idempotent') ?? 0 },
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(async () => {
            receiptSentMap.set('nowpayments_pay_idempotent', 1)
            return { data: null }
          }),
        })),
      }),
    }),
  }))

  beforeEach(() => {
    receiptSentMap.clear()
  })

  it('skips send when receipt_sent=1 (idempotent)', async () => {
    // Pre-mark as sent
    receiptSentMap.set('nowpayments_pay_idempotent', 1)

    // Mock resend to fail if called — should never be called
    vi.doMock('resend', () => ({
      Resend: vi.fn(() => ({
        emails: { send: vi.fn().mockRejectedValue(new Error('Should not be called')) },
      })),
    }))

    const { sendReceiptEmail } = await import('../receipt-email-sender')
    // Should NOT throw even though Resend would fail (idempotent skip)
    await expect(sendReceiptEmail({ ...baseInput, paymentId: 'pay_idempotent' })).resolves.toBeUndefined()
  })
})
