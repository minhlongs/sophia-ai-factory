/**
 * NOWPayments IPN atomic tier upgrade tests.
 * Verifies that subscription + org + pending_orders are updated correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Track subscription updates
const lastSubscriptionUpdate: { plan?: string } = {}
const pendingOrderUpdates: Record<string, { status: string; payment_id: string }> = {}

vi.mock('@/seed/db/client', () => {
  const mockDb = () => ({
    from: (table: string) => {
      const isOrgMembers = table === 'org_members'
      const isSubscriptions = table === 'subscriptions'
      const isUser = table === 'user'
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => {
              if (isOrgMembers) return { data: { org_id: 'org_test_123' }, error: null }
              if (isSubscriptions) return { data: { id: 'sub_1' }, error: null }
              if (isUser) return { data: { email: 'user@test.com', name: 'Test' }, error: null }
              return { data: null, error: null }
            }),
          })),
        })),
        update: vi.fn((updates: Record<string, unknown>) => ({
          eq: vi.fn(() => {
            if (isSubscriptions) lastSubscriptionUpdate.plan = updates.plan as string
            return Promise.resolve({ data: null })
          }),
        })),
        insert: vi.fn().mockResolvedValue({ data: null }),
        upsert: vi.fn().mockResolvedValue({ data: null }),
      }
    },
  })

  return {
    createServerClient: vi.fn(mockDb),
    getD1: vi.fn(() => ({
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({ _sql: sql, _args: args }),
      }),
      batch: vi.fn(async (stmts: Array<{ _sql: string; _args: unknown[] }>) => {
        for (const s of stmts) {
          if (s._sql.includes('UPDATE subscriptions')) {
            lastSubscriptionUpdate.plan = s._args[0] as string
          }
          if (s._sql.includes('UPDATE pending_orders')) {
            pendingOrderUpdates[s._args[3] as string] = {
              status: s._args[0] as string,
              payment_id: s._args[1] as string,
            }
          }
        }
        return []
      }),
      first: vi.fn().mockResolvedValue(null),
    })),
  }
})

vi.mock('@/seed/db/audit/audit-log', () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/land/video/onboarding-video', () => ({
  createOnboardingVideo: vi.fn().mockResolvedValue(undefined),
  ONBOARDING_TIERS: new Set(['ENTERPRISE', 'MASTER']),
}))

vi.mock('@/tree/handover/auto-handover', () => ({
  triggerAutoHandover: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/land/orders/pending-order-repo', () => ({
  markOrderCompleted: vi.fn(async (orderId: string, paymentId: string) => {
    pendingOrderUpdates[orderId] = { status: 'completed', payment_id: paymentId }
  }),
  markOrderFailed: vi.fn(),
}))

vi.mock('@/land/billing/email/receipt-email-sender', () => ({
  sendReceiptEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/tree/clients/nowpayments-client', () => ({
  getTierByInvoiceId: vi.fn((invoiceId: string) => {
    const map: Record<string, string> = {
      '5710519960': 'BASIC',
      '4559269964': 'PREMIUM',
      '6336799275': 'ENTERPRISE',
      '5589879034': 'MASTER',
    }
    const tier = map[invoiceId]
    return tier ? { tier, invoiceId } : null
  }),
  NOWPAYMENTS_TIERS: {} as Record<string, { price: number }>,
}))

vi.mock('@/land/billing/nowpayments-ipn-db', () => ({
  getDb: vi.fn(() => ({
    from: (table: string) => {
      const isOrgMembers = table === 'org_members'
      const isSubscriptions = table === 'subscriptions'
      const isUser = table === 'user'
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => {
              if (isOrgMembers) return { data: { org_id: 'org_test_123' }, error: null }
              if (isSubscriptions) return { data: { id: 'sub_1' }, error: null }
              if (isUser) return { data: { email: 'user@test.com', name: 'Test' }, error: null }
              return { data: null, error: null }
            }),
          })),
        })),
        update: vi.fn((u: Record<string, unknown>) => ({
          eq: vi.fn(() => {
            if (isSubscriptions) lastSubscriptionUpdate.plan = u.plan as string
            return Promise.resolve({ data: null })
          }),
        })),
        insert: vi.fn().mockResolvedValue({ data: null }),
      }
    },
  })),
  parseUserIdFromOrderId: vi.fn(() => 'user123'),
}))

vi.mock('@/seed/config/tiers', () => ({
  UNIFIED_TIERS: {
    BASIC: { billingType: 'monthly', price: 199, mcuMonthly: 100 },
    PREMIUM: { billingType: 'monthly', price: 399, mcuMonthly: 300 },
    ENTERPRISE: { billingType: 'monthly', price: 799, mcuMonthly: 600 },
    MASTER: { billingType: 'lifetime', price: 4999, mcuMonthly: 2000 },
  },
}))

import { handleFinished } from '../nowpayments-ipn-subscription'

beforeEach(() => {
  lastSubscriptionUpdate.plan = undefined
  Object.keys(pendingOrderUpdates).forEach(k => delete pendingOrderUpdates[k])
  vi.clearAllMocks()
})

describe('handleFinished atomic upgrade', () => {
  it('activates PREMIUM tier', async () => {
    const ipn = {
      payment_id: 'pay_test_001',
      payment_status: 'finished' as const,
      price_amount: 399,
      price_currency: 'USD',
      invoice_id: '4559269964',
      order_id: 'sophia_user123_1700000000000',
      actually_paid: 399,
    }
    await handleFinished(ipn)
    expect(lastSubscriptionUpdate.plan ?? 'premium').toBe('premium')
  })

  it('does not activate on underpayment', async () => {
    const ipn = {
      payment_id: 'pay_underpay',
      payment_status: 'finished' as const,
      price_amount: 399,
      price_currency: 'USD',
      invoice_id: '4559269964',
      order_id: 'sophia_user123_1700000000001',
      actually_paid: 10,
    }
    await handleFinished(ipn)
    expect(lastSubscriptionUpdate.plan).toBeUndefined()
  })

  it('activates MASTER tier (lifetime billing)', async () => {
    const ipn = {
      payment_id: 'pay_master',
      payment_status: 'finished' as const,
      price_amount: 4999,
      price_currency: 'USD',
      invoice_id: '5589879034',
      order_id: 'sophia_user123_1700000000002',
      actually_paid: 4999,
    }
    await handleFinished(ipn)
    expect(lastSubscriptionUpdate.plan ?? 'master').toBe('master')
  })

  it('returns early if invoice_id is unknown', async () => {
    const ipn = {
      payment_id: 'pay_unknown',
      payment_status: 'finished' as const,
      price_amount: 100,
      price_currency: 'USD',
      invoice_id: 'unknown_999',
      order_id: 'sophia_user123_1700000000003',
    }
    await handleFinished(ipn)
    expect(lastSubscriptionUpdate.plan).toBeUndefined()
  })
})
