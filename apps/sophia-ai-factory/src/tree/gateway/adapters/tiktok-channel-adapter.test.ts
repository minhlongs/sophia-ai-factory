import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TikTokChannelAdapter } from '@/tree/gateway/adapters/tiktok-channel-adapter'
import type { CampaignOutput } from '@/tree/gateway/gateway-types'

// Mock TikTok OAuth client
vi.mock('@/land/tiktok/tiktok-oauth-client', () => ({
  publishVideo: vi.fn(),
  checkPublishStatus: vi.fn(),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { publishVideo, checkPublishStatus } from '@/land/tiktok/tiktok-oauth-client'

const sampleContent: CampaignOutput = {
  campaignId: 'camp-002',
  videoUrl: 'https://example.com/tiktok-video.mp4',
  title: 'TikTok Test',
  description: 'A test video for TikTok',
  tags: ['trending', 'sophia'],
}

describe('TikTokChannelAdapter', () => {
  describe('when tiktok_access_token is provided', () => {
    beforeEach(() => {
      vi.mocked(publishVideo).mockResolvedValue('publish-123')
      vi.mocked(checkPublishStatus).mockResolvedValue({
        status: 'PUBLISH_COMPLETE',
        publicUrl: 'https://tiktok.com/@user/video/camp-002',
      })
    })

    afterEach(() => {
      vi.clearAllMocks()
    })

    it('should return success with a published URL', async () => {
      const adapter = new TikTokChannelAdapter({ tiktok_access_token: 'test-token' })
      const result = await adapter.publish(sampleContent)

      expect(result.channelId).toBe('tiktok')
      expect(result.success).toBe(true)
      expect(result.publishedUrl).toContain('tiktok.com')
    })

    it('should report healthy status', async () => {
      const adapter = new TikTokChannelAdapter({ tiktok_access_token: 'test-token' })
      const status = await adapter.getStatus()

      expect(status.channelId).toBe('tiktok')
      expect(status.healthy).toBe(true)
      expect(status.queueSize).toBe(0)
    })

    it('should track lastPublished after publishing', async () => {
      const adapter = new TikTokChannelAdapter({ tiktok_access_token: 'test-token' })

      const statusBefore = await adapter.getStatus()
      expect(statusBefore.lastPublished).toBeUndefined()

      await adapter.publish(sampleContent)

      const statusAfter = await adapter.getStatus()
      expect(statusAfter.lastPublished).toBeInstanceOf(Date)
    })

    it('should return true for healthCheck', async () => {
      const adapter = new TikTokChannelAdapter({ tiktok_access_token: 'test-token' })
      const healthy = await adapter.healthCheck()
      expect(healthy).toBe(true)
    })
  })

  describe('when no tiktok_access_token is provided', () => {
    it('should return failure on publish', async () => {
      const adapter = new TikTokChannelAdapter()
      const result = await adapter.publish(sampleContent)

      expect(result.channelId).toBe('tiktok')
      expect(result.success).toBe(false)
      expect(result.error).toBe('TikTok access token not configured')
    })

    it('should report unhealthy status', async () => {
      const adapter = new TikTokChannelAdapter()
      const status = await adapter.getStatus()

      expect(status.healthy).toBe(false)
    })

    it('should return false for healthCheck', async () => {
      const adapter = new TikTokChannelAdapter()
      const healthy = await adapter.healthCheck()
      expect(healthy).toBe(false)
    })
  })
})
