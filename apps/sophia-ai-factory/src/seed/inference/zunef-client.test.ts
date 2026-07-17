import { describe, it, expect, beforeEach, vi } from 'vitest'

function makeKv() {
  const store = new Map<string, string>()
  const get = vi.fn(async (k: string) => (store.get(k) ?? null) as string | null)
  const put = vi.fn(async (k: string, v: string) => store.set(k, v))
  const del = vi.fn((k: string) => store.delete(k))
  return { store, get, put, del }
}
function inject(name: string, val: unknown) { gKV[name] = val }
const gKV = globalThis as any

describe('kv-storage-ops', () => {
  beforeEach(() => { vi.resetModules(); delete gKV.KV_KV; delete gKV.DB })
  it('roundtrip', async () => {
    const { store, get, put, del } = makeKv()
    gKV.KV_KV = { get, put, delete: del }
    const { storageSet, storageGet } = await import('@/seed/kv/kv-storage-ops')
    await storageSet('k', 'v')
    expect(store.get('k')).toBe('v')
    expect(await storageGet('k')).toBe('v')
  })
  it('null when missing', async () => {
    gKV.KV_KV = { get: vi.fn().mockResolvedValue(null) }
    const { storageGet } = await import('@/seed/kv/kv-storage-ops')
    expect(await storageGet('z')).toBeNull()
  })
  it('delete removes', async () => {
    const { store, get, put, del } = makeKv()
    gKV.KV_KV = { get, put, delete: del }
    const { storageSet, storageGet, storageDelete } = await import('@/seed/kv/kv-storage-ops')
    await storageSet('x', 'v')
    expect(await storageGet('x')).toBe('v')
    await storageDelete('x')
    expect(await storageGet('x')).toBeNull()
    expect(del).toHaveBeenCalledWith('x')
  })
  it('overwrite replaces', async () => {
    const { store, get, put, del } = makeKv()
    gKV.KV_KV = { get, put, delete: del }
    const { storageSet, storageGet } = await import('@/seed/kv/kv-storage-ops')
    await storageSet('k', 'old')
    expect(put).toHaveBeenCalledWith('k', 'old')
    await storageSet('k', 'new')
    expect(await storageGet('k')).toBe('new')
  })
})
