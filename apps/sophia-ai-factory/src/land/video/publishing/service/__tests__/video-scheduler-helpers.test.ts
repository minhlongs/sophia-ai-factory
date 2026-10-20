/**
 * Regression coverage for the extracted video scheduler DB and validation helpers.
 *
 * Pins the access-control contract: a caller may only validate against a video
 * they own, and only against a channel they own or that their tenant owns.
 *
 * @vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { resolvePublishDb, validateVideoAndChannel } from '../video-scheduler-helpers'
import { PublishConfigurationError } from '../types'
import type { D1Database } from '@/seed/db/client'

/** Route each prepared statement to the row its SQL names. */
function stubDb(rows: { video?: unknown; channel?: unknown }): D1Database {
  return {
    prepare: (sql: string) => ({
      bind: () => ({ first: async () => (sql.includes('videos') ? rows.video : rows.channel) }),
      all: async () => ({ results: [] }),
      run: async () => ({ success: true, meta: { changes: 0 } }),
      raw: async () => [],
      first: async () => (sql.includes('videos') ? rows.video : rows.channel),
    }),
  } as unknown as D1Database
}

const VIDEO = { id: 'vid-1', user_id: 'user-1' }
const CHANNEL = { id: 'chan-1', user_id: 'user-1', tenant_id: null, provider: 'youtube' }

describe('resolvePublishDb', () => {
  it('returns the injected database verbatim', async () => {
    const db = stubDb({})
    expect(await resolvePublishDb(db)).toBe(db)
  })
})

describe('validateVideoAndChannel', () => {
  it('accepts a video and channel owned by the same user', async () => {
    const { channel } = await validateVideoAndChannel(stubDb({ video: VIDEO, channel: CHANNEL }), 'vid-1', 'chan-1', 'user-1')
    expect(channel.id).toBe('chan-1')
  })

  it('rejects a missing video with VIDEO_NOT_FOUND', async () => {
    await expect(validateVideoAndChannel(stubDb({ video: null, channel: CHANNEL }), 'vid-1', 'chan-1', 'user-1'))
      .rejects.toThrow(PublishConfigurationError)
    await expect(validateVideoAndChannel(stubDb({ video: null }), 'vid-1', 'chan-1', 'user-1'))
      .rejects.toMatchObject({ code: 'VIDEO_NOT_FOUND' })
  })

  it('rejects a video owned by another user with FORBIDDEN', async () => {
    await expect(validateVideoAndChannel(stubDb({ video: VIDEO, channel: CHANNEL }), 'vid-1', 'chan-1', 'user-2'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a missing channel with CHANNEL_NOT_FOUND', async () => {
    await expect(validateVideoAndChannel(stubDb({ video: VIDEO, channel: null }), 'vid-1', 'chan-1', 'user-1'))
      .rejects.toMatchObject({ code: 'CHANNEL_NOT_FOUND' })
  })

  it('rejects a channel owned by another user', async () => {
    const foreign = { ...CHANNEL, user_id: 'user-9', tenant_id: null }
    await expect(validateVideoAndChannel(stubDb({ video: VIDEO, channel: foreign }), 'vid-1', 'chan-1', 'user-1'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('accepts a channel that the caller tenant owns', async () => {
    const tenantOwned = { ...CHANNEL, user_id: null, tenant_id: 'user-1' }
    const { channel } = await validateVideoAndChannel(stubDb({ video: VIDEO, channel: tenantOwned }), 'vid-1', 'chan-1', 'user-1')
    expect(channel.tenant_id).toBe('user-1')
  })

  it('rejects a channel owned by a different tenant', async () => {
    const otherTenant = { ...CHANNEL, user_id: null, tenant_id: 'tenant-9' }
    await expect(validateVideoAndChannel(stubDb({ video: VIDEO, channel: otherTenant }), 'vid-1', 'chan-1', 'user-1'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('does not fall back to the ambient binding when a db is injected', async () => {
    const getD1 = vi.fn()
    expect(await resolvePublishDb(stubDb({}))).toBeDefined()
    expect(getD1).not.toHaveBeenCalled()
  })
})
