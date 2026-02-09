import { describe, it, expect } from 'vitest'
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
  describe('publish', () => {
    it('should return success with a stub published URL', async () => {
      const adapter = new TikTokChannelAdapter()

      const result = await adapter.publish(sampleContent)

      expect(result.channelId).toBe('tiktok')
      expect(result.success).toBe(true)
      expect(result.publishedUrl).toContain('tiktok.com')
      expect(result.publishedUrl).toContain('camp-002')
    })
  })

  describe('getStatus', () => {
    it('should report healthy with zero queue size', async () => {
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
  })

  describe('healthCheck', () => {
    it('should return true (stub implementation)', async () => {
      const adapter = new TikTokChannelAdapter()

      const healthy = await adapter.healthCheck()

      expect(healthy).toBe(true)
    })
  })
})
