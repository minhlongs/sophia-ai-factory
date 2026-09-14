/**
 * Tests for Autonomous Discovery-to-Campaign Pipeline Bridge
 *
 * Covers:
 * - mapOfferToMissionInput mapping logic (topic, keywords, language, niche, links)
 * - convertOfferToCampaign input validation (missing user, invalid offer)
 * - Successful campaign creation delegation to runAutoVideoMission
 * - AutoVideoMissionError handling and code propagation
 * - Unexpected exception handling with fail-closed Result.failure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mapOfferToMissionInput,
  convertOfferToCampaign,
  buildTopicFromOffer,
  extractKeywordsFromOffer,
} from '../campaign-bridge'
import type { RankedDiscoveredOffer } from '../discovery-wave'
import { AutoVideoMissionError, type AutoVideoMissionResult } from '@/land/missions/auto-video-mission'

const mockRunAutoVideoMission = vi.fn()
vi.mock('@/land/missions/auto-video-mission', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/land/missions/auto-video-mission')>()
  return { ...actual, runAutoVideoMission: (...args: unknown[]) => mockRunAutoVideoMission(...args) }
})

describe('campaign-bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const sampleOffer: RankedDiscoveredOffer = {
    externalId: 'cb-ai-writer-101',
    network: 'clickbank',
    title: 'AI Copywriting Assistant Ultra',
    description: 'Autonomous copywriting platform generating high-converting marketing content.',
    productUrl: 'https://hop.clickbank.net/?affiliate=sophia&vendor=aicopy',
    imageUrl: 'https://example.com/logo.png',
    commissionPct: 50,
    commissionFixedUsd: null,
    niche: 'marketing',
    language: 'en',
    region: 'US',
    isTrending: true,
    qualityScore: 0.89,
    passesScamGate: true,
    scoreBreakdown: { epc: 0.9, vendor: 0.88 },
  }

  describe('mapping functions', () => {
    it('builds topic directly from offer title', () => {
      expect(buildTopicFromOffer(sampleOffer)).toBe('AI Copywriting Assistant Ultra')
    })

    it('extracts keywords including niche, network, and words from title and description', () => {
      const keywords = extractKeywordsFromOffer(sampleOffer)
      expect(keywords).toContain('marketing')
      expect(keywords).toContain('clickbank')
      expect(keywords.some((k) => k.includes('copywriting'))).toBe(true)
    })

    it('maps offer and options to AutoVideoMissionInput correctly', () => {
      const mapped = mapOfferToMissionInput(sampleOffer, {
        userId: 'usr_789',
        secondaryLanguage: 'vi',
        channelId: 'chan_yt_1',
        scheduledAt: 1780000000,
        maxAffiliateLinks: 4,
      })

      expect(mapped.userId).toBe('usr_789')
      expect(mapped.topic).toBe('AI Copywriting Assistant Ultra')
      expect(mapped.primaryLanguage).toBe('en')
      expect(mapped.secondaryLanguage).toBe('vi')
      expect(mapped.channelId).toBe('chan_yt_1')
      expect(mapped.scheduledAt).toBe(1780000000)
      expect(mapped.nicheHint).toBe('marketing')
      expect(mapped.maxAffiliateLinks).toBe(4)
    })

    it('respects topicOverride and explicit primaryLanguage if provided', () => {
      const mapped = mapOfferToMissionInput(sampleOffer, {
        userId: 'usr_789',
        topicOverride: 'How to automate copywriting in 2026',
        primaryLanguage: 'vi',
        nicheHint: 'custom-niche',
      })

      expect(mapped.topic).toBe('How to automate copywriting in 2026')
      expect(mapped.primaryLanguage).toBe('vi')
      expect(mapped.nicheHint).toBe('custom-niche')
    })
  })

  describe('convertOfferToCampaign', () => {
    const mockMissionResult: AutoVideoMissionResult = {
      missionId: 'msn_abc123',
      script: {
        primary: {
          language: 'en',
          body: 'Generated SEO script...',
          seoScore: 92,
          suggestedTitles: ['10x Your Copy With AI'],
          wordCount: 350,
        },
      },
      description: { body: 'Check out the tools...', affiliateCount: 2 },
      video: {
        videoId: 'vid_999',
        heygenJobId: 'hey_job_1',
        status: 'completed',
        videoUrl: 'https://cdn.example.com/video.mp4',
      },
      publish: { jobId: 'pub_job_1', scheduledAt: 1780000000 },
      status: 'succeeded',
    }

    it('returns UNAUTHORIZED failure when userId is missing', async () => {
      const result = await convertOfferToCampaign(sampleOffer, { userId: '' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('UNAUTHORIZED')
      }
      expect(mockRunAutoVideoMission).not.toHaveBeenCalled()
    })

    it('returns INVALID_OFFER failure when offer has no title', async () => {
      const result = await convertOfferToCampaign({ ...sampleOffer, title: ' ' }, { userId: 'usr_789' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_OFFER')
      }
      expect(mockRunAutoVideoMission).not.toHaveBeenCalled()
    })

    it('successfully calls runAutoVideoMission and returns Result.success', async () => {
      mockRunAutoVideoMission.mockResolvedValue(mockMissionResult)
      const result = await convertOfferToCampaign(sampleOffer, { userId: 'usr_789', channelId: 'chan_1' })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.missionId).toBe('msn_abc123')
        expect(result.value.script.primary.seoScore).toBe(92)
      }
      expect(mockRunAutoVideoMission).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'usr_789', topic: 'AI Copywriting Assistant Ultra' }),
      )
    })

    it('handles AutoVideoMissionError and propagates structured error code', async () => {
      mockRunAutoVideoMission.mockRejectedValue(
        new AutoVideoMissionError('BYOK_REQUIRED', 'OpenRouter API key missing', 'msn_err_1'),
      )
      const result = await convertOfferToCampaign(sampleOffer, { userId: 'usr_789' })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('BYOK_REQUIRED')
        expect(result.error.message).toBe('OpenRouter API key missing')
        expect(result.error.missionId).toBe('msn_err_1')
      }
    })

    it('catches generic errors and returns CAMPAIGN_CREATION_FAILED', async () => {
      mockRunAutoVideoMission.mockRejectedValue(new Error('D1 connection reset'))
      const result = await convertOfferToCampaign(sampleOffer, { userId: 'usr_789' })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('CAMPAIGN_CREATION_FAILED')
        expect(result.error.message).toBe('D1 connection reset')
      }
    })
  })
})
