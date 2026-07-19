import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { YouTubeChannelAdapter } from '@/tree/gateway/adapters/youtube-channel-adapter'
import type { CampaignOutput } from '@/tree/gateway/gateway-types'

// Mock dependencies used by the adapter
vi.mock('@/land/youtube/youtube-oauth-client', () => ({
  uploadVideo: vi.fn(),
  refreshAccessToken: vi.fn(),
}))

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { uploadVideo, refreshAccessToken } from '@/land/youtube/youtube-oauth-client'
import { createServerClient } from '@/seed/db/client'

const sampleContent: CampaignOutput = {
  campaignId: 'camp-001',
  videoUrl: 'https://example.com/video.mp4',
  title: 'Test Video',
  description: 'A test video for YouTube',
  tags: ['test'],
}

describe('YouTubeChannelAdapter', () => {
  describe('when OAuth credentials are configured and userId provided', () => {
    beforeEach(() => {
      vi.stubEnv('YOUTUBE_CLIENT_ID', 'test-client-id')
      vi.stubEnv('YOUTUBE_CLIENT_SECRET', 'test-client-secret')
      vi.stubEnv('YOUTUBE_REDIRECT_URI', 'http://localhost/callback')

      // Mock Supabase returning stored credentials
      vi.mocked(createServerClient).mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: {
                  api_keys: {
                    youtube: {
                      refresh_token: 'test-refresh',
                      access_token: 'test-access',
                      expires_at: Math.floor(Date.now() / 1000) + 3600,
                    },
                  },
                },
                error: null,
              }),
            }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }),
      } as never)

      vi.mocked(uploadVideo).mockResolvedValue('https://youtube.com/watch?v=camp-001')
    })

    afterEach(() => {
      vi.unstubAllEnvs()
      vi.clearAllMocks()
    })

    it('should return success with a published URL', async () => {
      const adapter = new YouTubeChannelAdapter('user-1')
      const result = await adapter.publish(sampleContent)

      expect(result.channelId).toBe('youtube')
      expect(result.success).toBe(true)
      expect(result.publishedUrl).toContain('youtube.com')
    })

    it('should report healthy status', async () => {
      const adapter = new YouTubeChannelAdapter('user-1')
      const status = await adapter.getStatus()

      expect(status.channelId).toBe('youtube')
      expect(status.healthy).toBe(true)
      expect(status.queueSize).toBe(0)
    })

    it('should track lastPublished after publishing', async () => {
      const adapter = new YouTubeChannelAdapter('user-1')

      const statusBefore = await adapter.getStatus()
      expect(statusBefore.lastPublished).toBeUndefined()

      await adapter.publish(sampleContent)

      const statusAfter = await adapter.getStatus()
      expect(statusAfter.lastPublished).toBeInstanceOf(Date)
    })

    it('should return true for healthCheck', async () => {
      const adapter = new YouTubeChannelAdapter('user-1')
      const healthy = await adapter.healthCheck()
      expect(healthy).toBe(true)
    })
  })

  describe('when OAuth credentials are not configured', () => {
    beforeEach(() => {
      vi.stubEnv('YOUTUBE_CLIENT_ID', '')
      vi.stubEnv('YOUTUBE_CLIENT_SECRET', '')
      vi.stubEnv('YOUTUBE_REDIRECT_URI', '')
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('should return failure on publish', async () => {
      const adapter = new YouTubeChannelAdapter('user-1')
      const result = await adapter.publish(sampleContent)

      expect(result.channelId).toBe('youtube')
      expect(result.success).toBe(false)
      expect(result.error).toBe('YouTube OAuth credentials not configured')
    })

    it('should report unhealthy status', async () => {
      const adapter = new YouTubeChannelAdapter('user-1')
      const status = await adapter.getStatus()

      expect(status.healthy).toBe(false)
    })

    it('should return false for healthCheck', async () => {
      const adapter = new YouTubeChannelAdapter('user-1')
      const healthy = await adapter.healthCheck()
      expect(healthy).toBe(false)
    })
  })

  describe('when no userId is provided', () => {
    beforeEach(() => {
      vi.stubEnv('YOUTUBE_CLIENT_ID', 'test-client-id')
      vi.stubEnv('YOUTUBE_CLIENT_SECRET', 'test-client-secret')
      vi.stubEnv('YOUTUBE_REDIRECT_URI', 'http://localhost/callback')
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('should return failure when no userId', async () => {
      const adapter = new YouTubeChannelAdapter()
      const result = await adapter.publish(sampleContent)

      expect(result.channelId).toBe('youtube')
      expect(result.success).toBe(false)
    })

    it('should report unhealthy status without userId', async () => {
      const adapter = new YouTubeChannelAdapter()
      const status = await adapter.getStatus()
      expect(status.healthy).toBe(false)
    })
  })
})
