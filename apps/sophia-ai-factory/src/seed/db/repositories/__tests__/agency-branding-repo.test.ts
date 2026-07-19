/**
 * @vitest
 * AgencyBrandingRepo — getBranding + updateBranding tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getBranding, updateBranding } from '@/seed/db/repositories/agency-branding-repo'
import * as dbClient from '@/seed/db/client'

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
  getD1: vi.fn(),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

interface Chain {
  prepare: ReturnType<typeof vi.fn>
  bind: ReturnType<typeof vi.fn>
  first: ReturnType<typeof vi.fn>
  all: ReturnType<typeof vi.fn>
  run: ReturnType<typeof vi.fn>
}

function mockD1() {
  const chain = {} as Chain
  chain.bind = vi.fn().mockReturnThis()
  chain.first = vi.fn()
  chain.all = vi.fn()
  chain.run = vi.fn()
  chain.prepare = vi.fn().mockReturnValue(chain)

  const rawDb = { prepare: vi.fn().mockReturnValue(chain as never) }
  vi.mocked(dbClient.getD1).mockReturnValue(rawDb as never)
  return { rawDb, chain }
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('agency-branding-repo', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getBranding', () => {
    it('returns DEFAULT_BRANDING when no row exists', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({ data: null })

      const result = await getBranding(99)
      expect(result.displayName).toBe('My Agency')
      expect(result.primaryColor).toBe('#3B82F6')
      expect(result.secondaryColor).toBe('#8B5CF6')
      expect(result.logoUrl).toBeNull()
    })

    it('returns branding from DB row', async () => {
      const { chain } = mockD1()
      chain.first.mockResolvedValue({
        data: {
          agency_id: 1,
          primary_color: '#ff0000',
          secondary_color: '#00ff00',
          logo_url: 'https://logo.example.com/logo.png',
          custom_domain: 'brand.example.com',
          display_name: 'Acme',
          tagline_vi: 'Xin chào',
          tagline_en: 'Hello',
          updated_at: 1000,
        },
      })

      const result = await getBranding(1)
      expect(result.primaryColor).toBe('#ff0000')
      expect(result.secondaryColor).toBe('#00ff00')
      expect(result.logoUrl).toBe('https://logo.example.com/logo.png')
      expect(result.customDomain).toBe('brand.example.com')
      expect(result.displayName).toBe('Acme')
      expect(result.taglineVi).toBe('Xin chào')
      expect(result.taglineEn).toBe('Hello')
    })
  })

  describe('updateBranding', () => {
    it('successfully updates all fields', async () => {
      const { chain } = mockD1()
      chain.run.mockResolvedValue({ meta: { changes: 1 }, error: null })

      const result = await updateBranding(1, {
        primaryColor: '#111',
        secondaryColor: '#222',
        logoUrl: 'https://example.com/logo.png',
        customDomain: 'custom.example.com',
        displayName: 'NewName',
        taglineVi: 'Tiếng Việt',
        taglineEn: 'English',
      })

      expect(result.ok).toBe(true)
      // bind should be called with [now, ...fieldValues..., agencyId]
      const bindArgs = chain.bind.mock.calls[0] as unknown[] | undefined
      expect(bindArgs).toBeDefined()
      expect(bindArgs!.length).toBeGreaterThan(1)
      // agencyId is always last
      expect(bindArgs![bindArgs!.length - 1]).toBe(1)
    })

    it('handles partial updates', async () => {
      const { chain } = mockD1()
      chain.run.mockResolvedValue({ meta: { changes: 1 }, error: null })

      const result = await updateBranding(1, { displayName: 'Only Name' })
      expect(result.ok).toBe(true)
      // bind called with [now, 'Only Name', 1]
      const bindArgs = chain.bind.mock.calls[0] as unknown[] | undefined
      expect(bindArgs).toBeDefined()
      expect(bindArgs!.length).toBe(3) // now + displayName + agencyId
    })

    it('returns failure on DB error', async () => {
      const { chain } = mockD1()
      chain.run.mockResolvedValue({ meta: { changes: 0 }, error: new Error('DB locked') })

      const result = await updateBranding(1, { displayName: 'Test' })
      expect(result.ok).toBe(false)
    })
  })
})
