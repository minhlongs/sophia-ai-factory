/**
 * Tests for POST /api/discovery/score — Phase 9B discovery score user endpoint.
 *
 * Coverage:
 *   401 when no user session
 *   400 when body has no program
 *   400 when niche missing
 *   400 when niche >200 chars
 *   400 when program.id missing
 *   200 happy path — enhancer called with (program, niche, user.id)
 *   500 when enhancer throws — logger.warn called
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/discovery/affiliate-openrouter-niche-enhancer', () => ({
  enhanceNicheScoreWithAI: vi.fn(),
}))

vi.mock('@/lib/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { POST } from './route'
import { getCurrentUser } from '@/lib/better-auth-session'
import { enhanceNicheScoreWithAI } from '@/lib/discovery/affiliate-openrouter-niche-enhancer'
import { logger } from '@/lib/utils/logger-utility'

const mockGetCurrentUser    = vi.mocked(getCurrentUser)
const mockEnhanceNicheScore = vi.mocked(enhanceNicheScoreWithAI)
const mockLogger            = vi.mocked(logger)

const USER = { id: 'user-abc' } as Awaited<ReturnType<typeof getCurrentUser>>

const VALID_PROGRAM = { id: 'prog-1', name: 'ClickBank' }
const VALID_NICHE   = 'fitness supplements'

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/discovery/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('POST /api/discovery/score', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('401 when no user session', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const res = await POST(makeRequest({ program: VALID_PROGRAM, niche: VALID_NICHE }))
    expect(res.status).toBe(401)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Unauthorized')
    expect(mockEnhanceNicheScore).not.toHaveBeenCalled()
  })

  it('400 when body has no program', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    const res = await POST(makeRequest({ niche: VALID_NICHE }))
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Invalid request')
    expect(mockEnhanceNicheScore).not.toHaveBeenCalled()
  })

  it('400 when niche missing', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    const res = await POST(makeRequest({ program: VALID_PROGRAM }))
    expect(res.status).toBe(400)
    expect(mockEnhanceNicheScore).not.toHaveBeenCalled()
  })

  it('400 when niche exceeds 200 chars', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    const longNiche = 'a'.repeat(201)
    const res = await POST(makeRequest({ program: VALID_PROGRAM, niche: longNiche }))
    expect(res.status).toBe(400)
    expect(mockEnhanceNicheScore).not.toHaveBeenCalled()
  })

  it('400 when program.id missing', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    const res = await POST(makeRequest({ program: { name: 'NoId' }, niche: VALID_NICHE }))
    expect(res.status).toBe(400)
    expect(mockEnhanceNicheScore).not.toHaveBeenCalled()
  })

  it('200 happy path — calls enhancer with (program, niche, user.id)', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    mockEnhanceNicheScore.mockResolvedValue(87)

    const res = await POST(makeRequest({ program: VALID_PROGRAM, niche: VALID_NICHE }))
    expect(res.status).toBe(200)

    const json = (await res.json()) as { score: number }
    expect(json.score).toBe(87)

    // Verify all three args — especially 3rd arg is user.id exactly
    expect(mockEnhanceNicheScore).toHaveBeenCalledWith(
      expect.objectContaining({ id: VALID_PROGRAM.id, name: VALID_PROGRAM.name }),
      VALID_NICHE,
      USER!.id,
    )
  })

  it('200 when enhancer returns null (score unavailable)', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    mockEnhanceNicheScore.mockResolvedValue(null)

    const res = await POST(makeRequest({ program: VALID_PROGRAM, niche: VALID_NICHE }))
    expect(res.status).toBe(200)

    const json = (await res.json()) as { score: null }
    expect(json.score).toBeNull()
  })

  it('500 when enhancer throws — logger.warn called, no score returned', async () => {
    mockGetCurrentUser.mockResolvedValue(USER)
    mockEnhanceNicheScore.mockRejectedValue(new Error('OPENROUTER_UNAVAILABLE'))

    const res = await POST(makeRequest({ program: VALID_PROGRAM, niche: VALID_NICHE }))
    expect(res.status).toBe(500)

    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Scoring failed')

    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[discovery-score] enhanceNicheScoreWithAI failed',
      expect.objectContaining({
        userId: USER!.id,
        error:  'OPENROUTER_UNAVAILABLE',
      }),
    )
  })
})
