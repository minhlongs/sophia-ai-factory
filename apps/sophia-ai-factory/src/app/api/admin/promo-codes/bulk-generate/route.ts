/**
 * POST /api/admin/promo-codes/bulk-generate
 *
 * Generates N unique `FREE100-{8-char base32}` codes server-side for marketing
 * campaigns. Admin only. Rate-limited 5/admin/hour to prevent runaway gen.
 *
 * Body:
 *   {
 *     baseCode: 'FREE100',
 *     count: 1..1000,
 *     tier: 'MASTER',
 *     validUntil?: unix_seconds,
 *     description?: string (max 200 chars)
 *   }
 *
 * Optional header:
 *   Idempotency-Key: <opaque string>  — duplicate within 60s returns 409.
 *
 * Response 200:
 *   { codes: string[], promoCodeIds: string[], csv: string, batchId, generatedAt }
 *
 * Errors: 400 (validation), 401 (no session), 403 (not admin),
 *         409 (idempotency conflict — prior batchId in body),
 *         429 (rate limit), 500 (server error).
 *
 * @module app/api/admin/promo-codes/bulk-generate
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireRecentAuth } from "@/seed/auth/require-admin";
import { rateLimit } from "@/seed/security/rate-limiter";
import {
  bulkGeneratePromoCodes,
  BulkIdempotencyConflict,
} from "@/land/promo/bulk-generator";

export const dynamic = "force-dynamic";

const Schema = z.object({
  baseCode: z.literal("FREE100"),
  count: z.number().int().min(1).max(1000),
  tier: z.literal("MASTER"),
  validUntil: z.number().int().positive().optional(),
  description: z.string().max(200).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const { user: admin } = auth;

  // F02: Re-authentication challenge (ASVS V3.5.1)
  const recent = await requireRecentAuth(request);
  if (!recent.ok) {
    return NextResponse.json(
      { error: 'recent_auth_required', reason: recent.reason },
      { status: 401 },
    );
  }

  const rl = await rateLimit(admin.id, "promo_bulk_generate", 5, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded — max 5 requests/hour", resetAt: rl.resetAt },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;

  try {
    const result = await bulkGeneratePromoCodes({
      ...parsed.data,
      adminId: admin.id,
      idempotencyKey,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof BulkIdempotencyConflict) {
      return NextResponse.json(
        {
          error: "Duplicate request within 60s window",
          priorBatchId: err.priorBatchId,
        },
        { status: 409 },
      );
    }
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: "Bulk generation failed", reason: msg },
      { status: 500 },
    );
  }
}
