/**
 * channel-caption-rules.test.ts — Unit tests for channel locale/cap rules
 */

import { describe, it, expect } from 'vitest'
import { getChannelCaptionRule, enforceCharCap } from './channel-caption-rules'
import type { ChannelProvider } from '@/seed/types';

describe('getChannelCaptionRule', () => {
  it('maps zalo to vi locale with mixed_vi_en hashtag style', () => {
    const rule = getChannelCaptionRule('zalo')
    expect(rule.targetLocale).toBe('vi')
    expect(rule.hashtagStyle).toBe('mixed_vi_en')
  })

  it('maps telegram to vi locale', () => {
    const rule = getChannelCaptionRule('telegram')
    expect(rule.targetLocale).toBe('vi')
  })

  it('maps linkedin to en locale with formal hashtag style', () => {
    const rule = getChannelCaptionRule('linkedin')
    expect(rule.targetLocale).toBe('en')
    expect(rule.hashtagStyle).toBe('formal_en')
    expect(rule.charCap).toBe(3000)
  })

  it('maps twitter to en locale with 280 char cap', () => {
    const rule = getChannelCaptionRule('twitter')
    expect(rule.targetLocale).toBe('en')
    expect(rule.charCap).toBe(280)
  })

  it('maps tiktok to vi locale with 2200 char cap', () => {
    const rule = getChannelCaptionRule('tiktok')
    expect(rule.targetLocale).toBe('vi')
    expect(rule.charCap).toBe(2200)
  })

  it('maps youtube to en locale', () => {
    const rule = getChannelCaptionRule('youtube')
    expect(rule.targetLocale).toBe('en')
    expect(rule.charCap).toBe(5000)
  })

  it('maps facebook to vi locale', () => {
    const rule = getChannelCaptionRule('facebook')
    expect(rule.targetLocale).toBe('vi')
  })

  it('maps reddit to none hashtag style', () => {
    const rule = getChannelCaptionRule('reddit')
    expect(rule.hashtagStyle).toBe('none')
  })

  it('covers all ChannelProvider values without throwing', () => {
    const providers: ChannelProvider[] = [
      'tiktok', 'youtube', 'instagram', 'pinterest',
      'linkedin', 'facebook', 'twitter', 'threads',
      'reddit', 'bluesky', 'mastodon', 'zalo', 'telegram',
    ]

    for (const provider of providers) {
      expect(() => getChannelCaptionRule(provider)).not.toThrow()
      const rule = getChannelCaptionRule(provider)
      expect(rule.targetLocale).toBeTruthy()
      expect(typeof rule.charCap).toBe('number')
    }
  })
})

describe('enforceCharCap', () => {
  it('returns original when cap is 0', () => {
    const long = 'A'.repeat(500)
    expect(enforceCharCap(long, 0)).toBe(long)
  })

  it('returns original when within cap', () => {
    expect(enforceCharCap('hello', 280)).toBe('hello')
  })

  it('truncates and appends ellipsis when over cap', () => {
    const text = 'A'.repeat(300)
    const result = enforceCharCap(text, 280)
    expect(result.length).toBe(280)
    expect(result.endsWith('…')).toBe(true)
  })

  it('handles exact cap length (no truncation)', () => {
    const text = 'A'.repeat(280)
    expect(enforceCharCap(text, 280)).toBe(text)
  })

  it('handles empty string', () => {
    expect(enforceCharCap('', 280)).toBe('')
  })
})
