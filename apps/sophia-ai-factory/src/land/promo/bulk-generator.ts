/**
 * Bulk-generate per-user `FREE100-{8-char base32}` promo codes for marketing campaigns.
 *
 * Phase 03b improvements over v1:
 *   - Single SELECT WHERE code IN (...) for collision check (was N round-trips)
 *   - db.batch() INSERTs in chunks of 50 (was N sequential .run()s)
 *   - Idempotency-Key support — duplicate request within 60s throws
 *     `BulkIdempotencyConflict` with prior batchId
 *
 * @module land/promo/bulk-generator
 */

import { getD1 } from "@/seed/db/client";
import { randomBase32 } from "@/seed/utils/random-base32";
import { getCodeByCode } from "./promo-repo";
import type { PromoCodeRow } from "./promo-types";

const SUFFIX_LEN = 8;
const BATCH_CHUNK = 50;
const IDEMPOTENCY_WINDOW_SEC = 60;
const COLLISION_RETRY_BUDGET = 3;

export interface BulkGenerateInput {
  baseCode: "FREE100";
  count: number;
  /** Sophia tier enum (uppercase). For FREE100 campaigns, always 'MASTER'. */
  tier: "MASTER";
  /** Unix seconds — optional explicit expiry. If omitted, code never expires. */
  validUntil?: number;
  /** Free-form description stored on each row. Defaults to `Bulk <batchId>`. */
  description?: string;
  /** Admin user id (from requireAdmin gate) — recorded in created_by_admin_id + audit log. */
  adminId: string;
  /** Idempotency-Key header value — duplicate within 60s rejected with 409. */
  idempotencyKey?: string;
}

export interface BulkGenerateResult {
  codes: string[];
  promoCodeIds: string[];
  csv: string;
  batchId: string;
  generatedAt: number;
}

/** Thrown when an in-flight or recent duplicate request (same Idempotency-Key + admin) is found. */
export class BulkIdempotencyConflict extends Error {
  readonly priorBatchId: string;
  constructor(priorBatchId: string) {
    super(`Duplicate request — prior batchId: ${priorBatchId}`);
    this.name = "BulkIdempotencyConflict";
    this.priorBatchId = priorBatchId;
  }
}

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
 * Generate N unique codes. Uses a single SELECT WHERE code IN (?, ?, ...) to detect
 * collisions in one round-trip. If any collide, regenerate just those and re-check
 * (up to COLLISION_RETRY_BUDGET passes total).
 */
async function generateUniqueCodes(
  baseCode: string,
  count: number,
): Promise<string[]> {
  let candidates: string[] = makeCandidates(baseCode, count);
  for (let pass = 0; pass < COLLISION_RETRY_BUDGET; pass++) {
    const collisions = await findExistingCodes(candidates);
    if (collisions.size === 0) return candidates;
    // Replace collided positions with fresh candidates and retry
    candidates = candidates.map((c) =>
      collisions.has(c) ? `${baseCode}-${randomBase32(SUFFIX_LEN)}` : c,
    );
  }
  // Final check after last regeneration
  const finalCollisions = await findExistingCodes(candidates);
  if (finalCollisions.size > 0) {
    throw new Error(
      `collision retry exhausted (${COLLISION_RETRY_BUDGET} passes); ${finalCollisions.size} unresolvable collisions`,
    );
  }
  return candidates;
}

function makeCandidates(baseCode: string, count: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  while (out.length < count) {
    const c = `${baseCode}-${randomBase32(SUFFIX_LEN)}`;
    if (seen.has(c)) continue; // intra-batch dedup (extremely rare at 40-bit entropy)
    seen.add(c);
    out.push(c);
  }
  return out;
}

/**
 * Returns the set of `codes` that already exist in promo_codes.
 * Falls back to per-code lookup if the IN-clause is unsupported in test env.
 */
async function findExistingCodes(codes: string[]): Promise<Set<string>> {
  if (codes.length === 0) return new Set();
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;;
  try {
    const placeholders = codes.map((_, i) => `?${i + 1}`).join(",");
    const stmt = db
      .prepare(`SELECT code FROM promo_codes WHERE code IN (${placeholders})`)
      .bind(...codes);
    const result = await stmt.all<{ code: string }>();
    const rows = result.results ?? [];
    return new Set(rows.map((r) => r.code));
  } catch {
    // Fallback for environments without IN-clause support (mocked tests)
    const hits = new Set<string>();
    for (const c of codes) {
      const row = await getCodeByCode(c);
      if (row) hits.add(c);
    }
    return hits;
  }
}

interface BatchInsertInput {
  codes: string[];
  description: string;
  appliesToTier: string;
  validUntil?: number;
  adminId: string;
  batchId: string;
}

/**
 * Insert N codes into promo_codes via D1 batch in chunks of 50.
 * Returns the generated ids in the same order as `input.codes`.
 */
async function batchInsertCodes(input: BatchInsertInput): Promise<string[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;;
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

function randomHexId(bytes: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface AuditPayload {
  adminId: string;
  batchId: string;
  count: number;
  tier: string;
  validUntil?: number;
  idempotencyKey?: string;
}

async function writeAuditLog(p: AuditPayload): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;;
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
async function findRecentIdempotentBatch(
  adminId: string,
  idempotencyKey: string,
): Promise<string | null> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;;
  const cutoff = Math.floor(Date.now() / 1000) - IDEMPOTENCY_WINDOW_SEC;
  // payload is JSON-encoded; SQLite LIKE on the key-quoted substring is enough
  // (batchId differs per invocation but idempotencyKey is constant for a retry).
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

function buildCsv(
  codes: string[],
  tier: string,
  validUntil: number | undefined,
  description: string,
): string {
  const escape = (s: string | number) => `"${String(s).replaceAll('"', '""')}"`;
  const header = ["code", "tier", "valid_until_unix", "description"]
    .map(escape)
    .join(",");
  const rows = codes.map((c) =>
    [c, tier, validUntil ?? "", description].map(escape).join(","),
  );
  return [header, ...rows].join("\n");
}

// Re-export PromoCodeRow for callers that consumed it from v1
export type { PromoCodeRow };
