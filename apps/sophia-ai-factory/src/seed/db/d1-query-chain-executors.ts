/**
 * SQL execution helpers for D1QueryChain
 * @module db/d1-query-chain-executors
 */

import { toError } from '@/seed/utils/to-error'
import type { QueryResult, FilterOp, OrderSpec } from '@/seed/db/d1-query-types'
import { parseJsonFields } from '@/seed/db/d1-query-utilities'
import { withD1Retry } from '@/seed/db/d1-retry'
import {
  execInsert,
  execUpdate,
  execUpsert,
  execDelete,
} from './d1-query-chain-mutations'

export { execInsert, execUpdate, execUpsert, execDelete } from './d1-query-chain-mutations'

export const D1_BATCH_LIMIT = 500

export interface QueryState {
  db: D1Database
  table: string
  selectCols: string
  filters: FilterOp[]
  inFilters: { col: string; vals: unknown[] }[]
  orFilters: FilterOp[][]
  orderSpecs: OrderSpec[]
  limitVal?: number
  offsetVal?: number
  isSingle: boolean
  isMaybeSingle: boolean
  isCount: boolean
  operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete'
  payload: Record<string, unknown> | Record<string, unknown>[]
  returnCols?: string
}

/** Sanitize SQL identifiers (table/column names). Whitelist: [a-zA-Z_][a-zA-Z0-9_]* */
export function sanitizeIdentifier(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: "${name}". Only [a-zA-Z_][a-zA-Z0-9_]* allowed.`)
  }
  return name
}

export function sanitizeCols(cols: string[]): string[] {
  return cols.map(sanitizeIdentifier)
}

export function buildWhere(state: QueryState): { clause: string; params: unknown[] } {
  const parts: string[] = []
  const params: unknown[] = []
  for (const f of state.filters) {
    const col = sanitizeIdentifier(f.col)
    if (f.op === 'IS' && f.val === null) parts.push(`${col} IS NULL`)
    else if (f.op === 'IS NOT' && f.val === null) parts.push(`${col} IS NOT NULL`)
    else { parts.push(`${col} ${f.op} ?`); params.push(f.val) }
  }
  for (const inf of state.inFilters) {
    const col = sanitizeIdentifier(inf.col)
    parts.push(`${col} IN (${inf.vals.map(() => '?').join(', ')})`)
    params.push(...inf.vals)
  }
  for (const group of state.orFilters ?? []) {
    const groupParts: string[] = []
    for (const f of group) {
      const col = sanitizeIdentifier(f.col)
      if (f.op === 'IS' && f.val === null) groupParts.push(`${col} IS NULL`)
      else if (f.op === 'IS NOT' && f.val === null) groupParts.push(`${col} IS NOT NULL`)
      else { groupParts.push(`${col} ${f.op} ?`); params.push(f.val) }
    }
    if (groupParts.length > 0) parts.push(`(${groupParts.join(' OR ')})`)
  }
  return { clause: parts.length > 0 ? ` WHERE ${parts.join(' AND ')}` : '', params }
}

export async function execSelect<T>(state: QueryState): Promise<QueryResult<unknown>> {
  const { clause, params } = buildWhere(state)
  const table = sanitizeIdentifier(state.table)
  let sql = `SELECT ${state.selectCols} FROM ${table}${clause}`
  for (const o of state.orderSpecs) {
    sql += ` ORDER BY ${sanitizeIdentifier(o.col)} ${o.ascending ? 'ASC' : 'DESC'}`
  }
  if (state.limitVal !== undefined) sql += ` LIMIT ${state.limitVal}`
  if (state.offsetVal !== undefined) sql += ` OFFSET ${state.offsetVal}`

  const stmt = state.db.prepare(sql).bind(...params)
  if (state.isSingle || state.isMaybeSingle) {
    const result = await stmt.first<T>()
    if (!result && state.isSingle) return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
    return { data: parseJsonFields(result), error: null }
  }

  const result = await stmt.all<T>()
  const rows = (result.results ?? []).map(parseJsonFields)
  if (state.isCount) {
    const countResult = await state.db.prepare(`SELECT COUNT(*) as cnt FROM ${table}${clause}`).bind(...params).first<{ cnt: number }>()
    return { data: rows, count: countResult?.cnt ?? rows.length, error: null } as QueryResult<unknown> & { count: number }
  }
  return { data: rows, error: null }
}

export async function executeQuery(state: QueryState): Promise<QueryResult<unknown>> {
  try {
    return await withD1Retry(async () => {
      switch (state.operation) {
        case 'select': return await execSelect(state)
        case 'insert': return await execInsert(state)
        case 'update': return await execUpdate(state)
        case 'upsert': return await execUpsert(state)
        case 'delete': return await execDelete(state)
        default: return { data: null, error: { message: 'Unknown operation' } }
      }
    })
  } catch (err) {
    return { data: null, error: { message: toError(err).message } }
  }
}
