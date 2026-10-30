/**
 * Tests for the AccessTrade webhook delegate.
 *
 * Integration-style: real SQLite-backed fake D1 seeded from the REAL
 * migrations (0082 + 0035), real tenant resolution, real HMAC fixtures. Only
 * the D1 binding lookup and the credential vault are mocked.
 *
 * Pins the unchanged provider contract (x-accesstrade-signature, payload
 * fields) plus the tenant-scoped fixes: per-workspace secret, fail-closed
 * unknown tenants, idempotent receipts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NextRequest } from 'next/server'
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite'
import { generateAffiliateHmac } from '@/tree/affiliate/hmac-verifier'

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}))

vi.mock('@/land/affiliates/credentials', () => ({
  getCredentials: vi.fn(),
}))

import { getD1 } from '@/seed/db/client'
import { getCredentials } from '@/land/affiliates/credentials'
import { POST } from './route'

type FakeD1 = ReturnType<typeof createFakeD1>
type Creds = Awaited<ReturnType<typeof getCredentials>>

function createLegacyD1(): FakeD1 {
  const tracking = readFileSync(resolve(process.cwd(), 'migrations/0082-edge-tracking.sql'), 'utf8')
  const engine = readFileSync(resolve(process.cwd(), 'migrations/0035-affiliate-engine.sql'), 'utf8')
  return createFakeD1([tracking, engine])
}

function mockCreds(secrets: Record<string, Record<string, string>>) {
  vi.mocked(getCredentials).mockImplementation(async (_db, tenantId, network) => {
    const secret = secrets[tenantId]?.[network]
    if (!secret) return null
    return { network, api_secret: secret } as unknown as Creds
  })
}

const PAYLOAD = {
  conversion_id: 'AT-CONV-001',
  sub_id: 'link_A1',
  order_value: 100,
  commission: 8,
  status: 'approved',
}

function makeRequest(body: string, sig: string): NextRequest {
  return new NextRequest('http://localhost/api/webhooks/accesstrade', {
    method: 'POST',
    body,
    headers: { 'x-accesstrade-signature': sig, 'content-type': 'application/json' },
  })
}

describe('POST /api/webhooks/accesstrade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 and records a tenant-owned receipt for a valid signature', async () => {
    const db = createLegacyD1()
    await db
      .prepare('INSERT INTO tracking_links (id, tenant_id, destination_url) VALUES (?, ?, ?)')
      .bind('link_A1', 'tenant-a', 'https://example.com/offer')
      .run()
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database)
    mockCreds({ 'tenant-a': { accesstrade: 'at_secret_A' } })

    const raw = JSON.stringify(PAYLOAD)
    const sig = await generateAffiliateHmac(raw, 'at_secret_A')
    const res = await POST(makeRequest(raw, sig))

    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      ok: true,
      network: 'accesstrade',
      transactionId: 'AT-CONV-001',
      tenantId: 'tenant-a',
      commissionUsd: 8,
      status: 'approved',
    })
    const stored = await db
      .prepare('SELECT tenant_id, network_transaction_id FROM conversion_events')
      .first<{ tenant_id: string; network_transaction_id: string }>()
    expect(stored).toMatchObject({
      tenant_id: 'tenant-a',
      network_transaction_id: 'accesstrade:AT-CONV-001',
    })
  })

  it('returns 401 for invalid signature and records nothing', async () => {
    const db = createLegacyD1()
    await db
      .prepare('INSERT INTO tracking_links (id, tenant_id, destination_url) VALUES (?, ?, ?)')
      .bind('link_A1', 'tenant-a', 'https://example.com/offer')
      .run()
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database)
    mockCreds({ 'tenant-a': { accesstrade: 'at_secret_A' } })

    const res = await POST(makeRequest(JSON.stringify(PAYLOAD), 'wrong'))
    expect(res.status).toBe(401)
    const count = await db
      .prepare('SELECT COUNT(*) AS n FROM conversion_events')
      .first<{ n: number }>()
    expect(count?.n).toBe(0)
  })

  it('is idempotent: returns 200 skipped:duplicate on replay', async () => {
    const db = createLegacyD1()
    await db
      .prepare('INSERT INTO tracking_links (id, tenant_id, destination_url) VALUES (?, ?, ?)')
      .bind('link_A1', 'tenant-a', 'https://example.com/offer')
      .run()
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database)
    mockCreds({ 'tenant-a': { accesstrade: 'at_secret_A' } })

    const raw = JSON.stringify(PAYLOAD)
    const sig = await generateAffiliateHmac(raw, 'at_secret_A')
    await POST(makeRequest(raw, sig))
    const replay = await POST(makeRequest(raw, sig))

    expect(replay.status).toBe(200)
    const body = (await replay.json()) as { ok: boolean; skipped?: string }
    expect(body).toMatchObject({ ok: true, skipped: 'duplicate' })
    const count = await db
      .prepare('SELECT COUNT(*) AS n FROM conversion_events')
      .first<{ n: number }>()
    expect(count?.n).toBe(1)
  })

  it('fails 422 tenant_unresolvable for an unknown sub_id', async () => {
    const db = createLegacyD1()
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database)
    mockCreds({})

    const raw = JSON.stringify({ ...PAYLOAD, sub_id: 'ghost' })
    const res = await POST(makeRequest(raw, 'x'))

    expect(res.status).toBe(422)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body).toMatchObject({ ok: false, error: 'tenant_unresolvable' })
  })

  it('fails 503 secret_not_configured when the workspace has no credential', async () => {
    const db = createLegacyD1()
    await db
      .prepare('INSERT INTO tracking_links (id, tenant_id, destination_url) VALUES (?, ?, ?)')
      .bind('link_A1', 'tenant-a', 'https://example.com/offer')
      .run()
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database)
    mockCreds({})

    const raw = JSON.stringify(PAYLOAD)
    const res = await POST(makeRequest(raw, 'x'))

    expect(res.status).toBe(503)
    const body = (await res.json()) as { ok: boolean; error: string; tenantId: string }
    expect(body).toMatchObject({
      ok: false,
      error: 'secret_not_configured',
      tenantId: 'tenant-a',
    })
  })
})
