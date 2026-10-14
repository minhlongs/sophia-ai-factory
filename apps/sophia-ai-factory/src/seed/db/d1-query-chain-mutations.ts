/**
 * SQL mutation executors (insert, update, upsert, delete) for D1QueryChain.
 * @module db/d1-query-chain-mutations
 */

import type { QueryResult } from '@/seed/db/d1-query-types'
import { parseJsonFields, serializeValue } from '@/seed/db/d1-query-utilities'
import {
  D1_BATCH_LIMIT,
  buildWhere,
  sanitizeCols,
  sanitizeIdentifier,
  type QueryState,
} from './d1-query-chain-executors'

export async function execInsert(state: QueryState): Promise<QueryResult<unknown>> {
  const rows = Array.isArray(state.payload) ? state.payload : [state.payload]
  if (rows.length > D1_BATCH_LIMIT) {
    return { data: null, error: { message: `Batch size ${rows.length} exceeds D1_BATCH_LIMIT (${D1_BATCH_LIMIT}); chunk the payload before calling insert()`, code: 'BATCH_LIMIT_EXCEEDED' } }
  }
  const table = sanitizeIdentifier(state.table)
  const results: unknown[] = []
  for (const row of rows) {
    const cols = sanitizeCols(Object.keys(row))
    const vals = Object.values(row).map(serializeValue)
    await state.db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).bind(...vals).run()
    if (state.returnCols || state.selectCols !== '*') {
      const selectCols = state.returnCols ?? state.selectCols
      const idVal = (row as Record<string, unknown>).id ?? (row as Record<string, unknown>).key_hash ?? (row as Record<string, unknown>).email
      const idCol = (row as Record<string, unknown>).id ? 'id' : (row as Record<string, unknown>).key_hash ? 'key_hash' : 'email'
      const fetched = idVal
        ? await state.db.prepare(`SELECT ${selectCols} FROM ${table} WHERE ${idCol} = ? LIMIT 1`).bind(idVal).first()
        : await state.db.prepare(`SELECT ${selectCols} FROM ${table} ORDER BY rowid DESC LIMIT 1`).first()
      results.push(parseJsonFields(fetched))
    } else results.push(row)
  }
  return { data: state.isSingle ? results[0] ?? null : results, error: null }
}

export async function execUpdate(state: QueryState): Promise<QueryResult<unknown>> {
  const row = state.payload as Record<string, unknown>
  const cols = sanitizeCols(Object.keys(row))
  const vals = cols.map((c) => serializeValue(row[c]))
  const { clause, params } = buildWhere(state)
  const table = sanitizeIdentifier(state.table)
  await state.db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')}${clause}`).bind(...vals, ...params).run()
  if (state.returnCols || state.isSingle) {
    const selectCols = state.returnCols ?? state.selectCols
    if (state.isSingle) {
      const result = await state.db.prepare(`SELECT ${selectCols} FROM ${table}${clause}`).bind(...params).first()
      return result ? { data: parseJsonFields(result), error: null } : { data: null, error: { message: 'No rows updated' } }
    }
    const result = await state.db.prepare(`SELECT ${selectCols} FROM ${table}${clause}`).bind(...params).all()
    return { data: (result.results ?? []).map(parseJsonFields), error: null }
  }
  return { data: null, error: null }
}

export async function execUpsert(state: QueryState): Promise<QueryResult<unknown>> {
  const rows = Array.isArray(state.payload) ? state.payload as Record<string, unknown>[] : [state.payload as Record<string, unknown>]
  if (rows.length > D1_BATCH_LIMIT) {
    return { data: null, error: { message: `Batch size ${rows.length} exceeds D1_BATCH_LIMIT (${D1_BATCH_LIMIT}); chunk the payload before calling upsert()`, code: 'BATCH_LIMIT_EXCEEDED' } }
  }
  const table = sanitizeIdentifier(state.table)
  let lastRow: Record<string, unknown> = rows[0] ?? {}
  for (const row of rows) {
    const cols = sanitizeCols(Object.keys(row))
    const vals = cols.map((c) => serializeValue(row[c]))
    const updateClauses = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')
    await state.db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) ON CONFLICT DO UPDATE SET ${updateClauses}`).bind(...vals).run()
    lastRow = row
  }
  if (state.isSingle && lastRow.id) {
    const fetched = await state.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(lastRow.id).first()
    return { data: parseJsonFields(fetched), error: null }
  }
  return { data: Array.isArray(state.payload) ? rows : lastRow, error: null }
}

export async function execDelete(state: QueryState): Promise<QueryResult<unknown>> {
  const { clause, params } = buildWhere(state)
  const table = sanitizeIdentifier(state.table)
  await state.db.prepare(`DELETE FROM ${table}${clause}`).bind(...params).run()
  return { data: null, error: null }
}
