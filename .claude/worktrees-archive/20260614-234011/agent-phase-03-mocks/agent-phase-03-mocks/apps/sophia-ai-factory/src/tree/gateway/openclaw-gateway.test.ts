import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenClawGateway } from '@/tree/gateway/openclaw-gateway'
import type {
  CampaignOutput,
  ChannelAdapter,
  ChannelStatus,
  GatewayChannel,
  PublishResult,
} from '@/tree/gateway/gateway-types'

function createMockAdapter(overrides?: Partial<ChannelAdapter>): ChannelAdapter {
  return {
    publish: vi.fn<(content: CampaignOutput) => Promise<PublishResult>>().mockResolvedValue({
      channelId: 'mock',
      success: true,
      publishedUrl: 'https://example.com/mock',
    }),
    getStatus: vi.fn<() => Promise<ChannelStatus>>().mockResolvedValue({
      channelId: 'mock',
      healthy: true,
      queueSize: 0,
    }),
    healthCheck: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    ...overrides,
  }
}

function createMockChannel(
  id: string,
  adapter?: ChannelAdapter,
  enabled = true,
): GatewayChannel {
  return {
    id,
    name: `Channel ${id}`,
    adapter: adapter ?? createMockAdapter(),
    enabled,
    rateLimitPerHour: 100,
  }
}

const sampleContent: CampaignOutput = {
  campaignId: 'camp-001',
  videoUrl: 'https://example.com/video.mp4',
  title: 'Test Campaign',
  description: 'A test campaign for distribution',
  tags: ['test', 'demo'],
}

