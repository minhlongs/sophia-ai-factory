/**
 * Step B7a — schema contract tests for the Creative Economy OS.
 *
 * Covers primitive schemas, enum schemas, entity round-trips, and the
 * event envelope schema. Pure contracts — no I/O, no mocks.
 *
 * @module seed/types/creative-economy/__tests__/schema
 */

import { describe, it, expect } from 'vitest'
import {
  ALL_CREATIVE_ECONOMY_EVENT_KINDS,
  CreativeEconomyEventKind,
  isCreativeEconomyEvent,
} from '@/seed/types/creative-economy/events'
import {
  Cents,
  Channel,
  CreativeEconomyEventSchema,
  CreativeMissionStatusSchema,
  NonEmptyString,
  parseEvent,
  parseMission,
  ProvenanceActionSchema,
  RevenueEventSchema,
  UnixMs,
} from '@/seed/types/creative-economy/schema'
import type { CreativeEconomyEvent } from '@/seed/types/creative-economy/events'

// ─── Primitive schemas ───────────────────────────────────────────────────────

describe('primitive schemas', () => {
  it('NonEmptyString rejects empty and trims', () => {
    expect(NonEmptyString.safeParse('').success).toBe(false)
    expect(NonEmptyString.safeParse('   ').success).toBe(false)
    expect(NonEmptyString.safeParse('  hi  ').data).toBe('hi')
  })

  it('Cents rejects negatives and floats', () => {
    expect(Cents.safeParse(-1).success).toBe(false)
    expect(Cents.safeParse(1.5).success).toBe(false)
    expect(Cents.safeParse(0).data).toBe(0)
    expect(Cents.safeParse(100).data).toBe(100)
  })

  it('UnixMs rejects negatives', () => {
    expect(UnixMs.safeParse(-1).success).toBe(false)
    expect(UnixMs.safeParse(0).data).toBe(0)
  })

  it('Channel enforces length', () => {
    expect(Channel.safeParse('a'.repeat(65)).success).toBe(false)
    expect(Channel.safeParse('youtube').data).toBe('youtube')
  })
})

// ─── Enum schemas ────────────────────────────────────────────────────────────

describe('enum schemas', () => {
  it('CreativeMissionStatusSchema has 9 canonical states', () => {
    expect(CreativeMissionStatusSchema.options).toHaveLength(9)
    expect(CreativeMissionStatusSchema.options).toEqual([
      'draft',
      'planned',
      'approval_required',
      'running',
      'paused',
      'review',
      'completed',
      'learning',
      'iterating',
    ])
  })

  it('ProvenanceActionSchema has 8 canonical actions', () => {
    expect(ProvenanceActionSchema.options).toEqual([
      'created',
      'generated',
      'edited',
      'approved',
      'rejected',
      'published',
      'derived',
      'archived',
    ])
  })
})

// ─── Entity schema round-trip ────────────────────────────────────────────────

describe('MissionSchema', () => {
  const validMission = {
    id: 'm_1', workspaceId: 'ws_1', creatorId: 'u_1', title: 'Launch video',
    objective: 'Explain the product', audience: 'creators', geography: 'global',
    timeframeStart: 1_000_000, timeframeEnd: 2_000_000, budgetCents: 5_000,
    spentCents: 0, autonomyLevel: 3, channels: ['youtube'],
    monetizationGoals: ['revenue'], constraints: {}, successMetrics: { views: 1000 },
    status: 'running', currentPhase: 'production', createdAt: 1_000_000,
    updatedAt: 1_000_000,
  }

  it('accepts a well-formed mission and coerces autonomyLevel', () => {
    const result = parseMission(validMission)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.autonomyLevel).toBe(3)
  })

  it('rejects autonomyLevel out of range', () => {
    expect(parseMission({ ...validMission, autonomyLevel: 5 }).success).toBe(false)
    expect(parseMission({ ...validMission, autonomyLevel: -1 }).success).toBe(false)
  })

  it('rejects missing required fields and empty channels', () => {
    const { id, ...missing } = validMission
    expect(parseMission(missing).success).toBe(false)
    expect(parseMission({ ...validMission, channels: [] }).success).toBe(false)
  })
})

describe('RevenueEventSchema', () => {
  const valid = {
    id: 'rev_1',
    workspaceId: 'ws_1',
    channel: 'youtube',
    type: 'sale',
    amountCents: 999,
    currency: 'USD',
    metadata: {},
    occurredAt: 1_000_000,
    recordedAt: 1_000_000,
  }

  it('accepts a well-formed revenue event', () => {
    expect(RevenueEventSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects unknown type', () => {
    expect(RevenueEventSchema.safeParse({ ...valid, type: 'crypto' }).success).toBe(false)
  })

  it('allows optional assetId and projectId', () => {
    expect(
      RevenueEventSchema.safeParse({ ...valid, assetId: 'a_1', projectId: 'p_1' }).success,
    ).toBe(true)
  })
})

// ─── Event schema ────────────────────────────────────────────────────────────

describe('CreativeEconomyEventKind table', () => {
  it('exports exactly 13 unique non-empty kinds', () => {
    expect(Object.keys(CreativeEconomyEventKind)).toHaveLength(13)
    expect(ALL_CREATIVE_ECONOMY_EVENT_KINDS).toHaveLength(13)
    expect(new Set(ALL_CREATIVE_ECONOMY_EVENT_KINDS).size).toBe(13)
    for (const kind of ALL_CREATIVE_ECONOMY_EVENT_KINDS) {
      expect(typeof kind).toBe('string')
      expect((kind as string).length).toBeGreaterThan(0)
    }
  })
})

describe('CreativeEconomyEventSchema', () => {
  it('parses every canonical kind with a free-form payload', () => {
    for (const kind of ALL_CREATIVE_ECONOMY_EVENT_KINDS) {
      const result = parseEvent({ kind, payload: { x: 1 }, timestamp: 1_000_000 })
      expect(result.success).toBe(true)
    }
  })

  it('rejects an unknown kind', () => {
    expect(parseEvent({ kind: 'not.a.real.kind', payload: {}, timestamp: 1 }).success).toBe(false)
  })

  it('rejects a missing timestamp', () => {
    expect(
      parseEvent({ kind: CreativeEconomyEventKind.MISSION_CREATED, payload: {} }).success,
    ).toBe(false)
  })

  it('rejects a non-object', () => {
    expect(parseEvent(null).success).toBe(false)
    expect(parseEvent(42).success).toBe(false)
  })

  it('isCreativeEconomyEvent narrows the union', () => {
    const candidate: unknown = {
      kind: CreativeEconomyEventKind.ASSET_PRODUCED,
      payload: {},
      timestamp: 1,
    }
    expect(isCreativeEconomyEvent(candidate)).toBe(true)
    if (isCreativeEconomyEvent(candidate)) {
      const _e: CreativeEconomyEvent = candidate
      expect(_e.kind).toBe('asset.produced')
    }
  })
})