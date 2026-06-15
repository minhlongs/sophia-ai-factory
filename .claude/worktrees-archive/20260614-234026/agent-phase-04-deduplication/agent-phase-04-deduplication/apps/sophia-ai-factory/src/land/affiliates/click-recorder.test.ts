/**
 * Tests for click-recorder — GDPR compliance and dual-write logic
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { recordClick } from './click-recorder'
import type { ClickData } from './click-recorder'

const baseClick: ClickData = {
  clickId: 'test-click-uuid-1234',
  tenantId: 'tenant-abc',
  linkId: 'link-xyz',
  offerId: 'offer-001',
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  referrer: 'https://example.com',
  country: 'VN',
}

function setD1Mock(onBind?: (...args: unknown[]) => void) {
  const mockRun = vi.fn().mockResolvedValue({ success: true })
  const mockBind = vi.fn().mockImplementation((...args: unknown[]) => {
    onBind?.(...args)
    return { run: mockRun }
  })
  const d1Mock = { prepare: vi.fn().mockReturnValue({ bind: mockBind }) }
  ;(globalThis as unknown as { __env: Record<string, unknown> }).__env.DB = d1Mock
  return { mockRun }
}

afterEach(() => {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env
  if (env) {
    // Restore to vitest setup's default mock (null-returning first)
    env.DB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [], success: true }),
        run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
      }),
    }
  }
})

describe('recordClick', () => {
  it('returns the clickId', async () => {
    setD1Mock()
    const result = await recordClick(baseClick)
    expect(result).toBe(baseClick.clickId)
  })

  it('does not store raw IP — only ip_hash (SHA-256, 64 hex chars)', async () => {
    let ipHashArg: unknown
    setD1Mock((...args: unknown[]) => {
      if (args[1] === 'tenant-abc') ipHashArg = args[4]
    })
    await recordClick(baseClick)
    expect(typeof ipHashArg).toBe('string')
    expect(ipHashArg as string).toMatch(/^[0-9a-f]{64}$/)
    expect(ipHashArg as string).not.toContain('192.168.1.1')
  })

  it('truncates UA to 120 chars', async () => {
    const longUa = 'A'.repeat(200)
    let uaArg: unknown
    setD1Mock((...args: unknown[]) => {
      if (args[1] === 'tenant-abc') uaArg = args[5]
    })
    await recordClick({ ...baseClick, userAgent: longUa })
    expect(typeof uaArg).toBe('string')
    expect((uaArg as string).length).toBe(120)
  })

  it('stores null ip_hash when ip is null', async () => {
    let ipHashArg: unknown = 'not-set'
    setD1Mock((...args: unknown[]) => {
      if (args[1] === 'tenant-abc') ipHashArg = args[4]
    })
    await recordClick({ ...baseClick, ip: null })
    expect(ipHashArg).toBeNull()
  })

  it('does not throw when DB bind throws', async () => {
    ;(globalThis as unknown as { __env: Record<string, unknown> }).__env.DB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ run: vi.fn().mockRejectedValue(new Error('D1 error')) }),
      }),
    }
    await expect(recordClick(baseClick)).resolves.toBe(baseClick.clickId)
  })
})
