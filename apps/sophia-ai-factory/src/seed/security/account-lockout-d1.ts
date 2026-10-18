/**
 * D1 database binding and types for account lockout — seed layer.
 */

export interface AccountLockStatus {
  locked: boolean
  lockedUntil?: number
  attempts: number
  /** L3: true when the DB lookup failed — caller should treat as temporarily locked */
  degraded?: boolean
}

export interface UserLockRow {
  failed_login_attempts: number
  locked_until: number | null
}

/**
 * Minimal D1 interface needed for raw prepared statements.
 * Avoids importing D1Client wrapper to keep this layer-pure.
 * Exported so test files can cast mocks to this type.
 */
export interface D1Binding {
  prepare(query: string): {
    bind(...args: unknown[]): {
      run(): Promise<{ meta?: { changes?: number } }>
      first<T>(): Promise<T | null>
    }
  }
}

/**
 * Resolve D1 binding from globalThis (same strategy as better-auth-server).
 */
export function getD1(): D1Binding {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env
  if (env?.DB) return env.DB as D1Binding

  const ctxSymbol = Symbol.for('__cloudflare-context__')
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[ctxSymbol]
  if (ctx?.env?.DB) return ctx.env.DB as D1Binding

  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Binding | undefined
  if (globalDb) return globalDb

  throw new Error('D1 database binding not available for account lockout')
}
