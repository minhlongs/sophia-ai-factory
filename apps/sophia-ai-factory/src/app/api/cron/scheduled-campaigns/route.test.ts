import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  verifyCronAuth: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
  startCronCheckIn: vi.fn(() => ({})),
  finishCronCheckIn: vi.fn(),
  failCronCheckIn: vi.fn(),
}))

vi.mock('@/seed/db/client', () => ({
  createServerClient: mocks.createServerClient,
}))

vi.mock('@/seed/security/cron-auth', () => ({
  verifyCronAuth: mocks.verifyCronAuth,
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: mocks.loggerInfo,
    error: mocks.loggerError,
  },
}))

vi.mock('@/seed/utils/to-error', () => ({
  toError: (value: unknown) => value instanceof Error ? value : new Error(String(value)),
}))

vi.mock('@/land/cron/run-tracker', () => ({
  recordCronRun: vi.fn().mockResolvedValue(undefined),
  wasRecentlyRun: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/seed/observability/cron-check-in', () => ({
  startCronCheckIn: mocks.startCronCheckIn,
  finishCronCheckIn: mocks.finishCronCheckIn,
  failCronCheckIn: mocks.failCronCheckIn,
}))

import { GET } from './route'

interface ScheduleRow {
  id: string
  user_id: string
  topic: string
  template_script: string | null
  interval_days: number | null
  next_run_date: string
  is_active: number
}

function makeRequest(): NextRequest {
  return new NextRequest('https://sophia.agencyos.network/api/cron/scheduled-campaigns', {
    headers: { authorization: 'Bearer test-secret' },
  })
}

function makeDb(schedules: ScheduleRow[], fetchError: { message: string } | null = null) {
  const calls = {
    scheduleEq: [] as Array<[string, unknown]>,
    scheduleLte: [] as Array<[string, unknown]>,
    campaignInsert: [] as Record<string, unknown>[],
    scheduleUpdate: [] as Record<string, unknown>[],
    updateEq: [] as Array<[string, unknown]>,
  }

  const db = {
    from: vi.fn((table: string) => {
      if (table === 'scheduled_campaigns') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, value: unknown) => {
              calls.scheduleEq.push([col, value])
              return {
                lte: vi.fn(async (lteCol: string, lteValue: unknown) => {
                  calls.scheduleLte.push([lteCol, lteValue])
                  return { data: schedules, error: fetchError }
                }),
              }
            }),
          })),
          update: vi.fn((payload: Record<string, unknown>) => {
            calls.scheduleUpdate.push(payload)
            return {
              eq: vi.fn(async (col: string, value: unknown) => {
                calls.updateEq.push([col, value])
                return { data: null, error: null }
              }),
            }
          }),
        }
      }

      if (table === 'campaigns') {
        return {
          insert: vi.fn(async (payload: Record<string, unknown>) => {
            calls.campaignInsert.push(payload)
            return { data: null, error: null }
          }),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  }

  return { db, calls }
}

describe('GET /api/cron/scheduled-campaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyCronAuth.mockReturnValue(null)
  })

  afterEach(() => {
    delete (globalThis as { __env?: unknown }).__env
  })

  it('creates queued campaigns using the current campaigns schema', async () => {
    const { db, calls } = makeDb([
      {
        id: 'sched-1',
        user_id: 'user-1',
        topic: 'Weekly media plan',
        template_script: 'Intro script',
        interval_days: 7,
        next_run_date: '2026-06-05',
        is_active: 1,
      },
    ])
    mocks.createServerClient.mockReturnValue(db)

    const res = await GET(makeRequest())
    const body = await res.json() as { success: boolean; created: number; total: number }

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ success: true, created: 1, total: 1 })
    expect(calls.scheduleEq).toEqual([['is_active', 1]])
    expect(calls.scheduleLte[0][0]).toBe('next_run_date')

    expect(calls.campaignInsert).toHaveLength(1)
    expect(calls.campaignInsert[0]).toMatchObject({
      user_id: 'user-1',
      title: expect.stringContaining('Weekly media plan'),
      topic: 'Weekly media plan',
      audience: null,
      status: 'queued',
      progress: 0,
    })
    expect(calls.campaignInsert[0]).not.toHaveProperty('script')
    expect(calls.campaignInsert[0].script_content).toEqual({
      source: 'scheduled_campaign',
      schedule_id: 'sched-1',
      script: 'Intro script',
    })
    expect(calls.scheduleUpdate[0]).toHaveProperty('last_run_date')
    expect(calls.scheduleUpdate[0]).toHaveProperty('next_run_date')
    expect(calls.scheduleUpdate[0]).toHaveProperty('updated_at')
    expect(calls.updateEq).toEqual([['id', 'sched-1']])
  })

  it('gracefully skips when scheduled_campaigns table is missing', async () => {
    const { db, calls } = makeDb([], { message: 'no such table: scheduled_campaigns' })
    mocks.createServerClient.mockReturnValue(db)

    const res = await GET(makeRequest())
    const body = await res.json() as { success: boolean; created: number; message: string }

    expect(res.status).toBe(200)
    expect(body).toEqual({
      success: true,
      created: 0,
      message: 'Table not yet available',
    })
    expect(calls.campaignInsert).toHaveLength(0)
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      '[scheduled-campaigns] Table not yet created — skipping',
    )
  })
})
