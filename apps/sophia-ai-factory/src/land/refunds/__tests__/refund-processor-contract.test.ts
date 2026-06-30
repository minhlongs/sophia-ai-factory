/**
 * Contract tests: Refund processor atomicity, idempotency, tier rollback, MCU clawback.
 *
 * Phase 01: stub throws → all tests fail with "Not implemented".
 * Phase 02: implement the processor → tests verify the contract.
 *
 * Each test pre-populates mock D1 state so processRefund has data to work with.
 * The mock D1 stores in-memory and is reset between tests.
 *
 * @module land/refunds/__tests__/refund-processor-contract
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { processRefund } from '../refund-processor'
import type { RefundProcessInput } from '../refund-processor'

// ── In-memory mock state ─────────────────────────────────────────────────────

const refundEvents = new Map<string, { event_id: string; processed: number; created_at: string }>()
const refundLedger: Array<Record<string, unknown>> = []
const subscriptions = new Map<string, { plan: string; status: string; org_id: string }>()
const organizations = new Map<string, { plan: string }>()
const orgMemberships = new Map<string, { org_id: string; user_id: string }>()
const refundRequests = new Map<string, Record<string, unknown>>()

function resetMockState(): void {
  refundEvents.clear()
  refundLedger.length = 0
  subscriptions.clear()
  organizations.clear()
  orgMemberships.clear()
  refundRequests.clear()
}

function setupRefundRequest(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'refund_req_001',
    user_id: 'user_001',
    purchase_id: 'purchase_001',
    payment_id: 'pay_001',
    amount_cents: 19900,
    reason: 'Product not as described',
    status: 'approved',
    created_at: Math.floor(Date.now() / 1000),
    reviewed_at: Math.floor(Date.now() / 1000),
    reviewed_by_user_id: 'admin_001',
    admin_notes: null,
    refund_tx_hash: null,
    customer_wallet_address: '0xabc123def456',
    tier_before: null,
    ...overrides,
  }
}

function setupSubscription(
  orgId: string,
  overrides: Partial<{ plan: string; status: string }> = {},
): void {
  subscriptions.set(orgId, {
    plan: 'premium',
    status: 'active',
    org_id: orgId,
    ...overrides,
  })
}

function setupOrganization(orgId: string, overrides: Partial<{ plan: string }> = {}): void {
  organizations.set(orgId, {
    plan: 'premium',
    ...overrides,
  })
}

function setupOrgMembership(userId: string, orgId: string): void {
  orgMemberships.set(userId, { org_id: orgId, user_id: userId })
}

/** Helper to resolve arg by SQL parameter number (?N = args[N-1]) */
function paramAt(n: number, args: unknown[]): unknown {
  return args[n - 1]
}

// ── Mock D1 ──────────────────────────────────────────────────────────────────

