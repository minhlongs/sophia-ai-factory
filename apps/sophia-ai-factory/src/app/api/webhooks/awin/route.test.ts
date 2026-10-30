/**
 * Tests for the Awin webhook delegate.
 *
 * Same integration harness as the AccessTrade delegate: real SQLite-backed
 * fake D1 from the REAL migrations, real tenant resolution, real HMAC.
 * Pins the unchanged Awin contract (x-awin-signature, id/click_ref/
 * sale_amount/commission_amount fields) plus tenant-scoped fixes.
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
  id: 'AW-999',
  click_ref: 'link_A1',
  sale_amount: 200,
  commission_amount: 10,
  status: 'approved',
}

function makeRequest(body: string, sig: string): NextRequest {
  return new NextRequest('http://localhost/api/webhooks/awin', {
    method: 'POST',
    body,
    headers: { 'x-awin-signature': sig, 'content-type': 'application/json' },
  })
}

describe('POST /api/webhooks/awin', () => {
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
    mockCreds({ 'tenant-a': { awin: 'awin_secret_A' } })

    const raw = JSON.stringify(PAYLOAD)
    const sig = await generateAffiliateHmac(raw, 'awin_secret_A')
    const res = await POST(makeRequest(raw, sig))

    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      ok: true,
      network: 'awin',
      transactionId: 'AW-999',
      tenantId: 'tenant-a',
      commissionUsd: 10,
      status: 'approved',
    })
    const stored = await db
      .prepare('SELECT tenant_id, network_transaction_id FROM conversion_events')
      .first<{ tenant_id: string; network_transaction_id: string }>()
    expect(stored).toMatchObject({
      tenant_id: 'tenant-a',
      network_transaction_id: 'awin:AW-999',
    })
  })

  it('returns 401 for invalid signature and records nothing', async () => {
    const db = createLegacyD1()
    await db
      .prepare('INSERT INTO tracking_links (id, tenant_id, destination_url) VALUES (?, ?, ?)')
      .bind('link_A1', 'tenant-a', 'https://example.com/offer')
      .run()
    vi.mocked(getD1).mockResolvedValue(db as unknown as D1Database)
    mockCreds({ 'tenant-a': { awin: 'awin_secret_A' } })

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
    mockCreds({ 'tenant-a': { awin: 'awin_secret_A' } })

    const raw = JSON.stringify(PAYLOAD)
    const sig = await generateAffiliateHmac(raw, 'awin_secret_A')
    await POST(makeRequest(raw, sig))
    const replay = await POST(makeRequest(raw, sig))

    expect(replay.status).toBe(200)
    const body = (await replay.json()) as { ok: boolean; skipped?: string }
    expect(body).toMatchObject({ ok: true, skipped: 'duplicate' })
  })
})
