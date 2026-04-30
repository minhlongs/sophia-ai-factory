/**
 * Tests for cloak route tenant isolation and attribution
 *
 * Verifies:
 * - Tenant A click uses Tenant A tenant_id in click_event
 * - Tenant B click does NOT bleed into Tenant A event stream
 * - ip_hash is always SHA-256, never raw IP
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { recordClick } from './click-recorder'

const TENANT_A = 'tenant-aaaaa'
const TENANT_B = 'tenant-bbbbb'

function setD1Mock(capturedRows: unknown[][]) {
  const mockRun = vi.fn().mockResolvedValue({ success: true })
  const mockBind = vi.fn().mockImplementation((...args: unknown[]) => {
    capturedRows.push(args)
    return { run: mockRun }
  })
  ;(globalThis as unknown as { __env: Record<string, unknown> }).__env.DB = {
    prepare: vi.fn().mockReturnValue({ bind: mockBind }),
  }
  return { mockRun }
}

afterEach(() => {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env
  if (env) {
    env.DB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [], success: true }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    }
  }
})

describe('cloak attribution — tenant isolation', () => {
  it('records click_event with tenant_id from link (Tenant A)', async () => {
    const captured: unknown[][] = []
    setD1Mock(captured)

    const clickId = await recordClick({
      clickId: 'click-aaa-001',
      tenantId: TENANT_A,
      linkId: 'link-tenant-a-001',
      offerId: 'offer-001',
      ip: '1.2.3.4',
      userAgent: 'TestAgent',
      referrer: null,
      country: 'VN',
    })

    expect(clickId).toBe('click-aaa-001')
    const tenantARow = captured.find(args => args[1] === TENANT_A)
    expect(tenantARow).toBeDefined()
  })

  it('tenant B click does NOT appear in Tenant A event stream', async () => {
    const captured: unknown[][] = []
    setD1Mock(captured)

    await recordClick({
      clickId: 'click-bbb-001',
      tenantId: TENANT_B,
      linkId: 'link-tenant-b-001',
      offerId: 'offer-002',
      ip: '5.6.7.8',
      userAgent: 'TestAgent',
      referrer: null,
      country: 'US',
    })

    const tenantALeaks = captured.filter(args => args.includes(TENANT_A))
    expect(tenantALeaks.length).toBe(0)
  })

  it('ip_hash is SHA-256 hex (64 chars), never raw ip', async () => {
    let capturedIpHash: unknown = null
    ;(globalThis as unknown as { __env: Record<string, unknown> }).__env.DB = {
      prepare: vi.fn().mockReturnValue({
        bind: (...args: unknown[]) => {
          capturedIpHash = args[4]
          return { run: vi.fn().mockResolvedValue({ success: true }) }
        },
      }),
    }

    await recordClick({
      clickId: 'click-ip-test',
      tenantId: TENANT_A,
      linkId: 'link-001',
      offerId: 'offer-001',
      ip: '192.168.100.200',
      userAgent: null,
      referrer: null,
      country: null,
    })

    expect(typeof capturedIpHash).toBe('string')
    expect(capturedIpHash as string).toMatch(/^[0-9a-f]{64}$/)
    expect(capturedIpHash as string).not.toContain('192.168')
  })
})