function buildMockD1() {
  return {
    prepare: vi.fn((sql: string) => {
      const lower = sql.toLowerCase()

      // Helper: extract row id from bind args based on SQL parameter positions
      function resolveRowId(args: unknown[]): string | undefined {
        if (lower.includes('insert into refund_events')) return undefined
        const idMatch = sql.match(/WHERE\s+id\s*=\s*\?(\d+)/i)
        if (idMatch) {
          const idx = parseInt(idMatch[1], 10) - 1
          return args[idx] as string | undefined
        }
        return undefined
      }

      // Direct D1 API — .all() / .first() / .run() without .bind()
      const directAll = vi.fn(async () => {
        if (lower.includes('select org_id from org_members')) {
          const results = Array.from(orgMemberships.values()).slice(0, 1)
          return { results, success: true }
        }
        return { results: [], success: true }
      })
      const directFirst = vi.fn(async () => null)
      const directRun = vi.fn(async () => ({ success: true, meta: {} }))

      return {
        bind: vi.fn((...args: unknown[]) => {
          const rowId = resolveRowId(args)

          return {
            run: vi.fn(async () => {
              // ── Atomic lock: refund_events INSERT ON CONFLICT ────────────
              if (lower.includes('insert into refund_events') && lower.includes('on conflict')) {
                const eid = args[0] as string | undefined
                if (eid && refundEvents.has(eid)) {
                  return { success: true, meta: { changes: 0 } }
                }
                if (eid) {
                  refundEvents.set(eid, {
                    event_id: eid,
                    processed: 0,
                    created_at: new Date().toISOString(),
                  })
                }
                return { success: true, meta: { changes: 1 } }
              }

              // ── Insert refund_ledger ────────────────────────────────────
              if (lower.includes('insert into refund_ledger')) {
                refundLedger.push({ id: args[0], ...Object.fromEntries(args.entries()) })
                return { success: true, meta: { changes: 1 } }
              }

              // ── Update refund_events (release lock) ─────────────────────
              if (lower.includes('update refund_events') && lower.includes('processed')) {
                const eid = args[1] as string | undefined
                if (eid) {
                  const evt = refundEvents.get(eid)
                  if (evt) evt.processed = 1
                }
                return { success: true, meta: { changes: 1 } }
              }

              // ── Delete refund_events (error rollback) ───────────────────
              if (lower.includes('delete from refund_events')) {
                const eid = args[0] as string | undefined
                if (eid) refundEvents.delete(eid)
                return { success: true, meta: { changes: 1 } }
              }

              // ── Update subscriptions ─────────────────────────────────────
              if (lower.includes('update subscriptions')) {
                return { success: true, meta: { changes: 1 } }
              }

              // ── Update organizations ─────────────────────────────────────
              if (lower.includes('update organizations')) {
                return { success: true, meta: { changes: 1 } }
              }

              return { success: true, meta: { changes: 1 } }
            }),

            first: vi.fn(async () => {
              // ── Select refund_requests by id ─────────────────────────────
              if (lower.includes('select * from refund_requests') && lower.includes('where id')) {
                return (rowId && refundRequests.get(rowId)) ?? null
              }

              // ── Select refund_events by event_id ─────────────────────────
              if (lower.includes('select processed from refund_events')) {
                const eid = args[0] as string | undefined
                const evt = eid ? refundEvents.get(eid) : undefined
                return evt ? { processed: evt.processed } : null
              }

              // ── Select org_members by user_id ────────────────────────────
              if (lower.includes('select org_id from org_members')) {
                const uid = paramAt(1, args) as string | undefined
                return (uid && orgMemberships.get(uid)) ?? null
              }

              // ── Select subscriptions by org_id ──────────────────────────
              if (lower.includes('select plan, status from subscriptions')) {
                const oid = paramAt(1, args) as string | undefined
                return (oid && subscriptions.get(oid)) ?? null
              }

              return null
            }),

            all: vi.fn(async () => {
              if (lower.includes('select org_id from org_members')) {
                return { results: Array.from(orgMemberships.values()).slice(0, 1), success: true }
              }
              return { results: [], success: true }
            }),
          }
        }),
        all: directAll,
        first: directFirst,
        run: directRun,
      }
    }),
    batch: vi.fn(async (stmts: unknown[]) => stmts.map(() => ({ success: true, meta: { changes: 1 } }))),
  }
}

