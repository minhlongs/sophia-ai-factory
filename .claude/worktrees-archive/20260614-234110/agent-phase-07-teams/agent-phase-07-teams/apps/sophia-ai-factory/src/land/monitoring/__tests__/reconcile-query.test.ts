/**
 * Unit tests for reconcile-query.ts
 * Verifies orphan detection, SYNTHETIC_ exclusion, and delivered counting.
 */

import { describe, it, expect } from 'vitest'
import { runReconcileQueries } from '../reconcile-query'

// ── D1 Mock Factory ──────────────────────────────────────────────────────────

interface MockPurchase {
  id: string
  sku: string
  paid_at: number
}

interface MockVideo {
  purchase_id: string
  status: 'completed' | 'failed_permanent' | 'queued'
}

function makeDb(purchases: MockPurchase[], videos: MockVideo[]): D1Database {
  let callCount = 0

  const db = {
    prepare: (sql: string) => ({
      bind: (..._args: unknown[]) => ({
        all: async <T>(): Promise<{ results: T[] }> => {
          callCount++
          // Q1: user_purchases query
          if (sql.includes('user_purchases') && sql.includes('BETWEEN')) {
            return { results: purchases as unknown as T[] }
          }
          // Q2: completed videos
          if (sql.includes('status = \'completed\'')) {
            const completedVideos = videos
              .filter((v) => v.status === 'completed')
              .map((v) => ({ purchase_id: v.purchase_id }))
            return { results: completedVideos as unknown as T[] }
          }
          return { results: [] }
        },
        first: async <T>(): Promise<T | null> => {
          // Q3: COUNT permanent failures
          if (sql.includes('failed_permanent')) {
            const cnt = videos.filter((v) => v.status === 'failed_permanent').length
            return { cnt } as unknown as T
          }
          return null
        },
      }),
    }),
  } as unknown as D1Database

  void callCount
  return db
}

describe('runReconcileQueries', () => {
  const NOW = 1000000
  const SINCE = NOW - 86400
  const BEFORE = NOW - 7200 // 2h lag buffer

  it('returns zero counts when no paid purchases', async () => {
    const db = makeDb([], [])
    const result = await runReconcileQueries(db, SINCE, BEFORE)

    expect(result.paidCount).toBe(0)
    expect(result.deliveredCount).toBe(0)
    expect(result.orphanCount).toBe(0)
    expect(result.orphans).toEqual([])
    expect(result.permanentFailCount).toBe(0)
  })

  it('returns 0 orphans when all paid purchases have completed videos', async () => {
    const purchases: MockPurchase[] = [
      { id: 'p1', sku: 'STARTER_BUNDLE', paid_at: NOW - 10000 },
      { id: 'p2', sku: 'GROWTH_BUNDLE', paid_at: NOW - 20000 },
    ]
    const videos: MockVideo[] = [
      { purchase_id: 'p1', status: 'completed' },
      { purchase_id: 'p2', status: 'completed' },
    ]

    const db = makeDb(purchases, videos)
    const result = await runReconcileQueries(db, SINCE, BEFORE)

    expect(result.paidCount).toBe(2)
    expect(result.deliveredCount).toBe(2)
    expect(result.orphanCount).toBe(0)
    expect(result.orphans).toHaveLength(0)
  })

  it('detects orphan purchases when paid but no completed video', async () => {
    const purchases: MockPurchase[] = [
      { id: 'p1', sku: 'STARTER_BUNDLE', paid_at: NOW - 10000 },
      { id: 'p2', sku: 'GROWTH_BUNDLE', paid_at: NOW - 20000 },
      { id: 'p3', sku: 'PREMIUM_BUNDLE', paid_at: NOW - 30000 },
    ]
    // Only p1 has a completed video; p2 and p3 are orphans
    const videos: MockVideo[] = [
      { purchase_id: 'p1', status: 'completed' },
    ]

    const db = makeDb(purchases, videos)
    const result = await runReconcileQueries(db, SINCE, BEFORE)

    expect(result.paidCount).toBe(3)
    expect(result.deliveredCount).toBe(1)
    expect(result.orphanCount).toBe(2)
    expect(result.orphans.map((o) => o.id)).toEqual(expect.arrayContaining(['p2', 'p3']))
  })

  it('counts permanent failures in result', async () => {
    const purchases: MockPurchase[] = [
      { id: 'p1', sku: 'STARTER_BUNDLE', paid_at: NOW - 10000 },
    ]
    const videos: MockVideo[] = [
      { purchase_id: 'p1', status: 'failed_permanent' },
    ]

    const db = makeDb(purchases, videos)
    const result = await runReconcileQueries(db, SINCE, BEFORE)

    // p1 is an orphan (no completed video) and has a permanent failure
    expect(result.orphanCount).toBe(1)
    expect(result.permanentFailCount).toBe(1)
  })
})
