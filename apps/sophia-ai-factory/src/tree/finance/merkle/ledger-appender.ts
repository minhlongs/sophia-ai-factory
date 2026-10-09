/**
 * Cryptographic Merkle Audit Vault: Ledger Appender
 *
 * Appends immutable audit events to the IPO audit ledger with hash chaining and signature.
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/finance/merkle/ledger-appender
 */

import type { D1Database } from '@/seed/db/client';
import type {
  IpoAuditLedgerRecord,
  AppendAuditEventInput,
  RawAuditLedgerRow,
} from './types';
import { GENESIS_PREV_HASH, DEFAULT_AUDIT_SECRET } from './types';
import { canonicalJson, sha256Hex, hmacSha256Hex } from './hasher';

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

/**
 * Append an immutable audit event to the IPO audit ledger with hash chaining and signature
 */
export async function appendIpoAuditEvent(
  db: D1Database,
  input: AppendAuditEventInput,
  secret: string = DEFAULT_AUDIT_SECRET
): Promise<IpoAuditLedgerRecord> {
  const lastRow = await db
    .prepare(
      `SELECT sequence_number, content_hash
       FROM ipo_audit_ledger
       ORDER BY sequence_number DESC
       LIMIT 1`
    )
    .first<{ sequence_number: number; content_hash: string }>();

  const nextSeq = lastRow ? Number(lastRow.sequence_number) + 1 : 1;
  const prevHash = lastRow ? lastRow.content_hash : GENESIS_PREV_HASH;

  const id = crypto.randomUUID().replace(/-/g, '').toLowerCase();
  const timestamp = input.timestamp ?? Date.now();
  const amountCents = input.amountCents ?? 0;
  const canonicalPayload = canonicalJson(input.payload);
  const soxControl = input.soxControlId ?? 'NONE';
  const vasAccount = input.vasAccountCode ?? null;

  // content_hash formula
  const contentDigestInput = [
    prevHash,
    String(nextSeq),
    input.periodKey,
    input.eventType,
    input.actorId,
    String(amountCents),
    canonicalPayload,
  ].join(':');

  const contentHash = await sha256Hex(contentDigestInput);
  const merkleLeafHash = await sha256Hex(contentHash);
  const digitalSignature = await hmacSha256Hex(contentHash, secret);
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO ipo_audit_ledger (
        id, sequence_number, period_key, org_id, event_type, event_scope,
        actor_id, actor_role, amount_cents, payload_canonical_json,
        prev_hash, content_hash, merkle_leaf_hash, digital_signature,
        sox_control_id, vas_account_code, timestamp, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)`
    )
    .bind(
      id,
      nextSeq,
      input.periodKey,
      input.orgId ?? null,
      input.eventType,
      input.eventScope,
      input.actorId,
      input.actorRole,
      amountCents,
      canonicalPayload,
      prevHash,
      contentHash,
      merkleLeafHash,
      digitalSignature,
      soxControl,
      vasAccount,
      timestamp,
      now
    )
    .run();

  return {
    id,
    sequenceNumber: nextSeq,
    periodKey: input.periodKey,
    orgId: input.orgId ?? null,
    eventType: input.eventType,
    eventScope: input.eventScope,
    actorId: input.actorId,
    actorRole: input.actorRole,
    amountCents,
    payloadCanonicalJson: canonicalPayload,
    prevHash,
    contentHash,
    merkleLeafHash,
    digitalSignature,
    soxControlId: soxControl,
    vasAccountCode: vasAccount,
    timestamp,
    createdAt: now,
  };
}
