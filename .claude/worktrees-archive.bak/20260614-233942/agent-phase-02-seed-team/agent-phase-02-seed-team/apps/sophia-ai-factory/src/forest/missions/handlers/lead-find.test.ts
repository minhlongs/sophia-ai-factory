/**
 * Tests for lead:find handler — P5/P9 Apollo live wiring.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: vi.fn(),
}))
vi.mock('@/tree/apollo/apollo-client', () => ({
  apolloPeopleSearch: vi.fn(),
}))

import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key'
import { apolloPeopleSearch } from '@/tree/apollo/apollo-client'
import { handle } from './lead-find'

const mockResolve = resolveUserApiKey as ReturnType<typeof vi.fn>
const mockSearch = apolloPeopleSearch as ReturnType<typeof vi.fn>

const baseCtx = {
  missionId: 'm-1',
  userId: 'u-1',
  command: 'lead:find',
  params: { niche: 'saas marketing', count: 10 },
}

describe('lead:find handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('returns stub leads when no BYOK Apollo key', async () => {
    mockResolve.mockResolvedValueOnce(null)
    const promise = handle(baseCtx)
    await vi.advanceTimersByTimeAsync(2000)
    const result = await promise
    expect(result.ok).toBe(true)
    expect(result.data?.is_stub).toBe(true)
    expect(result.data?.stub_reason).toBe('no_byok_key')
    expect(result.data?.total).toBe(10)
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('calls Apollo with niche + count when key is present', async () => {
    vi.useRealTimers()
    mockResolve.mockResolvedValueOnce('apollo-key-xxx')
    mockSearch.mockResolvedValueOnce({
      people: [
        {
          id: 'a1', name: 'Alice Adams', first_name: 'Alice', last_name: 'Adams',
          title: 'CMO', email: 'alice@acme.io', linkedin_url: 'https://linkedin.com/in/alice',
          organization: { id: 'o1', name: 'Acme', primary_domain: 'acme.io', industry: 'SaaS' },
        },
      ],
      pagination: { page: 1, per_page: 10, total_entries: 1, total_pages: 1 },
    })
    const result = await handle(baseCtx)
    expect(result.ok).toBe(true)
    expect(result.data?.is_stub).toBe(false)
    const leads = result.data?.leads as Array<{ source: string }>
    expect(leads[0].source).toBe('apollo')
    expect(mockSearch).toHaveBeenCalledWith('apollo-key-xxx', expect.objectContaining({
      q_keywords: 'saas marketing',
      per_page: 10,
      page: 1,
    }))
  })

  it('forwards titles + industries when supplied', async () => {
    vi.useRealTimers()
    mockResolve.mockResolvedValueOnce('apollo-key-xxx')
    mockSearch.mockResolvedValueOnce({
      people: [],
      pagination: { page: 1, per_page: 25, total_entries: 0, total_pages: 0 },
    })
    await handle({
      ...baseCtx,
      params: { ...baseCtx.params, titles: ['CEO', 'Founder'], industries: ['SaaS'], page: 2 },
    })
    expect(mockSearch).toHaveBeenCalledWith('apollo-key-xxx', expect.objectContaining({
      person_titles: ['CEO', 'Founder'],
      industry: ['SaaS'],
      page: 2,
    }))
  })

  it('returns apollo_<status> code when API fails', async () => {
    vi.useRealTimers()
    mockResolve.mockResolvedValueOnce('apollo-key-xxx')
    mockSearch.mockRejectedValueOnce({ code: 'apollo_403', status: 403, message: 'Quota exceeded' })
    const result = await handle(baseCtx)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('apollo_403')
  })

  it('caps count at 100 (Apollo per_page max)', async () => {
    vi.useRealTimers()
    mockResolve.mockResolvedValueOnce('apollo-key-xxx')
    mockSearch.mockResolvedValueOnce({
      people: [],
      pagination: { page: 1, per_page: 100, total_entries: 0, total_pages: 0 },
    })
    await handle({ ...baseCtx, params: { ...baseCtx.params, count: 5000 } })
    expect(mockSearch).toHaveBeenCalledWith('apollo-key-xxx', expect.objectContaining({ per_page: 100 }))
  })

  it('handles missing organization gracefully', async () => {
    vi.useRealTimers()
    mockResolve.mockResolvedValueOnce('apollo-key-xxx')
    mockSearch.mockResolvedValueOnce({
      people: [{
        id: 'a1', name: 'Solo', first_name: 'Solo', last_name: null,
        title: null, email: null, linkedin_url: null, organization: null,
      }],
      pagination: { page: 1, per_page: 25, total_entries: 1, total_pages: 1 },
    })
    const result = await handle(baseCtx)
    expect(result.ok).toBe(true)
    const leads = result.data?.leads as Array<{ company: string | null; domain: string | null }>
    expect(leads[0].company).toBeNull()
    expect(leads[0].domain).toBeNull()
  })
})
