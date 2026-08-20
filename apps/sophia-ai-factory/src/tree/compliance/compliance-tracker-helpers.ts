/**
 * Internal helpers for compliance-tracker — D1 insert, row mapping, timestamp.
 * Not part of the public API; import only from compliance-tracker.ts.
 *
 * @module tree/compliance/compliance-tracker-helpers
 */

import { getD1 } from '@/seed/db/client';
import type { ComplianceRecord, ComplianceType, Platform } from '@/seed/types/compliance';

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export interface RawRow {
  id: string;
  execution_id: string;
  content_id: string | null;
  user_id: string;
  compliance_type: string;
  metadata_json: string;
  platform: string | null;
  verified: number;
  verified_at: number | null;
  created_at: number;
}

export function toRecord(row: RawRow): ComplianceRecord {
  return {
    id: row.id,
    executionId: row.execution_id,
    contentId: row.content_id ?? undefined,
    userId: row.user_id,
    complianceType: row.compliance_type as ComplianceType,
    metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
    platform: (row.platform ?? undefined) as Platform | undefined,
    verified: row.verified === 1,
    verifiedAt: row.verified_at ?? undefined,
    createdAt: row.created_at,
  };
}

export interface InsertParams {
  executionId: string;
  contentId?: string;
  userId: string;
  complianceType: ComplianceType;
  metadata: Record<string, unknown>;
  platform?: Platform;
}

/** Insert a compliance_metadata row; returns the generated UUID. */
export async function insertComplianceRecord(params: InsertParams): Promise<string> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const id = crypto.randomUUID();
  const ts = nowSec();

  await db
    .prepare(
      `INSERT INTO compliance_metadata
         (id, execution_id, content_id, user_id, compliance_type, metadata_json, platform, verified, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8)`
    )
    .bind(
      id,
      params.executionId,
      params.contentId ?? null,
      params.userId,
      params.complianceType,
      JSON.stringify(params.metadata),
      params.platform ?? null,
      ts
    )
    .run();

  return id;
}
