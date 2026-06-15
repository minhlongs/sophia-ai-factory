/**
 * Tests for youtube:list-channels handler — P13 multi-account wiring.
 *
 * Validates that the handler reads from publishing_channels and supports
 * 0, 1, or N channels per user.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn(),
}))

import { createServerClient } from '@/seed/db/client'
import { handle } from './youtube-list-channels'

const mockClient = createServerClient as ReturnType<typeof vi.fn>

interface EqCall { arg0: unknown; arg1: unknown }
const eqCalls: EqCall[] = []

function buildDbMock(rows: unknown[] | null, error: unknown = null) {
  eqCalls.length = 0
  const eq2 = vi.fn((arg0: unknown, arg1: unknown) => {
    eqCalls.push({ arg0, arg1 })
    return Promise.resolve({ data: rows, error })
  })
  const eq1 = vi.fn((arg0: unknown, arg1: unknown) => {
    eqCalls.push({ arg0, arg1 })
    return { eq: eq2 }
  })
  const select = vi.fn().mockReturnValue({ eq: eq1 })
  const from = vi.fn().mockReturnValue({ select })
  return { from }
}

const baseCtx = {
  missionId: 'm-1',
  userId: 'u-1',
  command: 'youtube:list-channels',
  params: {},
}

describe('youtube:list-channels handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty channels with upgrade_path when user has none', async () => {
    mockClient.mockReturnValueOnce(buildDbMock([]))
    const result = await handle(baseCtx)
    expect(result.ok).toBe(true)
    expect(result.data?.channels).toEqual([])
    expect(result.data?.total).toBe(0)
    expect(result.data?.upgrade_path).toContain('Settings > Integrations')
  })

  it('returns single channel when user connected one', async () => {
    mockClient.mockReturnValueOnce(buildDbMock([
      {
        id: 'pc-1',
        external_account_id: 'UCxxxxxxxxxxxxxxxxxxxx',
        display_name: 'My Channel',
        status: 'active',
        expires_at: 9999999999,
      },
    ]))
    const result = await handle(baseCtx)
    expect(result.ok).toBe(true)
    expect(result.data?.total).toBe(1)
    const channels = result.data?.channels as Array<{ id: string; channel_id: string; title: string }>
    expect(channels[0].id).toBe('pc-1')
    expect(channels[0].channel_id).toBe('UCxxxxxxxxxxxxxxxxxxxx')
    expect(channels[0].title).toBe('My Channel')
  })

  it('returns N channels when user connected multiple', async () => {
    mockClient.mockReturnValueOnce(buildDbMock([
      { id: 'pc-1', external_account_id: 'UC1', display_name: 'Primary', status: 'active', expires_at: 9999999999 },
      { id: 'pc-2', external_account_id: 'UC2', display_name: 'Secondary', status: 'active', expires_at: 9999999999 },
      { id: 'pc-3', external_account_id: 'UC3', display_name: 'Brand', status: 'active', expires_at: 9999999999 },
    ]))
    const result = await handle(baseCtx)
    expect(result.ok).toBe(true)
    expect(result.data?.total).toBe(3)
    const channels = result.data?.channels as Array<{ id: string; title: string }>
    expect(channels.map((c) => c.title)).toEqual(['Brand', 'Primary', 'Secondary'])
  })

  it('falls back display_name when null in DB', async () => {
    mockClient.mockReturnValueOnce(buildDbMock([
      { id: 'pc-1', external_account_id: 'UC1', display_name: null, status: 'active', expires_at: null },
    ]))
    const result = await handle(baseCtx)
    const channels = result.data?.channels as Array<{ title: string }>
    expect(channels[0].title).toBe('YouTube Channel')
  })

  it('passes through disconnected status without filtering', async () => {
    mockClient.mockReturnValueOnce(buildDbMock([
      { id: 'pc-1', external_account_id: 'UC1', display_name: 'Expired Ch', status: 'expired', expires_at: 1 },
    ]))
    const result = await handle(baseCtx)
    expect(result.ok).toBe(true)
    const channels = result.data?.channels as Array<{ status: string }>
    expect(channels[0].status).toBe('expired')
  })

  it('filters by tenant_id AND provider=youtube (tenant isolation)', async () => {
    mockClient.mockReturnValueOnce(buildDbMock([]))
    await handle({ ...baseCtx, userId: 'specific-tenant' })
    const tenantCall = eqCalls.find((c) => c.arg0 === 'tenant_id')
    const providerCall = eqCalls.find((c) => c.arg0 === 'provider')
    expect(tenantCall?.arg1).toBe('specific-tenant')
    expect(providerCall?.arg1).toBe('youtube')
  })

  it('treats DB error with null data as empty channel list', async () => {
    mockClient.mockReturnValueOnce(buildDbMock(null, { message: 'db unreachable' }))
    const result = await handle(baseCtx)
    expect(result.ok).toBe(true)
    expect(result.data?.total).toBe(0)
  })
})
