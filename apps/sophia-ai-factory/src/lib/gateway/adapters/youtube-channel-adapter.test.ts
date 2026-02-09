import { describe, it, expect } from 'vitest'
import { YouTubeChannelAdapter } from './youtube-channel-adapter'
import type { CampaignOutput } from '../gateway-types'

const sampleContent: CampaignOutput = {
  campaignId: 'camp-001',
  videoUrl: 'https://example.com/video.mp4',
  title: 'Test Video',
  description: 'A test video for YouTube',
  tags: ['test'],
}

describe('YouTubeChannelAdapter', () => {
  describe('publish', () => {
    it('should return success with a stub published URL', async () => {
      const adapter = new YouTubeChannelAdapter()

      const result = await adapter.publish(sampleContent)

      expect(result.channelId).toBe('youtube')
      expect(result.success).toBe(true)
      expect(result.publishedUrl).toContain('youtube.com')
      expect(result.publishedUrl).toContain('camp-001')
    })
  })

  describe('getStatus', () => {
    it('should report healthy with zero queue size', async () => {
      const adapter = new YouTubeChannelAdapter()

      const status = await adapter.getStatus()

      expect(status.channelId).toBe('youtube')
      expect(status.healthy).toBe(true)
      expect(status.queueSize).toBe(0)
    })

    it('should track lastPublished after publishing', async () => {
      const adapter = new YouTubeChannelAdapter()

      const statusBefore = await adapter.getStatus()
      expect(statusBefore.lastPublished).toBeUndefined()

      await adapter.publish(sampleContent)

      const statusAfter = await adapter.getStatus()
      expect(statusAfter.lastPublished).toBeInstanceOf(Date)
    })
  })

  describe('healthCheck', () => {
    it('should return true (stub implementation)', async () => {
      const adapter = new YouTubeChannelAdapter()

      const healthy = await adapter.healthCheck()

      expect(healthy).toBe(true)
    })
  })
})
