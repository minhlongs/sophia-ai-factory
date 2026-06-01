/**
 * Tests for avatar:create-did handler — P26 D-ID live wiring.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: vi.fn(),
}))

vi.mock('@/land/did/did-client', () => ({
  createDidTalk: vi.fn(),
}))

import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key'
import { createDidTalk } from '@/land/did/did-client'
import { handle } from './avatar-create-did'

const mockResolve = resolveUserApiKey as ReturnType<typeof vi.fn>
const mockCreate = createDidTalk as ReturnType<typeof vi.fn>

const baseCtx = {
  missionId: 'm-1',
  userId: 'u-1',
  command: 'avatar:create-did',
  params: {
    source_url: 'https://r2.example/portrait.png',
    script: 'Hello, welcome to Sophia AI Factory.',
  },
}

describe('avatar:create-did handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when source_url or script missing', async () => {
    const result = await handle({ ...baseCtx, params: { script: 'only script' } })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('missing_params')
  })

  it('rejects when source_url is not https', async () => {
    const result = await handle({
      ...baseCtx,
      params: { source_url: 'http://insecure/p.png', script: 'hi' },
    })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('missing_params')
  })

  it('returns no_byok_did_key when no D-ID key', async () => {
    mockResolve.mockResolvedValueOnce(null)
    const result = await handle(baseCtx)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('no_byok_did_key')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns talk_id on successful D-ID call', async () => {
    mockResolve.mockResolvedValueOnce('did-key-xxx')
    mockCreate.mockResolvedValueOnce({ id: 'talk_abc123', status: 'created' })

    const result = await handle(baseCtx)
    expect(result.ok).toBe(true)
    expect(result.data?.talk_id).toBe('talk_abc123')
    expect(result.data?.status).toBe('created')
    expect(result.data?.poll_url).toContain('talk_abc123')
    expect(result.data?.is_stub).toBe(false)
  })

  it('surfaces did_<status> code on API error', async () => {
    mockResolve.mockResolvedValueOnce('did-key-xxx')
    mockCreate.mockRejectedValueOnce({ code: 'did_401', status: 401, message: 'Unauthorized' })

    const result = await handle(baseCtx)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('did_401')
  })

  it('returns avatar_create_failed on unexpected error', async () => {
    mockResolve.mockResolvedValueOnce('did-key-xxx')
    mockCreate.mockRejectedValueOnce(new Error('socket hang up'))

    const result = await handle(baseCtx)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('avatar_create_failed')
  })

  it('defaults voice_provider to microsoft when elevenlabs not requested', async () => {
    mockResolve.mockResolvedValueOnce('did-key-xxx')
    mockCreate.mockResolvedValueOnce({ id: 'talk_x', status: 'created' })

    await handle(baseCtx)
    expect(mockCreate).toHaveBeenCalledWith('did-key-xxx', expect.objectContaining({ voiceProvider: 'microsoft' }))
  })
})
