/**
 * Bulk-generate per-user `FREE100-{8-char base32}` promo codes for marketing campaigns.
 *
 * Wraps existing `createCode` from promo-repo and adds:
 *   - cryptographically-random unique suffix per code
 *   - collision detection vs existing `promo_codes` rows (3-retry budget)
 *   - admin_audit_log row per batch (forensic trail)
 *   - CSV string suitable for direct download by admin UI
 *
 * Failure model (v1):
 *   D1 lacks multi-statement transactions in the JS API. If `createCode` fails
 *   midway (e.g. row 537/1000), prior 536 rows persist as `active` codes WITHOUT
 *   an audit_log row written (audit_log is appended only AFTER the loop). Blast
 *   radius bounded by: collision retry budget, count cap (1000), admin-only gate,
 *   rate-limit (5/admin/hour). Recovery: operator queries promo_codes by
 *   metadata.batchId prefix and disables the partial batch manually.
 *   Long-term fix: switch to `db.batch()` chunks (Phase 03b).
 *
 * @module land/promo/bulk-generator
 */

import { getD1Raw } from "@/seed/db/client";
import { randomBase32 } from "@/seed/utils/random-base32";
import { createCode, getCodeByCode } from "./promo-repo";
import type { PromoCodeRow } from "./promo-types";

const SUFFIX_LEN = 8;
const COLLISION_RETRY = 3;

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
}

export interface BulkGenerateResult {
  codes: string[];
  promoCodeIds: string[];
  csv: string;
  batchId: string;
  generatedAt: number;
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

  const batchId = `bulk-${Date.now()}-${randomBase32(6)}`;
  const generatedAt = Date.now();
  const description = input.description ?? `Bulk ${batchId}`;
  const codes: string[] = [];
  const promoCodeIds: string[] = [];

  for (let i = 0; i < input.count; i++) {
    const code = await generateUniqueCode(input.baseCode);
    const row: PromoCodeRow = await createCode(
      {
        code,
        description,
        discountType: "free_full",
        discountValue: 100,
        appliesToTier: input.tier,
        maxUses: 1,
        maxUsesPerUser: 1,
        validUntil: input.validUntil,
        metadata: { batchId },
      },
      input.adminId,
    );
    codes.push(code);
    promoCodeIds.push(row.id);
  }

  await writeAuditLog({
    adminId: input.adminId,
    batchId,
    count: input.count,
    tier: input.tier,
    validUntil: input.validUntil,
  });

  const csv = buildCsv(codes, input.tier, input.validUntil, description);

  return { codes, promoCodeIds, csv, batchId, generatedAt };
}

async function generateUniqueCode(baseCode: string): Promise<string> {
  for (let attempt = 0; attempt < COLLISION_RETRY; attempt++) {
    const candidate = `${baseCode}-${randomBase32(SUFFIX_LEN)}`;
    const existing = await getCodeByCode(candidate);
    if (!existing) return candidate;
  }
  throw new Error(
    `collision retry exhausted (${COLLISION_RETRY} attempts) for base '${baseCode}'`,
  );
}

interface AuditPayload {
  adminId: string;
  batchId: string;
  count: number;
  tier: string;
  validUntil?: number;
}

async function writeAuditLog(p: AuditPayload): Promise<void> {
  const db = await getD1Raw();
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
      }),
      Math.floor(Date.now() / 1000),
    )
    .run();
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
