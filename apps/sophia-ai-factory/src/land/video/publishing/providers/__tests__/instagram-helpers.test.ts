/**
 * Regression coverage for the extracted Instagram publishing helpers.
 *
 * Pins the caption contract that keeps sponsored posts compliant: the `#ad`
 * disclosure must appear exactly once, hashtags must all be `#`-prefixed, and
 * the product link must trail on its own line.
 *
 * @vitest
 */

import { describe, it, expect } from 'vitest'
import { buildCaption, GRAPH_API_VERSION, GRAPH_BASE, isMockMode, POLL_ATTEMPTS, POLL_INTERVAL_MS } from '../instagram-helpers'
import type { PublishMeta } from '../publisher-interface'

function meta(over: Partial<PublishMeta> = {}): PublishMeta {
  return {
    videoId: 'vid-1',
    channelId: 'chan-1',
    caption: 'Check out this deal',
    hashtags: ['deals', '#sale'],
    ...over,
  } as PublishMeta
}

describe('buildCaption', () => {
  it('prefixes the caption with the required #ad disclosure', () => {
    const caption = buildCaption(meta())
    expect(caption.startsWith('#ad ')).toBe(true)
    expect(caption).toContain('#ad Check out this deal')
  })

  it('does not duplicate the disclosure when the caption already carries it', () => {
    const caption = buildCaption(meta({ caption: '#ad Already disclosed' }))
    expect(caption.match(/#ad /g)).toHaveLength(1)
    expect(caption).toContain('#ad Already disclosed')
  })

  it('prefixes only the hashtags that lack one', () => {
    const caption = buildCaption(meta({ hashtags: ['deals', '#sale'] }))
    expect(caption).toContain('#deals #sale')
    expect(caption).not.toContain('##')
  })

  it('keeps an already-prefixed hashtag as a single #', () => {
    const caption = buildCaption(meta({ hashtags: ['#sale'] }))
    expect(caption).toContain('#sale')
    expect(caption).not.toContain('##')
  })

  it('appends the product link on its own line when present', () => {
    const caption = buildCaption(meta({ productLink: 'https://aff.example.com/p/1' }))
    expect(caption.endsWith('https://aff.example.com/p/1')).toBe(true)
    expect(caption.split('\n\n')).toHaveLength(3)
  })

  it('omits the trailing link when there is no product link', () => {
    const caption = buildCaption(meta({ productLink: '' }))
    expect(caption.endsWith('Check out this deal\n\n#deals #sale')).toBe(true)
    expect(caption).not.toContain('http')
  })

  it('emits no link line when the product link is undefined', () => {
    const caption = buildCaption(meta({ productLink: undefined }))
    expect(caption.split('\n\n')).toHaveLength(2)
  })
})

describe('instagram provider constants and mode', () => {
  it('targets a pinned Graph API version', () => {
    expect(GRAPH_API_VERSION).toBe('v19.0')
    expect(GRAPH_BASE).toBe('https://graph.facebook.com/v19.0')
  })

  it('bounds the media polling loop', () => {
    expect(POLL_ATTEMPTS).toBe(10)
    expect(POLL_INTERVAL_MS).toBe(2000)
  })

  it('reports mock mode from the presence of the app id', () => {
    expect(typeof isMockMode()).toBe('boolean')
    expect(isMockMode()).toBe(
      process.env.INSTAGRAM_APP_ID ? false : true,
    )
  })
})
