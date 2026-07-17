import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { D1Database } from '@cloudflare/workers-types'
import { recordSopSaleCommission } from '@/land/sop-marketplace/commission-split'

const PAYOUT_DELAY_MS = 14 * 24 * 60 * 60 * 1000

interface InsertCapture { sql: string; binds: unknown[] }
let insertCalls: InsertCapture[] = []

beforeEach(() => { insertCalls = [] })

function makeD1Mock() {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockImplementation((...binds: unknown[]) => {
        insertCalls.push({ sql, binds })
        return {
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
        }
      }),
    })),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
  }
}

describe('recordSopSaleCommission', () => {
  it('inserts with offer_id=sop_marketplace', async () => {
    const db = makeD1Mock()
    await recordSopSaleCommission(db as unknown as D1Database, {
      creatorId: 'c1', listingId: 'l1', templateId: 't1', licenseId: 'lic1',
      priceCents: 19900, paymentId: 'p1',
    })
    const insert = insertCalls.find((c) => c.sql.includes('INSERT'))
    expect(insert).toBeDefined()
    expect(insert!.sql).toContain("'sop_marketplace'")
  })

  it('stores 70/30 split for 19900 cents', async () => {
    const db = makeD1Mock()
    await recordSopSaleCommission(db as unknown as D1Database, {
      creatorId: 'c2', listingId: 'l2', templateId: 't2', licenseId: 'lic2',
      priceCents: 19900, paymentId: 'p2',
    })
    const insert = insertCalls.find((c) => c.sql.includes('INSERT'))
    expect(insert!.binds[5]).toBe(0.7)
    expect(insert!.binds[6]).toBe(13930)
  })

  it('sets payable_at 14 days in the future', async () => {
    const before = Math.floor(Date.now() / 1000)
    const db = makeD1Mock()
    await recordSopSaleCommission(db as unknown as D1Database, {
      creatorId: 'c3', listingId: 'l3', templateId: 't3', licenseId: 'lic3',
      priceCents: 5000, paymentId: 'p3',
    })
    const insert = insertCalls.find((c) => c.sql.includes('INSERT'))
    const payableAt = insert!.binds[7] as number
    const createdAt = insert!.binds[8] as number
    expect(payableAt - createdAt).toBe(PAYOUT_DELAY_MS)
  })

  it('records status as pending', async () => {
    const db = makeD1Mock()
    await recordSopSaleCommission(db as unknown as D1Database, {
      creatorId: 'c4', listingId: 'l4', templateId: 't4', licenseId: 'lic4',
      priceCents: 3000, paymentId: 'p4',
    })
    const insert = insertCalls.find((c) => c.sql.includes('INSERT'))
    expect(insert!.sql).toContain("'pending'")
  })
})
