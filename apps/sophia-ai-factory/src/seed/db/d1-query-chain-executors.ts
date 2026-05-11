/**
 * SQL execution helpers for D1QueryChain
 * @module db/d1-query-chain-executors
 */

import { toError } from '@/seed/utils/to-error'
import type { QueryResult, FilterOp, OrderSpec } from '@/seed/db/d1-query-types'
import { parseJsonFields, serializeValue } from '@/seed/db/d1-query-utilities'

export interface QueryState {
  db: D1Database
  table: string
  selectCols: string
  filters: FilterOp[]
  inFilters: { col: string; vals: unknown[] }[]
  orFilters: FilterOp[][]  // each inner array is a group of OR'd filters (clauses joined by OR within the group)
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

export function buildWhere(state: QueryState): { clause: string; params: unknown[] } {
  const parts: string[] = []
  const params: unknown[] = []
  for (const f of state.filters) {
    if (f.op === 'IS' && f.val === null) parts.push(`${f.col} IS NULL`)
    else if (f.op === 'IS NOT' && f.val === null) parts.push(`${f.col} IS NOT NULL`)
    else { parts.push(`${f.col} ${f.op} ?`); params.push(f.val) }
  }
  for (const inf of state.inFilters) {
    parts.push(`${inf.col} IN (${inf.vals.map(() => '?').join(', ')})`)
    params.push(...inf.vals)
  }
  for (const group of state.orFilters ?? []) {
    const groupParts: string[] = []
    for (const f of group) {
      if (f.op === 'IS' && f.val === null) groupParts.push(`${f.col} IS NULL`)
      else if (f.op === 'IS NOT' && f.val === null) groupParts.push(`${f.col} IS NOT NULL`)
      else { groupParts.push(`${f.col} ${f.op} ?`); params.push(f.val) }
    }
    if (groupParts.length > 0) parts.push(`(${groupParts.join(' OR ')})`)
  }
  return { clause: parts.length > 0 ? ` WHERE ${parts.join(' AND ')}` : '', params }
}

export async function execSelect<T>(state: QueryState): Promise<QueryResult<unknown>> {
  const { clause, params } = buildWhere(state)
  let sql = `SELECT ${state.selectCols} FROM ${state.table}${clause}`
  for (const o of state.orderSpecs) sql += ` ORDER BY ${o.col} ${o.ascending ? 'ASC' : 'DESC'}`
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
    const countResult = await state.db.prepare(`SELECT COUNT(*) as cnt FROM ${state.table}${clause}`).bind(...params).first<{ cnt: number }>()
    return { data: rows, count: countResult?.cnt ?? rows.length, error: null } as QueryResult<unknown> & { count: number }
  }
  return { data: rows, error: null }
}

export async function execInsert(state: QueryState): Promise<QueryResult<unknown>> {
  const rows = Array.isArray(state.payload) ? state.payload : [state.payload]
  const results: unknown[] = []
  for (const row of rows) {
    const cols = Object.keys(row)
    const vals = Object.values(row).map(serializeValue)
    await state.db.prepare(`INSERT INTO ${state.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).bind(...vals).run()
    if (state.returnCols || state.selectCols !== '*') {
      const selectCols = state.returnCols ?? state.selectCols
      const idVal = row.id ?? row.key_hash ?? row.email
      const idCol = row.id ? 'id' : row.key_hash ? 'key_hash' : 'email'
      const fetched = idVal
        ? await state.db.prepare(`SELECT ${selectCols} FROM ${state.table} WHERE ${idCol} = ? LIMIT 1`).bind(idVal).first()
        : await state.db.prepare(`SELECT ${selectCols} FROM ${state.table} ORDER BY rowid DESC LIMIT 1`).first()
      results.push(parseJsonFields(fetched))
    } else results.push(row)
  }
  return { data: state.isSingle ? results[0] ?? null : results, error: null }
}

export async function execUpdate(state: QueryState): Promise<QueryResult<unknown>> {
  const row = state.payload as Record<string, unknown>
  const cols = Object.keys(row)
  const vals = cols.map((c) => serializeValue(row[c]))
  const { clause, params } = buildWhere(state)
  await state.db.prepare(`UPDATE ${state.table} SET ${cols.map((c) => `${c} = ?`).join(', ')}${clause}`).bind(...vals, ...params).run()
  if (state.returnCols || state.isSingle) {
    const selectCols = state.returnCols ?? state.selectCols
    if (state.isSingle) {
      const result = await state.db.prepare(`SELECT ${selectCols} FROM ${state.table}${clause}`).bind(...params).first()
      return result ? { data: parseJsonFields(result), error: null } : { data: null, error: { message: 'No rows updated' } }
    }
    const result = await state.db.prepare(`SELECT ${selectCols} FROM ${state.table}${clause}`).bind(...params).all()
    return { data: (result.results ?? []).map(parseJsonFields), error: null }
  }
  return { data: null, error: null }
}

export async function execUpsert(state: QueryState): Promise<QueryResult<unknown>> {
  // Mirror execInsert's array-handling so bulk callers (e.g. ingestion
  // adapters scoring batches) don't end up serialising an array's numeric
  // index keys as column names. Each row is run as its own statement —
  // good enough for the small (≤500) batches D1 sees today.
  const rows = Array.isArray(state.payload) ? state.payload as Record<string, unknown>[] : [state.payload as Record<string, unknown>]
  let lastRow: Record<string, unknown> = rows[0] ?? {}
  for (const row of rows) {
    const cols = Object.keys(row)
    const vals = cols.map((c) => serializeValue(row[c]))
    const updateClauses = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')
    await state.db.prepare(`INSERT INTO ${state.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) ON CONFLICT DO UPDATE SET ${updateClauses}`).bind(...vals).run()
    lastRow = row
  }
  if (state.isSingle && lastRow.id) {
    const fetched = await state.db.prepare(`SELECT * FROM ${state.table} WHERE id = ?`).bind(lastRow.id).first()
    return { data: parseJsonFields(fetched), error: null }
  }
  return { data: Array.isArray(state.payload) ? rows : lastRow, error: null }
}

export async function execDelete(state: QueryState): Promise<QueryResult<unknown>> {
  const { clause, params } = buildWhere(state)
  await state.db.prepare(`DELETE FROM ${state.table}${clause}`).bind(...params).run()
  return { data: null, error: null }
}

export async function executeQuery(state: QueryState): Promise<QueryResult<unknown>> {
  try {
    switch (state.operation) {
      case 'select': return await execSelect(state)
      case 'insert': return await execInsert(state)
      case 'update': return await execUpdate(state)
      case 'upsert': return await execUpsert(state)
      case 'delete': return await execDelete(state)
      default: return { data: null, error: { message: `Unknown operation: ${state.operation}` } }
    }
  } catch (err) {
    return { data: null, error: { message: toError(err).message } }
  }
}
