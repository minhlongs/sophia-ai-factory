/**
 * Unit tests for agent task checkpoint save/load.
 * Tests the checkpoint module in isolation with a mocked D1 client.
 *
 * @module tests/tree/sop/multi-agent-checkpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveCheckpoint, loadCheckpoint } from '../multi-agent-coordinator-checkpoint'

// ---------------------------------------------------------------------------
// D1 mock factory
// ---------------------------------------------------------------------------

function makeD1Mock(overrides?: {
  runResult?: unknown
  firstResult?: unknown
}) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue(overrides?.runResult ?? { success: true }),
    first: vi.fn().mockResolvedValue(overrides?.firstResult ?? null),
  }
  const db = {
    prepare: vi.fn().mockReturnValue(stmt),
  }
  return { db, stmt }
}

vi.mock('@/seed/db/client', () => ({
  getD1Raw: vi.fn(),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/seed/utils/to-error', () => ({
  getErrorMessage: (err: unknown) =>
    err instanceof Error ? err.message : String(err),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getD1RawMock() {
  const { getD1Raw } = await import('@/seed/db/client')
  return getD1Raw as ReturnType<typeof vi.fn>
}

// ---------------------------------------------------------------------------
// saveCheckpoint
// ---------------------------------------------------------------------------

describe('saveCheckpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists checkpoint JSON for a running task', async () => {
    const { db, stmt } = makeD1Mock()
    const mock = await getD1RawMock()
    mock.mockResolvedValue(db)

    const checkpoint = { step: 3, partialOutput: { lines: 12 } }
    await saveCheckpoint('task-abc', checkpoint)

    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining('SET checkpoint_json = ?'),
    )
    expect(stmt.bind).toHaveBeenCalledWith(
      JSON.stringify(checkpoint),
      'task-abc',
    )
    expect(stmt.run).toHaveBeenCalledOnce()
  })

  it('throws if checkpoint exceeds 64KB', async () => {
    // Build a payload that serialises to > 65536 bytes
    const bigValue = 'x'.repeat(66000)
    await expect(saveCheckpoint('task-xyz', { data: bigValue })).rejects.toThrow(
      'Checkpoint too large',
    )
  })

  it('propagates D1 errors', async () => {
    const { db, stmt } = makeD1Mock()
    stmt.run.mockRejectedValue(new Error('D1 write error'))
    const mock = await getD1RawMock()
    mock.mockResolvedValue(db)

    await expect(saveCheckpoint('task-fail', { step: 1 })).rejects.toThrow('D1 write error')
  })
})

// ---------------------------------------------------------------------------
// loadCheckpoint
// ---------------------------------------------------------------------------

describe('loadCheckpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns parsed checkpoint when one exists', async () => {
    const stored = { step: 5, state: 'partial' }
    const { db } = makeD1Mock({ firstResult: { checkpoint_json: JSON.stringify(stored) } })
    const mock = await getD1RawMock()
    mock.mockResolvedValue(db)

    const result = await loadCheckpoint('task-abc')
    expect(result).toEqual(stored)
  })

  it('returns null when no checkpoint row exists', async () => {
    const { db } = makeD1Mock({ firstResult: null })
    const mock = await getD1RawMock()
    mock.mockResolvedValue(db)

    const result = await loadCheckpoint('task-missing')
    expect(result).toBeNull()
  })

  it('returns null when checkpoint_json is null', async () => {
    const { db } = makeD1Mock({ firstResult: { checkpoint_json: null } })
    const mock = await getD1RawMock()
    mock.mockResolvedValue(db)

    const result = await loadCheckpoint('task-no-checkpoint')
    expect(result).toBeNull()
  })

  it('returns null and logs on malformed JSON (does not throw)', async () => {
    const { db } = makeD1Mock({ firstResult: { checkpoint_json: '{bad json' } })
    const mock = await getD1RawMock()
    mock.mockResolvedValue(db)

    const { logger } = await import('@/seed/utils/logger-utility')

    const result = await loadCheckpoint('task-bad-json')
    expect(result).toBeNull()
    expect(logger.error).toHaveBeenCalledWith(
      'multi-agent: checkpoint parse error',
      expect.objectContaining({ taskId: 'task-bad-json' }),
    )
  })

  it('propagates D1 query errors', async () => {
    const { db, stmt } = makeD1Mock()
    stmt.first.mockRejectedValue(new Error('D1 read error'))
    const mock = await getD1RawMock()
    mock.mockResolvedValue(db)

    await expect(loadCheckpoint('task-fail')).rejects.toThrow('D1 read error')
  })
})

// ---------------------------------------------------------------------------
// clear on complete — behaviour verification via coordinator
// ---------------------------------------------------------------------------

describe('completeTask clears checkpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UPDATE statement includes checkpoint_json = NULL', async () => {
    // The coordinator's completeTask must include checkpoint_json = NULL in its UPDATE.
    // We verify by inspecting the SQL passed to db.prepare().
    const sessionId = 'session-111'
    const taskId = 'task-111'

    const stmts: string[] = []
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockImplementation(async () => ({ session_id: sessionId })),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }
    const db = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        stmts.push(sql)
        return stmt
      }),
      batch: vi.fn().mockResolvedValue([]),
    }

    const mock = await getD1RawMock()
    mock.mockResolvedValue(db)

    const { completeTask } = await import('../multi-agent-coordinator')
    await completeTask(taskId, { result: 'ok' })

    const updateStmt = stmts.find((s) => s.includes('checkpoint_json'))
    expect(updateStmt).toBeDefined()
    expect(updateStmt).toContain('checkpoint_json = NULL')
  })
})
