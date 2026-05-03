/**
 * Type-safe wrapper around `D1QueryChain.insert()`.
 *
 * `D1QueryChain.insert()` accepts `Record<string, unknown>` structurally, but strongly-typed
 * row interfaces (e.g. `RaasAuditLogInsert`) don't satisfy that index signature directly.
 * Callers would otherwise write `payload as unknown as Record<string, unknown>` at every site.
 *
 * `insertTyped` performs the cast once, preserving chain ergonomics:
 *
 *   const result = await insertTyped(
 *     db.from<RaasAuditLogRow>('raas_audit_logs'),
 *     payload,
 *   )
 *     .select()
 *     .single()
 *
 * instead of:
 *
 *   const result = await db.from<RaasAuditLogRow>('raas_audit_logs')
 *     .insert(payload as unknown as Record<string, unknown>)
 *     .select()
 *     .single()
 */

import type { D1QueryChain } from '@/seed/db/d1-query-builder'

export function insertTyped<R, T>(chain: D1QueryChain<R>, payload: T): D1QueryChain<R> {
  return chain.insert(payload as unknown as Record<string, unknown>)
}
