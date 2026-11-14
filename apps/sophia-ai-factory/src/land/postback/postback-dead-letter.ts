/**
 * Postback Dead-Letter Queue
 *
 * Captures legacy/canonical postback requests that cannot be attributed or
 * verified, so operators can inspect and replay them without losing conversion
 * evidence. Same row-mapping + SQL-constants pattern as commission-dlq-schema.ts.
 *
 * Layer: land/postback (Business Workflow)
 * @module land/postback/postback-dead-letter
 */

import { getD1 } from '@/seed/db/client'
import { sha256Hex } from '@/seed/security/token-hash'
import { logger } from '@/seed/utils/logger-utility'
import { safeCatch } from '@/seed/utils/safe-catch'
import {
  mapPostbackDlqRow,
  INSERT_POSTBACK_DLQ_SQL,
  SELECT_UNRESOLVED_POSTBACK_DLQ_SQL,
  SELECT_POSTBACK_DLQ_COUNTS_SQL,
  RESOLVE_POSTBACK_DLQ_SQL,
  type PostbackDlqEntry,
  type RawD1QueryHandle,
} from './postback-dead-letter-schema'

export {
  mapPostbackDlqRow,
  INSERT_POSTBACK_DLQ_SQL,
  SELECT_UNRESOLVED_POSTBACK_DLQ_SQL,
  SELECT_POSTBACK_DLQ_COUNTS_SQL,
  RESOLVE_POSTBACK_DLQ_SQL,
  type PostbackDlqEntry,
}

export interface EnqueuePostbackDlqInput {
  network: string
  endpoint: string
  sourceIp: string | null
  /**
   * Request headers serialized by `serializeDlqHeaders`: allowlisted diagnostic
   * headers plus `sigfp:` digests for contract-declared signature headers only.
   */
  headersJson: string
  rawBody: string
  failureReason: string
  tenantHint: string | null
}

/**
 * 15-minute aggregation window for unattributed (`tenantHint === null`) rows.
 * Caps unauthenticated floods varying `rawBody` to one row per
 * `(network, endpoint, failureReason)` per 15 minutes via `retry_count`.
 */
export const UNATTRIBUTED_DLQ_WINDOW_MS = 15 * 60 * 1000

async function deriveDlqId(
  input: EnqueuePostbackDlqInput,
  nowMs: number,
): Promise<string> {
  if (input.tenantHint === null) {
    const bucket = String(Math.floor(nowMs / UNATTRIBUTED_DLQ_WINDOW_MS))
    return sha256Hex(
      ['unattributed', input.network, input.endpoint, input.failureReason, bucket].join(
        '\u0000',
      ),
    )
  }
  return sha256Hex(
    [
      'attributed',
      input.network,
      input.endpoint,
      input.failureReason,
      input.tenantHint,
      input.rawBody,
    ].join('\u0000'),
  )
}

/**
 * Persist one unprocessable postback. Attributed rows deduplicate per exact
 * payload; unattributed rows aggregate per 15-minute window via `retry_count`.
 * Returns the dead-letter id, or null when D1 is unavailable.
 */
export async function enqueuePostbackDlq(
  input: EnqueuePostbackDlqInput,
): Promise<string | null> {
  const db = await getD1()
  if (!db) {
    logger.error('[postback-dlq] D1 binding not available', {
      network: input.network,
      endpoint: input.endpoint,
    })
    return null
  }

  const nowMs = Date.now()
  const now = new Date(nowMs).toISOString()

  try {
    const id = await deriveDlqId(input, nowMs)
    await db
      .prepare(INSERT_POSTBACK_DLQ_SQL)
      .bind(
        id,
        input.network,
        input.endpoint,
        input.sourceIp,
        input.headersJson,
        input.rawBody,
        input.failureReason,
        input.tenantHint,
        1,
        now,
        now,
      )
      .run()
    return id
  } catch (err) {
    safeCatch('enqueuePostbackDlq')(err)
    logger.error('[postback-dlq] Enqueue failed', {
      network: input.network,
      endpoint: input.endpoint,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

/**
 * Read unresolved dead-letter rows oldest-first, for operator inspection.
 * Tenant scope is mandatory: operator tooling must never surface one
 * workspace's unverified payloads to another.
 */
export async function listUnresolvedPostbackDlq(
  tenantId: string,
  limit = 50,
): Promise<PostbackDlqEntry[]> {
  const db = await getD1()
  if (!db) return []

  try {
    const rawDb = db as unknown as RawD1QueryHandle
    const result = await rawDb
      .prepare(SELECT_UNRESOLVED_POSTBACK_DLQ_SQL)
      .bind(tenantId, limit)
      .all<Record<string, unknown>>()
    return (result.results ?? []).map(mapPostbackDlqRow)
  } catch (err) {
    safeCatch('listUnresolvedPostbackDlq')(err)
    return []
  }
}

export interface PostbackDlqCounts {
  network: string
  total: number
  unresolved: number
}

export async function getPostbackDlqCounts(
  tenantId: string,
): Promise<PostbackDlqCounts[]> {
  const db = await getD1()
  if (!db) return []

  try {
    const rawDb = db as unknown as RawD1QueryHandle
    const result = await rawDb
      .prepare(SELECT_POSTBACK_DLQ_COUNTS_SQL)
      .bind(tenantId)
      .all<Record<string, unknown>>()
    return (result.results ?? []).map((r) => ({
      network: r.network as string,
      total: (r.total as number) ?? 0,
      unresolved: (r.unresolved as number) ?? 0,
    }))
  } catch (err) {
    safeCatch('getPostbackDlqCounts')(err)
    return []
  }
}

export async function resolvePostbackDlqEntry(
  tenantId: string,
  id: string,
): Promise<void> {
  const db = await getD1()
  if (!db) return

  try {
    await db
      .prepare(RESOLVE_POSTBACK_DLQ_SQL)
      .bind(new Date().toISOString(), id, tenantId)
      .run()
  } catch (err) {
    safeCatch('resolvePostbackDlqEntry')(err)
  }
}
