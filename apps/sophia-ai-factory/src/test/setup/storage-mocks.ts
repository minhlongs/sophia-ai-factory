/**
 * D1 / R2 / KV storage mocks for Vitest environment
 */

import { vi } from 'vitest';

export function createD1Mock() {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockImplementation((..._vals: unknown[]) => ({
        first: async () => null,
        all: async () => ({ results: [], meta: { changes: 0, duration: 1 } }),
        run: async () => ({ success: true, meta: { changes: 0, duration: 1 } }),
      })),
      first: async () => null as unknown as Record<string, unknown>,
      all: async () => ({ results: [], meta: { changes: 0, duration: 1 } }),
      run: async () => ({ success: true, meta: { changes: 0, duration: 1 } }),
    }),
    batch: async (_stmts: unknown[]) => {},
    exec: async (_sql: string) => ({ results: [], meta: { changes: 0 } }),
    dump: async () => ({ data: '' }),
    transaction: { statements: [] },
  };
}

export const d1Mock = createD1Mock();

export const r2Mock = {
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue({}),
  list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
  head: vi.fn().mockResolvedValue(null),
};

export const kvMock = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
};

(globalThis as Record<string, unknown>).__env = {
  KV: kvMock,
  EXPERIMENT_KV: kvMock,
  DB: d1Mock,
  R2: r2Mock,
  NEXT_INC_CACHE_R2_BUCKET: r2Mock,
};

// Polyfill Web Storage for Node 26+ jsdom environments where window.localStorage is undefined or incomplete
if (
  typeof window !== 'undefined' &&
  (!window.localStorage || typeof window.localStorage.clear !== 'function')
) {
  class MemoryStorage implements Storage {
    private _data = new Map<string, string>();
    get length(): number {
      return this._data.size;
    }
    clear(): void {
      this._data.clear();
    }
    getItem(key: string): string | null {
      return this._data.has(key) ? this._data.get(key)! : null;
    }
    key(index: number): string | null {
      return Array.from(this._data.keys())[index] ?? null;
    }
    removeItem(key: string): void {
      this._data.delete(key);
    }
    setItem(key: string, value: string): void {
      this._data.set(key, String(value));
    }
  }
  const storage = new MemoryStorage();
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}

