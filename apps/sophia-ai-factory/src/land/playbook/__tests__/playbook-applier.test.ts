/**
 * Unit tests for playbook-applier.ts
 *
 * Verifies that PlaybookConfigValues is stamped onto the SOP install's
 * existing config_values JSON column (no schema change) and that the
 * toggle/get helpers round-trip correctly. Uses a fake D1 binding.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { D1Database } from '@cloudflare/workers-types'

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockRow = { id: 'inst-001', config_values: null as string | null } as { id: string; config_values: string | null }

const fakeDb = {
  prepare: vi.fn().mockReturnThis(),
  bind: vi.fn().mockReturnThis(),
  first: vi.fn(async () => mockRow),
  run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
  all: vi.fn(async () => ({ results: [] })),
  execute: vi.fn(async () => ({ results: [] })),
  unwrap: () => fakeDb,
}

const createServerClientMock = vi.fn(() => fakeDb)

vi.mock('@/seed/db/client', () => ({
  createServerClient: createServerClientMock,
}))

const { applyPlaybook, toggleAutoApply, getPlaybookConfig } =
  await import('@/land/playbook/playbook-applier')

const rule = {
  id: 'rule_ws_youtube_conversion_hook',
  workspaceId: 'ws_test',
  patternId: 'pat_x',
  platform: 'youtube',
  goal: 'conversion',
  ruleVi: 'Dùng hook curiosity_gap',
  ruleEn: 'Use curiosity_gap hooks',
  confidence: 0.95,
  sampleSize: 50,
  appliedCount: 0,
  autoApply: true,
  rollbackCount: 0,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
} as any

describe('applyPlaybook — config_values shape', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRow.config_values = null
    fakeDb.prepare.mockClear()
    fakeDb.bind.mockClear()
    fakeDb.first.mockClear()
    fakeDb.run.mockClear()
  })

  it('stamps source=playbook + autoApply into config_values JSON', async () => {
    const result = await applyPlaybook(rule, 'tpl-youtube-hook', 'user-001', '0 9 * * 1')
    expect(result.success).toBe(true)
    if (!result.success) return

    // The INSERT should have been called with a config_values JSON blob.
    // bind() receives positional params; the config_values blob is one of them.
    const bindCalls = fakeDb.bind.mock.calls
    const configJson = bindCalls
      .flatMap((c: unknown[]) => c as unknown[])
      .find((p: unknown) => typeof p === 'string' && p.includes('"source":"playbook"'))
    expect(configJson).toBeTruthy()
    const parsed = JSON.parse(configJson as string) as Record<string, unknown>
    expect(parsed.source).toBe('playbook')
    expect(parsed.ruleId).toBe(rule.id)
    expect(parsed.platform).toBe('youtube')
    expect(parsed.goal).toBe('conversion')
    expect(parsed.autoApply).toBe(true)
    expect(typeof parsed.appliedAt).toBe('number')
  })

  it('returns DB_ERROR when no database binding', async () => {
    createServerClientMock.mockImplementationOnce(() => {
      throw new Error('D1 database binding not available')
    })
    const result = await applyPlaybook(rule, 'tpl-x', 'user-001')
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.code).toBe('DB_ERROR')
  })
})

describe('toggleAutoApply — round-trip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRow.config_values = JSON.stringify({
      source: 'playbook',
      ruleId: rule.id,
      platform: 'youtube',
      goal: 'conversion',
      autoApply: true,
      appliedAt: 1_700_000_000,
    })
    fakeDb.prepare.mockClear()
    fakeDb.bind.mockClear()
    fakeDb.first.mockClear()
    fakeDb.run.mockClear()
  })

  it('flips autoApply from true to false', async () => {
    const result = await toggleAutoApply('inst-001', false)
    expect(result.success).toBe(true)
    const bindCalls = fakeDb.bind.mock.calls
    const updatedJson = bindCalls.find((c: unknown[]) =>
      typeof c[0] === 'string' && c[0].includes('"autoApply":false'),
    )
    expect(updatedJson).toBeTruthy()
  })

  it('returns NOT_FOUND for missing installation', async () => {
    vi.clearAllMocks()
    mockRow.config_values = null
    fakeDb.first.mockResolvedValueOnce(null as unknown as { id: string; config_values: string | null })
    const result = await toggleAutoApply('missing-id', true)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.code).toBe('NOT_FOUND')
  })
})

describe('getPlaybookConfig — filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fakeDb.prepare.mockClear()
    fakeDb.bind.mockClear()
    fakeDb.first.mockClear()
  })

  it('returns null for non-playbook installations', async () => {
    mockRow.config_values = JSON.stringify({ source: 'manual', autoApply: false })
    fakeDb.first.mockResolvedValueOnce({ id: 'inst-001', config_values: mockRow.config_values })
    const config = await getPlaybookConfig('inst-001')
    expect(config).toBeNull()
  })

  it('returns the parsed config for playbook-sourced installs', async () => {
    const cfg = {
      source: 'playbook',
      ruleId: rule.id,
      platform: 'youtube',
      goal: 'conversion',
      autoApply: true,
      appliedAt: 1_700_000_000,
    }
    mockRow.config_values = JSON.stringify(cfg)
    fakeDb.first.mockResolvedValueOnce({ id: 'inst-001', config_values: mockRow.config_values })
    const config = await getPlaybookConfig('inst-001')
    expect(config).toEqual(cfg)
  })
})