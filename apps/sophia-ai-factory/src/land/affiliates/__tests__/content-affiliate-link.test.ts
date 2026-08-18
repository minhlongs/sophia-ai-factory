/**
 * Contract tests for content-affiliate-link
 *
 * Tests linkContentToAffiliate, getContentAffiliateLinks, and trackContentRevenue
 * using the globalThis.__env DB binding pattern (matches production getD1() path).
 *
 * @module affiliates/__tests__/content-affiliate-link-contract
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const mockRecordROI = vi.fn().mockResolvedValue({
  id: 'roi_1', workspaceId: 'ws_1', entityType: 'campaign',
  entityId: 'lk_1', revenueCents: 500, costCents: 100, roi: 400,
  channel: 'affiliate:awin', recordedAt: Date.now(),
})
vi.mock('@/tree/roi/tracker', () => ({
  recordROI: (...args: unknown[]) => mockRecordROI(...args),
}))

import { linkContentToAffiliate, getContentAffiliateLinks, trackContentRevenue } from '@/land/affiliates/content-affiliate-link'

const WORKSPACE_ID = 'ws_test_001'
const PROJECT_ID = 'proj_test_001'
const LINK_ID = 'lk_test_001'

const D1_ROW = {
  id: 'cal_1', workspace_id: WORKSPACE_ID, content_project_id: PROJECT_ID,
  content_asset_id: null, link_id: LINK_ID, affiliate_code: 'AWIN123',
  network: 'awin', status: 'active', attribution_id: null,
  generated_at: 1700000000000, created_at: 1700000000000,
}

function buildD1Mock(prepareImpl: (sql: string) => Record<string, unknown>) {
  return { prepare: vi.fn(prepareImpl) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('linkContentToAffiliate', () => {
  it('returns success with the link record after insert', async () => {
    const firstWs = vi.fn().mockResolvedValue({ org_id: WORKSPACE_ID })
    const runInsert = vi.fn().mockResolvedValue({ meta: { changes: 1 } })
    const firstSelect = vi.fn().mockResolvedValue(D1_ROW)
    const db = buildD1Mock((sql: string) => {
      if (sql.includes('org_members')) return { bind: vi.fn().mockReturnValue({ first: firstWs }) }
      if (sql.startsWith('INSERT')) return { bind: vi.fn().mockReturnValue({ run: runInsert }) }
      return { bind: vi.fn().mockReturnValue({ first: firstSelect }) }
    })
    ;(globalThis as unknown as { __env: Record<string, unknown> }).__env = { DB: db }

    const result = await linkContentToAffiliate({
      workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, linkId: LINK_ID,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.workspaceId).toBe(WORKSPACE_ID)
      expect(result.value.contentProjectId).toBe(PROJECT_ID)
      expect(result.value.linkId).toBe(LINK_ID)
    }
  })

  it('returns failure when workspace is not found', async () => {
    const db = buildD1Mock(() => ({
      bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) }),
    }))
    ;(globalThis as unknown as { __env: Record<string, unknown> }).__env = { DB: db }

    const result = await linkContentToAffiliate({
      workspaceId: 'unknown_ws', projectId: PROJECT_ID, linkId: LINK_ID,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('Workspace not found')
  })

  it('returns success for duplicate insert (INSERT OR IGNORE idempotency)', async () => {
    const runInsert = vi.fn().mockResolvedValue({ meta: { changes: 0 } })
    const db = buildD1Mock((sql: string) => {
      if (sql.includes('org_members')) return { bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue({ org_id: WORKSPACE_ID }) }) }
      if (sql.startsWith('INSERT')) return { bind: vi.fn().mockReturnValue({ run: runInsert }) }
      return { bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(D1_ROW) }) }
    })
    ;(globalThis as unknown as { __env: Record<string, unknown> }).__env = { DB: db }

    const result = await linkContentToAffiliate({
      workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, linkId: LINK_ID,
    })

    expect(result.ok).toBe(true)
  })

  it('returns failure when D1 is unavailable', async () => {
    delete (globalThis as unknown as Record<string, unknown>).__env

    const result = await linkContentToAffiliate({
      workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, linkId: LINK_ID,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('D1')
  })
})

describe('getContentAffiliateLinks', () => {
  it('returns links for a project', async () => {
    const db = buildD1Mock(() => ({
      bind: vi.fn().mockReturnValue({ all: vi.fn().mockResolvedValue({ results: [D1_ROW] }) }),
    }))
    ;(globalThis as unknown as { __env: Record<string, unknown> }).__env = { DB: db }

    const result = await getContentAffiliateLinks({ workspaceId: WORKSPACE_ID, projectId: PROJECT_ID })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(1)
      expect(result.value[0].contentProjectId).toBe(PROJECT_ID)
    }
  })

  it('returns all workspace links when projectId omitted', async () => {
    const db = buildD1Mock(() => ({
      bind: vi.fn().mockReturnValue({ all: vi.fn().mockResolvedValue({ results: [D1_ROW] }) }),
    }))
    ;(globalThis as unknown as { __env: Record<string, unknown> }).__env = { DB: db }

    const result = await getContentAffiliateLinks({ workspaceId: WORKSPACE_ID })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toHaveLength(1)
  })

  it('returns empty array when no links exist', async () => {
    const db = buildD1Mock(() => ({
      bind: vi.fn().mockReturnValue({ all: vi.fn().mockResolvedValue({ results: [] }) }),
    }))
    ;(globalThis as unknown as { __env: Record<string, unknown> }).__env = { DB: db }

    const result = await getContentAffiliateLinks({ workspaceId: WORKSPACE_ID, projectId: 'nonexistent' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toHaveLength(0)
  })

  it('returns failure when D1 is unavailable', async () => {
    delete (globalThis as unknown as Record<string, unknown>).__env

    const result = await getContentAffiliateLinks({ workspaceId: WORKSPACE_ID })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('D1')
  })
})

describe('trackContentRevenue', () => {
  it('calls recordROI with affiliate network channel', async () => {
    const result = await trackContentRevenue({
      workspaceId: WORKSPACE_ID, linkId: LINK_ID,
      revenueCents: 500, costCents: 100, network: 'awin',
    })

    expect(result.ok).toBe(true)
    expect(mockRecordROI).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: WORKSPACE_ID, entityType: 'campaign', entityId: LINK_ID,
      revenueCents: 500, costCents: 100, channel: 'affiliate:awin',
    }))
  })

  it('returns failure for negative revenue', async () => {
    const result = await trackContentRevenue({
      workspaceId: WORKSPACE_ID, linkId: LINK_ID,
      revenueCents: -100, costCents: 0,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('non-negative')
  })

  it('returns failure for negative cost', async () => {
    const result = await trackContentRevenue({
      workspaceId: WORKSPACE_ID, linkId: LINK_ID,
      revenueCents: 0, costCents: -1,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('non-negative')
  })

  it('returns failure when recordROI throws', async () => {
    mockRecordROI.mockRejectedValueOnce(new Error('ROI insert failed'))

    const result = await trackContentRevenue({
      workspaceId: WORKSPACE_ID, linkId: LINK_ID,
      revenueCents: 500, costCents: 100,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain('ROI insert failed')
  })

  it('omits channel when network not provided', async () => {
    const result = await trackContentRevenue({
      workspaceId: WORKSPACE_ID, linkId: LINK_ID,
      revenueCents: 500, costCents: 100,
    })
    expect(result.ok).toBe(true)
    expect(mockRecordROI).toHaveBeenCalledWith(expect.objectContaining({ channel: undefined }))
  })
})