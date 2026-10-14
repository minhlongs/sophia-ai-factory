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
