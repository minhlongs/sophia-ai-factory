/**
 * Tests for ClickBank INS webhook route
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all dependencies before imports
vi.mock('@/lib/affiliates/clickbank-signature-verifier', () => ({
  verifyClickBankSignature: vi.fn(),
}))

vi.mock('@/lib/affiliates/clickbank-postback-parser', () => ({
  parsePostback: vi.fn(),
}))

vi.mock('@/lib/affiliates/conversion-attributor', () => ({
  attributeClick: vi.fn(),
}))

vi.mock('@/lib/affiliates/commission-calculator', () => ({
  calcCommission: vi.fn(),
}))

vi.mock('@/forest/inngest/functions/generate-campaign-db', () => ({
  notifyConversionEarned: vi.fn(),
}))

vi.mock('@/tree/telegram/sql-rate-limiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { POST } from './route'
import { verifyClickBankSignature } from '@/lib/affiliates/clickbank-signature-verifier'
import { parsePostback } from '@/lib/affiliates/clickbank-postback-parser'
import { attributeClick } from '@/lib/affiliates/conversion-attributor'
import { calcCommission } from '@/lib/affiliates/commission-calculator'
import { notifyConversionEarned } from '@/forest/inngest/functions/generate-campaign-db'
import { checkRateLimit } from '@/tree/telegram/sql-rate-limiter'
import { NextRequest } from 'next/server'

// Mock D1 binding
const mockRun = vi.fn().mockResolvedValue({ success: true })
const mockFirst = vi.fn()
const mockBind = vi.fn(() => ({ first: mockFirst, run: mockRun }))
const mockPrepare = vi.fn(() => ({ bind: mockBind }))
const mockDb = { prepare: mockPrepare }

function makeRequest(body = '', sig = 'valid-sig'): NextRequest {
  return new NextRequest('https://sophia.agencyos.network/api/webhooks/clickbank', {
    method: 'POST',
    body,
    headers: { 'x-clickbank-signature': sig, 'content-type': 'application/x-www-form-urlencoded' },
  })
}

const basePostback = {
  receipt: 'REC123',
  transactionType: 'SALE' as const,
  amount: 100,
  currency: 'USD',
  cvendthru: 'a1b2c3d4e5f6a7b8c9d0e1f2',
  vendor: 'myvendor',
  affiliate: undefined,
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CLICKBANK_INS_SECRET = 'test-secret'
  ;(globalThis as unknown as { __env: Record<string, unknown> }).__env = { DB: mockDb }

  vi.mocked(verifyClickBankSignature).mockResolvedValue(true)
  vi.mocked(parsePostback).mockReturnValue(basePostback)
  vi.mocked(attributeClick).mockResolvedValue({
    clickId: 'full-click-uuid',
    campaignId: 'camp-1',
    userId: 'user-1',
    offerId: 'phenq',
  })
  vi.mocked(calcCommission).mockReturnValue({ user: 70, sophia: 30 })
  mockFirst.mockResolvedValue(null)  // no duplicate by default
  mockRun.mockResolvedValue({ success: true })
})

describe('POST /api/webhooks/clickbank', () => {
  it('returns 401 for invalid signature', async () => {
    vi.mocked(verifyClickBankSignature).mockResolvedValue(false)

    const res = await POST(makeRequest('body', 'bad-sig'))
    expect(res.status).toBe(401)
  })

  it('returns 200 and inserts row for valid SALE', async () => {
    const res = await POST(makeRequest('receipt=REC123&transactionType=SALE&amount=100'))

    expect(res.status).toBe(200)
    const json = await res.json() as Record<string, unknown>
    expect(json.ok).toBe(true)
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO affiliate_conversions'))
  })

  it('skips duplicate receipt+event_type (idempotency)', async () => {
    mockFirst.mockResolvedValue({ 1: 1 })  // existing row

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json() as Record<string, unknown>
    expect(json.skipped).toBe('duplicate')
    // INSERT should NOT be called
    expect(mockPrepare).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO affiliate_conversions'))
  })

  it('records payout_status=unattributed when cvendthru not found', async () => {
    vi.mocked(attributeClick).mockResolvedValue(null)

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    // payout_status='unattributed' passed to bind
    expect(mockBind).toHaveBeenCalledWith(
      expect.any(String), // id
      'REC123',            // receipt
      null,                // click_id
      null,                // campaign_id
      null,                // user_id
      null,                // offer_id
      'SALE',
      100,
      'USD',
      70,
      30,
      'unattributed',
      null,
      expect.any(String),
    )
  })

  it('notifies user on attributed SALE', async () => {
    await POST(makeRequest())
    expect(notifyConversionEarned).toHaveBeenCalledWith('user-1', 70, 'camp-1')
  })

  it('does NOT notify user for TEST event', async () => {
    vi.mocked(parsePostback).mockReturnValue({ ...basePostback, transactionType: 'TEST' as const })

    await POST(makeRequest())
    expect(notifyConversionEarned).not.toHaveBeenCalled()
  })

  it('returns 200 for unparseable body (ack ClickBank)', async () => {
    vi.mocked(parsePostback).mockReturnValue(null)

    const res = await POST(makeRequest('garbage!!'))
    expect(res.status).toBe(200)
    const json = await res.json() as Record<string, unknown>
    expect(json.skipped).toBe('parse_error')
  })

  it('uses negative amount for REFUND', async () => {
    vi.mocked(parsePostback).mockReturnValue({
      ...basePostback,
      transactionType: 'REFUND' as const,
      amount: 50,
    })
    vi.mocked(calcCommission).mockReturnValue({ user: -35, sophia: -15 })

    await POST(makeRequest())
    expect(calcCommission).toHaveBeenCalledWith(-50)
  })

  it('returns 200 when CLICKBANK_INS_SECRET not configured', async () => {
    delete process.env.CLICKBANK_INS_SECRET

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
  })

  // C1: TEST events must NOT get +60d clearance window
  it('TEST attributed event → available_at null (no clearance window)', async () => {
    vi.mocked(parsePostback).mockReturnValue({ ...basePostback, transactionType: 'TEST' as const })

    await POST(makeRequest())
    // bind args: id, receipt, click_id, campaign_id, user_id, offer_id,
    //            event_type, gross_amount, currency, commission_user, commission_sophia,
    //            payout_status, available_at, raw_payload
    expect(mockBind).toHaveBeenCalledWith(
      expect.any(String), // id
      'REC123',            // receipt
      'full-click-uuid',   // click_id
      'camp-1',            // campaign_id
      'user-1',            // user_id
      'phenq',             // offer_id
      'TEST',              // event_type
      100,                 // gross_amount
      'USD',               // currency
      70,                  // commission_user
      30,                  // commission_sophia
      'pending_clearance', // payout_status
      null,                // available_at MUST be null for TEST
      expect.any(String),  // raw_payload
    )
  })

  // H1: REFUND must UPDATE by receipt (not click_id), covers 'available' status too
  it('REFUND triggers UPDATE WHERE receipt = ? covering pending_clearance and available', async () => {
    vi.mocked(parsePostback).mockReturnValue({ ...basePostback, transactionType: 'REFUND' as const, amount: 50 })
    vi.mocked(calcCommission).mockReturnValue({ user: -35, sophia: -15 })
    mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } })

    await POST(makeRequest())

    // Check the UPDATE was called with receipt binding (not click_id)
    const updateCall = (mockPrepare.mock.calls as unknown as string[][]).find(
      (args) => typeof args[0] === 'string' && args[0].includes('UPDATE affiliate_conversions')
    )
    expect(updateCall).toBeDefined()
    const updateSql = updateCall![0]
    expect(updateSql).toContain("receipt = ?")
    expect(updateSql).toContain("payout_status IN ('pending_clearance','available')")
    // bind should have received 'REC123' (receipt) not 'full-click-uuid' (click_id)
    expect(mockBind).toHaveBeenCalledWith('REC123')
  })

  // H2: rate limit returns 429
  it('returns 429 when rate limit exceeded', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, resetInSeconds: 60 })

    const res = await POST(makeRequest())
    expect(res.status).toBe(429)
  })

  // H3: UNIQUE constraint error → skipped: duplicate_race (not insert_error)
  it('UNIQUE constraint insert failure → skipped: duplicate_race with 200', async () => {
    mockRun.mockRejectedValueOnce(new Error('UNIQUE constraint failed: affiliate_conversions.receipt'))

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json() as Record<string, unknown>
    expect(json.skipped).toBe('duplicate_race')
  })

  // H3: non-constraint error → skipped: insert_error
  it('non-constraint insert failure → skipped: insert_error with 200', async () => {
    mockRun.mockRejectedValueOnce(new Error('D1_ERROR: disk full'))

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json() as Record<string, unknown>
    expect(json.skipped).toBe('insert_error')
  })
})
