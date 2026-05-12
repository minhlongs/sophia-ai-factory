import { describe, it, expect, beforeEach } from 'vitest'
import { generatePairingToken, consumePairingToken } from '../pairing-token-service'
import type { D1Client } from '@/seed/db/d1-query-builder'

// ── Minimal D1Client mock ─────────────────────────────────────────────────────

function makeDb(): D1Client {
  const store: Record<string, Record<string, unknown>> = {}

  return {
    from: (table: string) => {
      const tableStore = store

      let selectResult: Record<string, unknown> | null = null
      let filterField = ''
      let filterValue = ''

      const chain = {
        select: (_cols: string) => chain,
        eq: (field: string, value: unknown) => {
          filterField = field
          filterValue = value as string
          return chain
        },
        maybeSingle: async () => {
          const key = `${table}:${filterField}:${filterValue}`
          const directKey = Object.keys(tableStore).find(
            (k) => k.startsWith(`${table}:${filterField}:`) && tableStore[k][filterField] === filterValue
          )
          const data = directKey ? tableStore[directKey] : null
          selectResult = data
          return { data, error: null }
        },
        upsert: async (data: Record<string, unknown>) => {
          // Use token or user_id as key
          const keyField = 'token' in data ? 'token' : 'user_id'
          const keyVal = data[keyField] as string
          const storeKey = `${table}:${keyField}:${keyVal}`
          tableStore[storeKey] = { ...data }
          return { data, error: null }
        },
      }

      return chain as unknown as ReturnType<D1Client['from']>
    },
  } as unknown as D1Client
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('generatePairingToken', () => {
  it('returns a 32-char hex string', async () => {
    const db = makeDb()
    const token = await generatePairingToken(db, 'user-123')
    expect(token).toMatch(/^[0-9a-f]{32}$/)
  })

  it('generates unique tokens per call', async () => {
    const db = makeDb()
    const t1 = await generatePairingToken(db, 'user-123')
    const t2 = await generatePairingToken(db, 'user-123')
    expect(t1).not.toBe(t2)
  })
})

describe('consumePairingToken', () => {
  it('returns null for unknown token', async () => {
    const db = makeDb()
    const result = await consumePairingToken(db, 'deadbeef00000000deadbeef00000000')
    expect(result).toBeNull()
  })

  it('returns userId for valid token', async () => {
    const db = makeDb()
    const token = await generatePairingToken(db, 'user-abc')
    const result = await consumePairingToken(db, token)
    expect(result).toEqual({ userId: 'user-abc' })
  })

  it('returns null for already-used token', async () => {
    const db = makeDb()
    const token = await generatePairingToken(db, 'user-def')
    // First consume succeeds
    await consumePairingToken(db, token)
    // Second consume returns null (used_at is set)
    const result2 = await consumePairingToken(db, token)
    expect(result2).toBeNull()
  })

  it('returns null for expired token', async () => {
    const db = makeDb()
    const token = await generatePairingToken(db, 'user-ghi')

    // Manually expire the token by overwriting expires_at in the store
    // We do this by calling upsert with a past expires_at
    await db.from('telegram_pairing_tokens').upsert({
      token,
      user_id: 'user-ghi',
      created_at: new Date(Date.now() - 7200_000).toISOString(),
      expires_at: new Date(Date.now() - 3600_000).toISOString(),
      used_at: null,
    })

    const result = await consumePairingToken(db, token)
    expect(result).toBeNull()
  })
})