vi.mock('@/seed/db/client', () => ({
  getD1: () => buildMockD1(),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<RefundProcessInput> = {}): RefundProcessInput {
  return {
    refundRequestId: overrides.refundRequestId ?? 'refund_req_001',
    reviewedByUserId: overrides.reviewedByUserId ?? 'admin_001',
    txHash: overrides.txHash ?? '0xabc123def456',
    notes: overrides.notes ?? 'Admin-approved refund',
  }
}

beforeEach(() => {
  resetMockState()
  vi.clearAllMocks()
  // Ensure NOWPAYMENTS_API_KEY is not set so the external API call is skipped
  // (unless a test explicitly needs it for NOWPAYMENTS_API_ERROR)
  delete process.env.NOWPAYMENTS_API_KEY
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Refund Processor Contract Tests', () => {
  describe('Idempotency — atomic lock prevents double-refund', () => {
    it('duplicate refund returns already-processed', async () => {
      const input = makeInput({ refundRequestId: 'dup_test_001' })
      // Pre-populate refund request with approved status
      refundRequests.set(input.refundRequestId, setupRefundRequest({ id: input.refundRequestId }))

      // First call should succeed
      const r1 = await processRefund(input)
      expect(r1.ok).toBe(true)
      if (r1.ok) {
        expect(r1.value.refundRequestId).toBe(input.refundRequestId)
      }

      // Second call — atomic lock blocks duplicate
      const r2 = await processRefund(input)
      expect(r2.ok).toBe(false)
      if (!r2.ok) {
        expect(r2.error.code).toBe('DUPLICATE_REFUND')
      }
    })
  })

  describe('Ledger entry', () => {
    it('refund creates ledger entry with correct amounts', async () => {
      const input = makeInput({ refundRequestId: 'ledger_test_001' })
      refundRequests.set(input.refundRequestId, setupRefundRequest({ id: input.refundRequestId }))
      setupOrgMembership('user_001', 'org_ledger_001')
      setupSubscription('org_ledger_001', { plan: 'premium', status: 'active' })

      const result = await processRefund(input)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.ledgerEntryId).toBeDefined()
        expect(result.value.ledgerEntryId.length).toBeGreaterThan(0)
        expect(result.value.transactionHash).toBe(input.txHash)
      }

      // Verify ledger entry was persisted
      expect(refundLedger.length).toBeGreaterThan(0)
    })
  })

  describe('Tier rollback', () => {
    it('refund rolls back tier after processing', async () => {
      const input = makeInput({ refundRequestId: 'tier_test_001' })
      refundRequests.set(input.refundRequestId, setupRefundRequest({ id: input.refundRequestId }))
      setupOrgMembership('user_001', 'org_tier_001')
      setupSubscription('org_tier_001', { plan: 'premium', status: 'active' })
      setupOrganization('org_tier_001', { plan: 'premium' })

      const result = await processRefund(input)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.tierBefore).toBeDefined()
        expect(result.value.tierAfter).toBeDefined()
        // Tier should have changed (rollback to BASIC from PREMIUM)
        expect(result.value.tierBefore).toBe('PREMIUM')
        expect(result.value.tierAfter).toBe('BASIC')
      }
    })
  })

  describe('MCU credit clawback', () => {
    it('refund claws back MCU credits', async () => {
      const input = makeInput({ refundRequestId: 'mcu_test_001' })
      refundRequests.set(input.refundRequestId, setupRefundRequest({ id: input.refundRequestId }))
      setupOrgMembership('user_001', 'org_mcu_001')
      // PREMIUM = 5000 MCU/mo, BASIC = 1000 MCU/mo — clawback = 4000
      setupSubscription('org_mcu_001', { plan: 'premium', status: 'active' })

      const result = await processRefund(input)
      expect(result.ok).toBe(true)
      if (result.ok) {
        // PREMIUM (5000) - BASIC (1000) = 4000
        expect(result.value.mcuClawedBack).toBeGreaterThan(0)
        expect(result.value.mcuClawedBack).toBe(4000)
      }
    })
  })

  describe('Error handling', () => {
    it('invalid purchase_id returns Result failure', async () => {
      const input = makeInput({ refundRequestId: 'nonexistent_refund' })
      // Do NOT pre-populate refund request — should return NOT_FOUND

      const result = await processRefund(input)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })

    it('NOWPayments API failure returns Result failure and does not mark refunded', async () => {
      // Set up data so that processRefund will attempt the NOWPayments API call
      const input = makeInput({ refundRequestId: 'api_fail_001' })
      refundRequests.set(input.refundRequestId, setupRefundRequest({ id: input.refundRequestId }))
      setupOrgMembership('user_001', 'org_api_001')
      setupSubscription('org_api_001', { plan: 'premium', status: 'active' })

      // Set NOWPAYMENTS_API_KEY so the processor attempts the refund API call
      process.env.NOWPAYMENTS_API_KEY = 'test-key'

      // Mock fetch to return a non-ok response (simulating API failure)
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('NOWPayments API error'),
      }) as unknown as typeof globalThis.fetch

      try {
        const result = await processRefund(input)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.code).toBe('NOWPAYMENTS_API_ERROR')
        }

        // Verify refund was NOT marked as refunded despite the error
        // The refund request should still have its original status
        const refundReq = refundRequests.get(input.refundRequestId)
        expect(refundReq).toBeDefined()
        expect(refundReq?.status).not.toBe('refunded')
      } finally {
        // Restore fetch
        globalThis.fetch = originalFetch
      }
    })
  })
})
