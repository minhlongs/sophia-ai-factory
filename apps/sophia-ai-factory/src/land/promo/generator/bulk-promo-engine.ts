import { getD1 } from "@/seed/db/client";
import { randomBase32 } from "@/seed/utils/random-base32";
import type {
  BulkGenerateInput,
  BulkGenerateResult,
  BatchInsertInput,
  AuditPayload,
} from "./types";
import { BulkIdempotencyConflict } from "./types";
import {
  randomHexId,
  generateUniqueCodes,
  buildCsv,
} from "./code-pattern-builder";

export const BATCH_CHUNK = 50;
export const IDEMPOTENCY_WINDOW_SEC = 60;

export async function bulkGeneratePromoCodes(
  input: BulkGenerateInput,
): Promise<BulkGenerateResult> {
  if (input.count < 1 || input.count > 1000) {
    throw new Error(`count out of range 1..1000 (got ${input.count})`);
  }
  if (input.baseCode !== "FREE100") {
    throw new Error(`baseCode must be 'FREE100' (got ${input.baseCode})`);
  }

  if (input.idempotencyKey) {
    const prior = await findRecentIdempotentBatch(
      input.adminId,
      input.idempotencyKey,
    );
    if (prior) throw new BulkIdempotencyConflict(prior);
  }

  const batchId = `bulk-${Date.now()}-${randomBase32(6)}`;
  const generatedAt = Date.now();
  const description = input.description ?? `Bulk ${batchId}`;

  const codes = await generateUniqueCodes(input.baseCode, input.count);
  const promoCodeIds = await batchInsertCodes({
    codes,
    description,
    appliesToTier: input.tier,
    validUntil: input.validUntil,
    adminId: input.adminId,
    batchId,
  });

  await writeAuditLog({
    adminId: input.adminId,
    batchId,
    count: input.count,
    tier: input.tier,
    validUntil: input.validUntil,
    idempotencyKey: input.idempotencyKey,
  });

  const csv = buildCsv(codes, input.tier, input.validUntil, description);
  return { codes, promoCodeIds, csv, batchId, generatedAt };
}

/**
 * Insert N codes into promo_codes via D1 batch in chunks of 50.
 * Returns the generated ids in the same order as `input.codes`.
 */
export async function batchInsertCodes(input: BatchInsertInput): Promise<string[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const nowSec = Math.floor(Date.now() / 1000);
  const metadata = JSON.stringify({ batchId: input.batchId });
  const ids: string[] = input.codes.map(() => randomHexId(16));

  const insertSql = `INSERT INTO promo_codes
    (id, code, description, discount_type, discount_value, applies_to_tier, applies_to_sku,
     max_uses, max_uses_per_user, valid_from, valid_until, status, created_by_admin_id, created_at, metadata)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'active',?12,?13,?14)`;

  for (let i = 0; i < input.codes.length; i += BATCH_CHUNK) {
    const slice = input.codes.slice(i, i + BATCH_CHUNK);
    const idSlice = ids.slice(i, i + BATCH_CHUNK);
    const statements = slice.map((code, j) =>
      db
        .prepare(insertSql)
        .bind(
          idSlice[j],
          code,
          input.description,
          "free_full",
          100,
          input.appliesToTier,
          null,
          1,
          1,
          nowSec,
          input.validUntil ?? null,
          input.adminId,
          nowSec,
          metadata,
        ),
    );
    await db.batch(statements);
  }
  return ids;
}

export async function writeAuditLog(p: AuditPayload): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  await db
    .prepare(
      `INSERT INTO admin_audit_log (actor_user_id, action_type, payload, created_at)
       VALUES (?1, ?2, ?3, ?4)`,
    )
    .bind(
      p.adminId,
      "promo_bulk_generate",
      JSON.stringify({
        batchId: p.batchId,
        count: p.count,
        tier: p.tier,
        validUntil: p.validUntil ?? null,
        idempotencyKey: p.idempotencyKey ?? null,
      }),
      Math.floor(Date.now() / 1000),
    )
    .run();
}

/**
 * Look up an audit_log row for this admin + idempotency-key within the dedup window.
 * Returns the prior batchId if found, else null.
 */
export async function findRecentIdempotentBatch(
  adminId: string,
  idempotencyKey: string,
): Promise<string | null> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const cutoff = Math.floor(Date.now() / 1000) - IDEMPOTENCY_WINDOW_SEC;
  const needle = `%"idempotencyKey":"${idempotencyKey.replaceAll('"', '""')}"%`;
  const stmt = db
    .prepare(
      `SELECT payload FROM admin_audit_log
       WHERE actor_user_id = ?1 AND action_type = 'promo_bulk_generate'
         AND created_at >= ?2 AND payload LIKE ?3
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(adminId, cutoff, needle);
  const row = await stmt.first<{ payload: string }>();
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.payload) as { batchId?: string };
    return parsed.batchId ?? null;
  } catch {
    return null;
  }
}
