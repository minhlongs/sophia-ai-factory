import type { PromoCodeRow } from "../promo-types";

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

export interface BatchInsertInput {
  codes: string[];
  description: string;
  appliesToTier: string;
  validUntil?: number;
  adminId: string;
  batchId: string;
}

export interface AuditPayload {
  adminId: string;
  batchId: string;
  count: number;
  tier: string;
  validUntil?: number;
  idempotencyKey?: string;
}

export type { PromoCodeRow };
