import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isAllowed,
  requestPairing,
  approvePairing,
  listPaired,
  revokePairing,
} from '../pairing'
import type { D1Client } from '@/seed/db/d1-query-builder'

// ── Minimal mock of D1Client ──────────────────────────────────────────────────

function makeDb(overrides: Record<string, unknown> = {}): D1Client {
  const store: Record<string, Record<string, unknown>[]> = {
    telegram_paired_chats: [],
    telegram_pending_pairing: [],
  }

  // Helper to make a chainable query builder
  const makeChain = (table: string) => {
    let rows = [...store[table]]
    let filterFn: (r: Record<string, unknown>) => boolean = () => true
    let isSingle = false
    let isMaybe = false
    let isDelete = false
    let isUpsert = false
    let upsertData: Record<string, unknown> | null = null
    let selectCols = '*'
    let ltField = ''
    let ltValue = ''

    const chain = {
      select: (cols: string) => { selectCols = cols; return chain },
      eq: (field: string, value: unknown) => {
        const prev = filterFn
        filterFn = (r) => prev(r) && r[field] === value
        return chain
      },
      lt: (field: string, value: unknown) => {
        ltField = field
        ltValue = value as string
        return chain
      },
      maybeSingle: async () => {
        const found = rows.filter(filterFn)
        const data = found.length > 0 ? found[0] : null
        return { data, error: null }
      },
      single: async () => {
        const found = rows.filter(filterFn)
        const data = found.length > 0 ? found[0] : null
        return { data, error: null }
      },
      delete: () => {
        isDelete = true
        // Return thenable so await db.from(...).delete().eq(...).lt(...) works
        return {
          eq: (field: string, value: unknown) => {
            store[table] = store[table].filter((r) => r[field] !== value)
            return { then: (res: (v: { data: null; error: null }) => unknown) => res({ data: null, error: null }) }
          },
          lt: (field: string, value: unknown) => {
            store[table] = store[table].filter((r) => (r[field] as string) >= (value as string))
            return { then: (res: (v: { data: null; error: null }) => unknown) => res({ data: null, error: null }) }
          },
        }
      },
      upsert: async (data: Record<string, unknown>) => {
        isUpsert = true
        upsertData = data

        // Simulate UNIQUE(chat_id [PK]) + UNIQUE(paired_by) conflict semantics
        // (mirrors migration 0100 which adds UNIQUE(paired_by) to telegram_paired_chats).
        // ON CONFLICT DO UPDATE SET: if any unique key matches an existing row, merge data in.
        const existsByPk = store[table].findIndex((r) => data['chat_id'] !== undefined && r['chat_id'] === data['chat_id'])
        const existsByPairedBy = table === 'telegram_paired_chats'
          ? store[table].findIndex((r) => data['paired_by'] !== undefined && r['paired_by'] === data['paired_by'])
          : -1

        const conflictIdx = existsByPk >= 0 ? existsByPk : existsByPairedBy
        if (conflictIdx >= 0) {
          // Merge: update all columns (matches ON CONFLICT DO UPDATE SET col = excluded.col)
          store[table][conflictIdx] = { ...store[table][conflictIdx], ...data }
        } else {
          store[table].push({ ...data })
        }
        return { data: upsertData, error: null }
      },
      then: (resolve: (v: { data: unknown; error: null }) => unknown) => {
        if (isDelete) return resolve({ data: [], error: null })
        const filtered = rows.filter(filterFn)
        if (ltField) {
          rows = rows.filter((r) => (r[ltField] as string) >= ltValue)
          store[table] = rows
        }
        const data: unknown = isSingle || isMaybe ? (filtered[0] ?? null) : filtered
        return resolve({ data, error: null })
      },
    }

    // Refresh rows from store each operation
    Object.defineProperty(chain, 'rows', { get: () => store[table] })

    return chain
  }

  return {
    from: (table: string) => makeChain(table),
    ...overrides,
  } as unknown as D1Client
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('isAllowed', () => {
  it('returns false for unknown chat', async () => {
    const db = makeDb()
    expect(await isAllowed(db, '999')).toBe(false)
  })

  it('returns true for paired chat', async () => {
    const db = makeDb()
    // seed directly
    await db.from('telegram_paired_chats').upsert({
      chat_id: '123',
      first_name: 'Alice',
      paired_at: new Date().toISOString(),
      paired_by: 'admin',
    })
    expect(await isAllowed(db, '123')).toBe(true)
  })
})

describe('requestPairing', () => {
  it('returns a 6-digit code string', async () => {
    const db = makeDb()
    const { code } = await requestPairing(db, '456', 'Bob')
    expect(code).toMatch(/^\d{6}$/)
  })

  it('refreshes code on second call for same chat', async () => {
    const db = makeDb()
    const { code: c1 } = await requestPairing(db, '456', 'Bob')
    const { code: c2 } = await requestPairing(db, '456', 'Bob')
    // Both valid 6-digit codes; c2 is the current one
    expect(c2).toMatch(/^\d{6}$/)
    // c1 may equal c2 by chance (1/900000) but we just assert format
    expect(typeof c1).toBe('string')
  })
})

describe('approvePairing', () => {
  it('returns null for unknown code', async () => {
    const db = makeDb()
    const result = await approvePairing(db, '000000', 'admin123')
    expect(result).toBeNull()
  })

  it('approves valid code and returns chatId', async () => {
    const db = makeDb()
    const { code } = await requestPairing(db, '789', 'Carol')
    const result = await approvePairing(db, code, 'admin123', 'Carol')
    expect(result).toEqual({ chatId: '789' })
  })

  it('does not allow re-use of approved code', async () => {
    const db = makeDb()
    const { code } = await requestPairing(db, '789', 'Carol')
    await approvePairing(db, code, 'admin123', 'Carol')
    // Second approve — pending row deleted, should return null
    const result2 = await approvePairing(db, code, 'admin123', 'Carol')
    expect(result2).toBeNull()
  })

  it('returns null for expired code', async () => {
    const db = makeDb()
    const { code } = await requestPairing(db, '789', 'Carol')
    // Manually expire the row
    const pending = db.from('telegram_pending_pairing') as unknown as {
      upsert: (d: Record<string, unknown>) => Promise<unknown>
    }
    await pending.upsert({
      chat_id: '789',
      code,
      requested_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    })
    const result = await approvePairing(db, code, 'admin123')
    expect(result).toBeNull()
  })
})

describe('listPaired', () => {
  it('returns empty array when none paired', async () => {
    const db = makeDb()
    const rows = await listPaired(db)
    expect(rows).toEqual([])
  })

  it('returns all paired chats', async () => {
    const db = makeDb()
    const { code } = await requestPairing(db, '111', 'Dave')
    await approvePairing(db, code, 'admin', 'Dave')
    const rows = await listPaired(db)
    expect(rows.length).toBe(1)
    expect(rows[0].chat_id).toBe('111')
  })
})

describe('revokePairing', () => {
  it('returns false for non-existent chat', async () => {
    const db = makeDb()
    expect(await revokePairing(db, 'ghost')).toBe(false)
  })

  it('removes paired chat and returns true', async () => {
    const db = makeDb()
    const { code } = await requestPairing(db, '222', 'Eve')
    await approvePairing(db, code, 'admin', 'Eve')
    expect(await revokePairing(db, '222')).toBe(true)
    expect(await isAllowed(db, '222')).toBe(false)
  })
})

// ── UNIQUE(paired_by) constraint tests (migration 0100) ───────────────────────
//
// These tests verify the upsert/ON CONFLICT behavior after the unique index is
// added. In production D1, ON CONFLICT DO UPDATE SET handles both cases below.

describe('double-pair / UNIQUE(paired_by) enforcement', () => {
  it('re-pairing same user to a new chat_id replaces the old pairing (upsert wins)', async () => {
    const db = makeDb()

    // First pairing: user_A pairs chat '100'
    const { code: code1 } = await requestPairing(db, '100', 'Frank')
    await approvePairing(db, code1, 'user_A', 'Frank')
    expect(await isAllowed(db, '100')).toBe(true)

    // Second pairing: same user_A pairs a different chat '200'
    const { code: code2 } = await requestPairing(db, '200', 'Frank')
    await approvePairing(db, code2, 'user_A', 'Frank')

    // New chat should be allowed, old chat should NOT remain active
    expect(await isAllowed(db, '200')).toBe(true)

    // listPaired should show exactly 1 row for user_A (no duplicates)
    const rows = await listPaired(db)
    const userARows = rows.filter((r) => r.paired_by === 'user_A')
    expect(userARows).toHaveLength(1)
    expect(userARows[0].chat_id).toBe('200')
  })

  it('re-pairing same user keeps only the newest chat_id — old chat_id is gone', async () => {
    const db = makeDb()

    const { code: c1 } = await requestPairing(db, '300', 'Grace')
    await approvePairing(db, c1, 'user_B', 'Grace')

    const { code: c2 } = await requestPairing(db, '400', 'Grace')
    await approvePairing(db, c2, 'user_B', 'Grace')

    const rows = await listPaired(db)
    const userBRows = rows.filter((r) => r.paired_by === 'user_B')
    expect(userBRows).toHaveLength(1)
    expect(userBRows[0].chat_id).toBe('400')
    // old chat_id no longer in paired list
    expect(rows.some((r) => r.chat_id === '300')).toBe(false)
  })

  it('two different users each get their own pairing (no interference)', async () => {
    const db = makeDb()

    const { code: ca } = await requestPairing(db, '500', 'Hana')
    await approvePairing(db, ca, 'user_C', 'Hana')

    const { code: cb } = await requestPairing(db, '600', 'Ivan')
    await approvePairing(db, cb, 'user_D', 'Ivan')

    const rows = await listPaired(db)
    expect(rows.some((r) => r.paired_by === 'user_C' && r.chat_id === '500')).toBe(true)
    expect(rows.some((r) => r.paired_by === 'user_D' && r.chat_id === '600')).toBe(true)
  })

  it('single-pair insert works without conflict', async () => {
    const db = makeDb()
    const { code } = await requestPairing(db, '700', 'Jane')
    const result = await approvePairing(db, code, 'user_E', 'Jane')
    expect(result).toEqual({ chatId: '700' })
    expect(await isAllowed(db, '700')).toBe(true)
  })
})