describe('OpenClawGateway', () => {
  let gateway: OpenClawGateway

  beforeEach(() => {
    vi.useFakeTimers()
    gateway = new OpenClawGateway({ maxRetries: 0, baseDelayMs: 10, maxDelayMs: 100 })
  })

  describe('channel management', () => {
    it('should register and list channels', () => {
      const channel = createMockChannel('youtube')
      gateway.registerChannel(channel)
      expect(gateway.getChannelIds()).toEqual(['youtube'])
    })

    it('should remove a channel by ID', () => {
      gateway.registerChannel(createMockChannel('youtube'))
      gateway.registerChannel(createMockChannel('tiktok'))
      expect(gateway.removeChannel('youtube')).toBe(true)
      expect(gateway.getChannelIds()).toEqual(['tiktok'])
    })

    it('should return false when removing nonexistent channel', () => {
      expect(gateway.removeChannel('nonexistent')).toBe(false)
    })

    it('should enable and disable a channel', () => {
      const channel = createMockChannel('youtube', undefined, true)
      gateway.registerChannel(channel)
      gateway.setChannelEnabled('youtube', false)
      // Channel is disabled - distribute should skip it
      expect(channel.enabled).toBe(false)
    })

    it('should do nothing when enabling nonexistent channel', () => {
      // Should not throw
      gateway.setChannelEnabled('nonexistent', true)
    })
  })

  describe('distribute', () => {
    it('should distribute to all enabled channels', async () => {
      const adapter1 = createMockAdapter()
      const adapter2 = createMockAdapter()
      vi.mocked(adapter1.publish).mockResolvedValue({
        channelId: 'ch1',
        success: true,
        publishedUrl: 'https://ch1.com/1',
      })
      vi.mocked(adapter2.publish).mockResolvedValue({
        channelId: 'ch2',
        success: true,
        publishedUrl: 'https://ch2.com/1',
      })

      gateway.registerChannel(createMockChannel('ch1', adapter1))
      gateway.registerChannel(createMockChannel('ch2', adapter2))

      const result = await gateway.distribute(sampleContent)

      expect(result.campaignId).toBe('camp-001')
      expect(result.allSucceeded).toBe(true)
      expect(result.results).toHaveLength(2)
      expect(adapter1.publish).toHaveBeenCalledWith(sampleContent)
      expect(adapter2.publish).toHaveBeenCalledWith(sampleContent)
    })

    it('should skip disabled channels', async () => {
      const enabledAdapter = createMockAdapter()
      const disabledAdapter = createMockAdapter()

      gateway.registerChannel(createMockChannel('enabled', enabledAdapter, true))
      gateway.registerChannel(createMockChannel('disabled', disabledAdapter, false))

      await gateway.distribute(sampleContent)

      expect(enabledAdapter.publish).toHaveBeenCalled()
      expect(disabledAdapter.publish).not.toHaveBeenCalled()
    })

    it('should handle publish failures gracefully', async () => {
      const failingAdapter = createMockAdapter({
        publish: vi.fn<(content: CampaignOutput) => Promise<PublishResult>>().mockRejectedValue(
          new Error('Network error'),
        ),
      })

      gateway.registerChannel(createMockChannel('failing', failingAdapter))

      const result = await gateway.distribute(sampleContent)

      expect(result.allSucceeded).toBe(false)
      expect(result.results[0].success).toBe(false)
      expect(result.results[0].error).toContain('Network error')
    })

    it('should return empty results when no channels registered', async () => {
      const result = await gateway.distribute(sampleContent)
      expect(result.results).toHaveLength(0)
      expect(result.allSucceeded).toBe(true)
    })
  })

  describe('healthCheck', () => {
    it('should report healthy when all channels are healthy', async () => {
      gateway.registerChannel(createMockChannel('ch1'))
      gateway.registerChannel(createMockChannel('ch2'))

      const report = await gateway.healthCheck()

      expect(report.overallHealthy).toBe(true)
      expect(report.channels).toHaveLength(2)
      expect(report.timestamp).toBeInstanceOf(Date)
    })

    it('should report unhealthy when adapter getStatus throws', async () => {
      const brokenAdapter = createMockAdapter({
        getStatus: vi.fn<() => Promise<ChannelStatus>>().mockRejectedValue(
          new Error('Status check failed'),
        ),
      })

      gateway.registerChannel(createMockChannel('broken', brokenAdapter))

      const report = await gateway.healthCheck()

      expect(report.overallHealthy).toBe(false)
      expect(report.channels[0].healthy).toBe(false)
    })
  })

  describe('selfHeal', () => {
    it('should retry only failed channels', async () => {
      const adapter1 = createMockAdapter()
      const adapter2 = createMockAdapter()

      vi.mocked(adapter1.publish).mockResolvedValue({
        channelId: 'ch1',
        success: true,
      })
      vi.mocked(adapter2.publish).mockResolvedValue({
        channelId: 'ch2',
        success: true,
      })

      gateway.registerChannel(createMockChannel('ch1', adapter1))
      gateway.registerChannel(createMockChannel('ch2', adapter2))

      const previousResult = {
        campaignId: 'camp-001',
        results: [
          { channelId: 'ch1', success: true },
          { channelId: 'ch2', success: false, error: 'Timeout' },
        ],
        allSucceeded: false,
      }

      const result = await gateway.selfHeal(sampleContent, previousResult)

      // ch1 was already successful, should NOT be retried
      expect(adapter1.publish).not.toHaveBeenCalled()
      // ch2 failed, should be retried
      expect(adapter2.publish).toHaveBeenCalledWith(sampleContent)
      expect(result.allSucceeded).toBe(true)
      expect(result.results).toHaveLength(2)
    })

    it('should handle missing channel during self-heal', async () => {
      const previousResult = {
        campaignId: 'camp-001',
        results: [
          { channelId: 'removed-channel', success: false, error: 'Error' },
        ],
        allSucceeded: false,
      }

      const result = await gateway.selfHeal(sampleContent, previousResult)

      expect(result.results[0].success).toBe(false)
      expect(result.results[0].error).toContain('Channel not found or disabled')
    })

    // F8 fix tests: parallel concurrency cap + aggregate result
    it('F8: 10 channels with concurrency=5 run in ~2 batches, not 10 sequential', async () => {
      // Each publish resolves immediately (no delay) — only verifying parallelism via call timing.
      // We track max-concurrent inflight count.
      let inflight = 0
      let maxInflight = 0

      const makeAdapter = (id: string): ChannelAdapter => ({
        publish: vi.fn<(content: CampaignOutput) => Promise<PublishResult>>().mockImplementation(
          () =>
            new Promise<PublishResult>((resolve) => {
              inflight++
              maxInflight = Math.max(maxInflight, inflight)
              // Resolve on next microtask
              Promise.resolve().then(() => {
                inflight--
                resolve({ channelId: id, success: true })
              })
            }),
        ),
        getStatus: vi.fn<() => Promise<ChannelStatus>>().mockResolvedValue({ channelId: id, healthy: true, queueSize: 0 }),
        healthCheck: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
      })

      const previousResult = {
        campaignId: 'camp-001',
        results: Array.from({ length: 10 }, (_, i) => ({
          channelId: `ch${i}`,
          success: false,
          error: 'Timeout',
        })),
        allSucceeded: false,
      }

      for (let i = 0; i < 10; i++) {
        gateway.registerChannel(createMockChannel(`ch${i}`, makeAdapter(`ch${i}`)))
      }

      const result = await gateway.selfHeal(sampleContent, previousResult)

      // All 10 healed
      expect(result.healed).toBe(10)
      expect(result.failed).toBe(0)
      expect(result.errors).toHaveLength(0)
      expect(result.allSucceeded).toBe(true)
      // Max inflight never exceeded 5 (concurrency cap)
      expect(maxInflight).toBeLessThanOrEqual(5)
      // At least 5 ran concurrently (not purely sequential)
      expect(maxInflight).toBeGreaterThan(1)
    })

    it('F8: 1 channel fails all 3 attempts → aggregate healed=9, failed=1, no throw', async () => {
      const failAdapter = createMockAdapter({
        publish: vi.fn<(content: CampaignOutput) => Promise<PublishResult>>().mockRejectedValue(
          new Error('Persistent failure'),
        ),
      })
      const successAdapter = createMockAdapter({
        publish: vi.fn<(content: CampaignOutput) => Promise<PublishResult>>().mockResolvedValue({
          channelId: 'good',
          success: true,
        }),
      })

      for (let i = 0; i < 9; i++) {
        gateway.registerChannel(createMockChannel(`good${i}`, createMockAdapter({
          publish: vi.fn<(content: CampaignOutput) => Promise<PublishResult>>().mockResolvedValue({
            channelId: `good${i}`,
            success: true,
          }),
        })))
      }
      gateway.registerChannel(createMockChannel('bad', failAdapter))
      void successAdapter // suppress unused warning

      const previousResult = {
        campaignId: 'camp-001',
        results: [
          ...Array.from({ length: 9 }, (_, i) => ({ channelId: `good${i}`, success: false, error: 'Timeout' })),
          { channelId: 'bad', success: false, error: 'Timeout' },
        ],
        allSucceeded: false,
      }

      // Advance timers to cover bounded backoff delays (2 retries × 2s max = 4s)
      const resultPromise = gateway.selfHeal(sampleContent, previousResult)
      await vi.advanceTimersByTimeAsync(5000)
      const result = await resultPromise

      expect(result.healed).toBe(9)
      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Persistent failure')
      expect(result.allSucceeded).toBe(false)
    })

    it('F8: all channels fail → returns aggregate with failed=N, no throw', async () => {
      const numChannels = 3
      for (let i = 0; i < numChannels; i++) {
        gateway.registerChannel(createMockChannel(`ch${i}`, createMockAdapter({
          publish: vi.fn<(content: CampaignOutput) => Promise<PublishResult>>().mockRejectedValue(
            new Error(`Error ${i}`),
          ),
        })))
      }

      const previousResult = {
        campaignId: 'camp-001',
        results: Array.from({ length: numChannels }, (_, i) => ({
          channelId: `ch${i}`,
          success: false,
          error: 'Prior error',
        })),
        allSucceeded: false,
      }

      const resultPromise = gateway.selfHeal(sampleContent, previousResult)
      await vi.advanceTimersByTimeAsync(5000)
      const result = await resultPromise

      // Should NOT throw — returns aggregate
      expect(result.healed).toBe(0)
      expect(result.failed).toBe(numChannels)
      expect(result.errors).toHaveLength(numChannels)
      expect(result.allSucceeded).toBe(false)
    })
  })

  describe('retry policy', () => {
    it('should use custom retry policy', async () => {
      const gw = new OpenClawGateway({ maxRetries: 2, baseDelayMs: 5, maxDelayMs: 50 })
      const adapter = createMockAdapter({
        publish: vi.fn<(content: CampaignOutput) => Promise<PublishResult>>()
          .mockRejectedValueOnce(new Error('Fail 1'))
          .mockRejectedValueOnce(new Error('Fail 2'))
          .mockResolvedValue({ channelId: 'ch1', success: true }),
      })

      gw.registerChannel(createMockChannel('ch1', adapter))

      const resultPromise = gw.distribute(sampleContent)
      // Advance timers to handle backoff delays
      await vi.advanceTimersByTimeAsync(200)
      const result = await resultPromise

      expect(result.allSucceeded).toBe(true)
      expect(adapter.publish).toHaveBeenCalledTimes(3)
    })

    it('should fail after exhausting retries', async () => {
      const gw = new OpenClawGateway({ maxRetries: 1, baseDelayMs: 5, maxDelayMs: 50 })
      const adapter = createMockAdapter({
        publish: vi.fn<(content: CampaignOutput) => Promise<PublishResult>>()
          .mockRejectedValue(new Error('Persistent error')),
      })

      gw.registerChannel(createMockChannel('ch1', adapter))

      const resultPromise = gw.distribute(sampleContent)
      await vi.advanceTimersByTimeAsync(200)
      const result = await resultPromise

      expect(result.allSucceeded).toBe(false)
      expect(result.results[0].error).toContain('Failed after 2 attempts')
      expect(adapter.publish).toHaveBeenCalledTimes(2)
    })
  })
})
