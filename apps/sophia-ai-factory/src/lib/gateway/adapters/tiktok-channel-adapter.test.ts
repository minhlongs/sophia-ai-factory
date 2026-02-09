import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TikTokChannelAdapter } from './tiktok-channel-adapter'
import type { CampaignOutput } from '../gateway-types'

const sampleContent: CampaignOutput = {
  campaignId: 'camp-002',
  videoUrl: 'https://example.com/tiktok-video.mp4',
  title: 'TikTok Test',
  description: 'A test video for TikTok',
  tags: ['trending', 'sophia'],
}

describe('TikTokChannelAdapter', () => {
  describe('when TIKTOK_API_KEY is configured', () => {
    beforeEach(() => {
      vi.stubEnv('TIKTOK_API_KEY', 'test-key')
    })
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('should return success with a stub published URL', async () => {
      const adapter = new TikTokChannelAdapter()
      const result = await adapter.publish(sampleContent)

      expect(result.channelId).toBe('tiktok')
      expect(result.success).toBe(true)
      expect(result.publishedUrl).toContain('tiktok.com')
      expect(result.publishedUrl).toContain('camp-002')
    })

    it('should report healthy status', async () => {
      const adapter = new TikTokChannelAdapter()
      const status = await adapter.getStatus()

      expect(status.channelId).toBe('tiktok')
      expect(status.healthy).toBe(true)
      expect(status.queueSize).toBe(0)
    })

    it('should track lastPublished after publishing', async () => {
      const adapter = new TikTokChannelAdapter()

      const statusBefore = await adapter.getStatus()
      expect(statusBefore.lastPublished).toBeUndefined()

      await adapter.publish(sampleContent)

      const statusAfter = await adapter.getStatus()
      expect(statusAfter.lastPublished).toBeInstanceOf(Date)
    })

    it('should return true for healthCheck', async () => {
      const adapter = new TikTokChannelAdapter()
      const healthy = await adapter.healthCheck()
      expect(healthy).toBe(true)
    })
  })

  describe('when TIKTOK_API_KEY is not configured', () => {
    beforeEach(() => {
      vi.stubEnv('TIKTOK_API_KEY', '')
    })
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('should return failure on publish', async () => {
      const adapter = new TikTokChannelAdapter()
      const result = await adapter.publish(sampleContent)

      expect(result.channelId).toBe('tiktok')
      expect(result.success).toBe(false)
      expect(result.error).toBe('TikTok API key not configured')
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
