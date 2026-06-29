/**
 * Contract tests: IPN Payload Schema (Zod validation)
 *
 * Verifies:
 * - Valid payloads pass schema validation
 * - Invalid payloads are rejected with specific ZodError shape
 * - Edge cases: missing required fields, wrong types, boundary values
 *
 * @vitest
 */

import { describe, it, expect } from 'vitest'
import { ipnPayloadSchema } from '../ipn-payload-schema'
import { buildIpnPayload } from './d1-mock-factory'

describe('ipnPayloadSchema — valid inputs', () => {
  it('accepts minimal finished payload', () => {
    const payload = buildIpnPayload()
    const result = ipnPayloadSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('accepts all payment_status values', () => {
    const statuses = ['waiting', 'confirming', 'confirmed', 'sending', 'partially_paid', 'finished', 'failed', 'refunded', 'expired'] as const
    for (const status of statuses) {
      const result = ipnPayloadSchema.safeParse(buildIpnPayload({ payment_status: status }))
      expect(result.success).toBe(true)
    }
  })

  it('accepts payload with optional fields', () => {
    const payload = buildIpnPayload({
      pay_address: '0x123abc',
      pay_amount: 199,
      pay_currency: 'USDT',
      outcome_amount: 198.5,
      outcome_currency: 'USD',
      order_description: 'Test order',
      customer_email: 'test@example.com',
    })
    const result = ipnPayloadSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('accepts payload without optional fields', () => {
    const payload = { payment_id: 'pay_123', payment_status: 'finished', price_amount: 199, price_currency: 'USD' }
    const result = ipnPayloadSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })
})

describe('ipnPayloadSchema — invalid inputs', () => {
  it('rejects missing payment_id', () => {
    const payload = { payment_status: 'finished', price_amount: 199, price_currency: 'USD' }
    const result = ipnPayloadSchema.safeParse(payload)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('payment_id'))).toBe(true)
    }
  })

  it('rejects missing payment_status', () => {
    const payload = { payment_id: 'pay_123', price_amount: 199, price_currency: 'USD' }
    const result = ipnPayloadSchema.safeParse(payload)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('payment_status'))).toBe(true)
    }
  })

  it('rejects missing price_amount', () => {
    const payload = { payment_id: 'pay_123', payment_status: 'finished', price_currency: 'USD' }
    const result = ipnPayloadSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it('rejects missing price_currency', () => {
    const payload = { payment_id: 'pay_123', payment_status: 'finished', price_amount: 199 }
    const result = ipnPayloadSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it('rejects invalid payment_status value', () => {
    const result = ipnPayloadSchema.safeParse(buildIpnPayload({ payment_status: 'completed' } as never))
    expect(result.success).toBe(false)
  })

  it('rejects negative price_amount', () => {
    const result = ipnPayloadSchema.safeParse(buildIpnPayload({ price_amount: -1 }))
    expect(result.success).toBe(false)
  })

  it('rejects zero price_amount', () => {
    const result = ipnPayloadSchema.safeParse(buildIpnPayload({ price_amount: 0 }))
    expect(result.success).toBe(false)
  })

  it('rejects empty payment_id', () => {
    const result = ipnPayloadSchema.safeParse(buildIpnPayload({ payment_id: '' }))
    expect(result.success).toBe(false)
  })

  it('rejects empty price_currency', () => {
    const result = ipnPayloadSchema.safeParse(buildIpnPayload({ price_currency: '' }))
    expect(result.success).toBe(false)
  })

  it('rejects non-string payment_id', () => {
    const result = ipnPayloadSchema.safeParse(buildIpnPayload({ payment_id: 12345 as unknown as string }))
    expect(result.success).toBe(false)
  })

  it('rejects non-number price_amount', () => {
    const result = ipnPayloadSchema.safeParse(buildIpnPayload({ price_amount: '199' as unknown as number }))
    expect(result.success).toBe(false)
  })

  it('rejects invalid email in customer_email', () => {
    const result = ipnPayloadSchema.safeParse(buildIpnPayload({ customer_email: 'not-an-email' }))
    expect(result.success).toBe(false)
  })

  it('accepts valid email in customer_email', () => {
    const result = ipnPayloadSchema.safeParse(buildIpnPayload({ customer_email: 'test@example.com' }))
    expect(result.success).toBe(true)
  })

  it('rejects null payload', () => {
    const result = ipnPayloadSchema.safeParse(null)
    expect(result.success).toBe(false)
  })

  it('rejects empty object', () => {
    const result = ipnPayloadSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('ipnPayloadSchema — inferred type matches', () => {
  it('inferred type includes all required fields', () => {
    const valid = buildIpnPayload()
    const result = ipnPayloadSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      const typed: typeof result.data = valid as typeof result.data
      expect(typed.payment_id).toBe(valid.payment_id)
      expect(typed.payment_status).toBe(valid.payment_status)
      expect(typed.price_amount).toBe(valid.price_amount)
      expect(typed.price_currency).toBe(valid.price_currency)
    }
  })
})
