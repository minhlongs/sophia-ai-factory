import { describe, it, expect, vi } from 'vitest'
import { resolveOrgId, resolveOrgOwnerUserId } from './resolve-org-id'

function mockD1(row: { org_id: string } | null): D1Database {
  return {
    prepare: vi.fn().mockReturnValue({
      bind:  vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(row),
      }),
    }),
  } as unknown as D1Database
}

function throwingD1(): D1Database {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockRejectedValue(new Error('D1 down')),
      }),
    }),
  } as unknown as D1Database
}

describe('resolveOrgId', () => {
  it('returns org_id when user is in org_members', async () => {
    const db = mockD1({ org_id: 'org-42' })
    await expect(resolveOrgId('user-1', db)).resolves.toBe('org-42')
  })

  it('returns null when user is not in org_members', async () => {
    const db = mockD1(null)
    await expect(resolveOrgId('user-1', db)).resolves.toBeNull()
  })

  it('returns null on empty/missing userId without hitting D1', async () => {
    const db = mockD1({ org_id: 'never-read' })
    await expect(resolveOrgId('', db)).resolves.toBeNull()
    await expect(resolveOrgId(null, db)).resolves.toBeNull()
    await expect(resolveOrgId(undefined, db)).resolves.toBeNull()
    expect(db.prepare).not.toHaveBeenCalled()
  })

  it('returns null when D1 throws', async () => {
    await expect(resolveOrgId('user-1', throwingD1())).resolves.toBeNull()
  })

  it('returns null when no D1 binding is available', async () => {
    await expect(resolveOrgId('user-1', null)).resolves.toBeNull()
  })
})

describe('resolveOrgOwnerUserId', () => {
  function mockOwnerD1(row: { user_id: string } | null): D1Database {
    return {
      prepare: vi.fn().mockReturnValue({
        bind:  vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(row),
        }),
      }),
    } as unknown as D1Database
  }

  it('returns earliest member user_id', async () => {
    const db = mockOwnerD1({ user_id: 'user-owner' })
    await expect(resolveOrgOwnerUserId('org-42', db)).resolves.toBe('user-owner')
  })

  it('returns null when org has no members', async () => {
    const db = mockOwnerD1(null)
    await expect(resolveOrgOwnerUserId('org-empty', db)).resolves.toBeNull()
  })

  it('returns null on empty/missing orgId without hitting D1', async () => {
    const db = mockOwnerD1({ user_id: 'never-read' })
    await expect(resolveOrgOwnerUserId('', db)).resolves.toBeNull()
    await expect(resolveOrgOwnerUserId(null, db)).resolves.toBeNull()
    await expect(resolveOrgOwnerUserId(undefined, db)).resolves.toBeNull()
    expect(db.prepare).not.toHaveBeenCalled()
  })

  it('returns null when D1 throws', async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockRejectedValue(new Error('D1 down')),
        }),
      }),
    } as unknown as D1Database
    await expect(resolveOrgOwnerUserId('org-1', db)).resolves.toBeNull()
  })

  it('query orders by created_at ASC + LIMIT 1 (earliest joiner is owner)', async () => {
    const first = vi.fn().mockResolvedValue({ user_id: 'u-1' })
    const bind  = vi.fn().mockReturnValue({ first })
    const prepare = vi.fn().mockReturnValue({ bind })
    const db = { prepare } as unknown as D1Database

    await resolveOrgOwnerUserId('org-1', db)

    const sql = prepare.mock.calls[0][0] as string
    expect(sql).toMatch(/ORDER BY created_at ASC/i)
    expect(sql).toMatch(/LIMIT\s+1/i)
  })
})
