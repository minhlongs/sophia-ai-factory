import { describe, it, expect, vi } from 'vitest'
import { resolveOrgId } from './resolve-org-id'

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
