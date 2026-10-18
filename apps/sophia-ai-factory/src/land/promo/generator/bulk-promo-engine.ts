import { randomBase32 } from "@/seed/utils/random-base32";
import type {
  BulkGenerateInput,
  BulkGenerateResult,
} from "./types";
import { BulkIdempotencyConflict } from "./types";
import {
  generateUniqueCodes,
  buildCsv,
} from "./code-pattern-builder";
import {
  BATCH_CHUNK,
  IDEMPOTENCY_WINDOW_SEC,
  batchInsertCodes,
  writeAuditLog,
  findRecentIdempotentBatch,
} from "./bulk-promo-store";

export {
  BATCH_CHUNK,
  IDEMPOTENCY_WINDOW_SEC,
  batchInsertCodes,
  writeAuditLog,
  findRecentIdempotentBatch,
};

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
