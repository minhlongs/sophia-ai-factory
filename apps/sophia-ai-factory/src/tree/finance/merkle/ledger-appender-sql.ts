/**
 * Cryptographic Merkle Audit Vault: SQL Mappers & Persistence Helpers
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/finance/merkle/ledger-appender-sql
 */

import type { D1Database } from '@/seed/db/client';
import type {
  IpoAuditLedgerRecord,
  RawAuditLedgerRow,
} from './types';

export function mapRowToAuditRecord(row: RawAuditLedgerRow): IpoAuditLedgerRecord {
  return {
    id: row.id,
    sequenceNumber: Number(row.sequence_number),
    periodKey: row.period_key,
    orgId: row.org_id,
    eventType: row.event_type,
    eventScope: row.event_scope,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    amountCents: Number(row.amount_cents),
    payloadCanonicalJson: row.payload_canonical_json,
    prevHash: row.prev_hash,
    contentHash: row.content_hash,
    merkleLeafHash: row.merkle_leaf_hash,
    digitalSignature: row.digital_signature,
    soxControlId: row.sox_control_id,
    vasAccountCode: row.vas_account_code,
    timestamp: Number(row.timestamp),
    createdAt: Number(row.created_at),
  };
}

export async function insertIpoAuditLedgerRow(
  db: D1Database,
  record: IpoAuditLedgerRecord,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO ipo_audit_ledger (
        id, sequence_number, period_key, org_id, event_type, event_scope,
        actor_id, actor_role, amount_cents, payload_canonical_json,
        prev_hash, content_hash, merkle_leaf_hash, digital_signature,
        sox_control_id, vas_account_code, timestamp, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)`,
    )
    .bind(
      record.id,
      record.sequenceNumber,
      record.periodKey,
      record.orgId,
      record.eventType,
      record.eventScope,
      record.actorId,
      record.actorRole,
      record.amountCents,
      record.payloadCanonicalJson,
      record.prevHash,
      record.contentHash,
      record.merkleLeafHash,
      record.digitalSignature,
      record.soxControlId,
      record.vasAccountCode,
      record.timestamp,
      record.createdAt,
    )
    .run();
}
