/**
 * Postback Dead-Letter Queue
 *
 * Captures legacy/canonical postback requests that cannot be attributed or
 * verified, so operators can inspect and replay them instead of losing the
 * conversion payload. A postback fails closed loudly (4xx/5xx), but the
 * evidence is durably recorded here before the response is returned.
 *
 * Same row-mapping + SQL-constants pattern as commission-dlq-schema.ts.
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
  /** Raw request headers as a JSON string (secrets are never stored). */
  headersJson: string
  rawBody: string
  failureReason: string
  tenantHint: string | null
}

/**
 * Stable row identity for one piece of evidence. Hashing the attribution key
 * is what makes the upsert below reachable: a random id would mint a fresh row
 * for every redelivery of the same bad request, so retry_count could never
 * advance and a retry storm would write unbounded rows.
 *
 * The fixed-string fields are NUL-separated; the payload follows as the last
 * field. A raw body can itself contain a NUL, so this is not a formally
 * unambiguous encoding — it is enough here because only the payload is
 * attacker-controlled and nothing after it is hashed.
 *
 * A NULL hint is mapped to a sentinel no tenant id can equal, so an
 * unattributed row can never collide with a row for the empty-string tenant.
 */
async function deriveDlqId(input: EnqueuePostbackDlqInput): Promise<string> {
  return sha256Hex(
    [
      input.network,
      input.endpoint,
      input.failureReason,
      input.tenantHint === null ? '\u0001unattributed' : input.tenantHint,
      input.rawBody,
    ].join('\u0000'),
  )
}

/**
 * Persist one unprocessable postback. Idempotent per (network, endpoint,
 * failure reason, tenant hint, payload): repeated deliveries of the same bad
 * request increment retry_count instead of creating duplicate rows.
 *
 * Returns the dead-letter id, or null when D1 is unavailable — callers must
 * still fail the request closed; this is evidence capture, not acceptance.
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

  const now = new Date().toISOString()

  try {
    const id = await deriveDlqId(input)
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
