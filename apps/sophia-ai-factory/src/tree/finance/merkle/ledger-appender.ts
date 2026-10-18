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
} from './types';
import { GENESIS_PREV_HASH, DEFAULT_AUDIT_SECRET } from './types';
import { canonicalJson, sha256Hex, hmacSha256Hex } from './hasher';
import {
  insertIpoAuditLedgerRow,
  mapRowToAuditRecord,
} from './ledger-appender-sql';

export { mapRowToAuditRecord };

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

  const record: IpoAuditLedgerRecord = {
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

  await insertIpoAuditLedgerRow(db, record);

  return record;
}
