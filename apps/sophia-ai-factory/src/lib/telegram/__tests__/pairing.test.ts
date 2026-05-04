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
        const idx = store[table].findIndex((r) => r[Object.keys(data)[0]] === data[Object.keys(data)[0]])
        if (idx >= 0) {
          store[table][idx] = { ...store[table][idx], ...data }
        } else {
          store[table].push({ ...data })
        }
        // Also handle primary key (chat_id) dedup
        const key = 'chat_id'
        if (data[key] !== undefined) {
          // Remove duplicates keeping last
          const seen = new Set<unknown>()
          store[table] = store[table].reduceRight<Record<string, unknown>[]>((acc, r) => {
            if (!seen.has(r[key])) { seen.add(r[key]); acc.unshift(r) }
            return acc
          }, [])
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
