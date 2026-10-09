/**
 * Cryptographic Merkle Audit Vault: Chain Verifier
 *
 * Verifies complete hash-chain cryptographic integrity of the audit ledger
 * and checks for tampering, broken sequences, or leaf hash mismatches.
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/finance/merkle/chain-verifier
 */

import type { D1Database } from '@/seed/db/client';
import type { LedgerIntegrityResult, RawAuditLedgerRow } from './types';
import { GENESIS_PREV_HASH, DEFAULT_AUDIT_SECRET } from './types';
import { sha256Hex, hmacSha256Hex } from './hasher';
import { buildMerkleTree } from './tree-builder';
import { mapRowToAuditRecord } from './ledger-appender';

/**
 * Verify complete hash-chain cryptographic integrity of the audit ledger
 */
export async function verifyAuditLedgerChain(
  db: D1Database,
  periodKey?: string,
  secret: string = DEFAULT_AUDIT_SECRET
): Promise<LedgerIntegrityResult> {
  let query = `SELECT * FROM ipo_audit_ledger`;
  const params: unknown[] = [];
  if (periodKey) {
    query += ` WHERE period_key = ?1`;
    params.push(periodKey);
  }
  query += ` ORDER BY sequence_number ASC`;

  const { results } = await db.prepare(query).bind(...params).all<RawAuditLedgerRow>();
  const rows = (results ?? []).map(mapRowToAuditRecord);

  const discrepancies: string[] = [];
  let prevExpectedHash = GENESIS_PREV_HASH;
  let genesisValid = true;
  let brokenIndex: number | null = null;
  let tamperedId: string | null = null;
  const leafHashes: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    leafHashes.push(row.merkleLeafHash);

    // If first record overall and not filtered by period, check genesis
    if (i === 0 && !periodKey && row.prevHash !== GENESIS_PREV_HASH) {
      genesisValid = false;
      discrepancies.push(`Genesis hash mismatch on record ${row.id}: expected ${GENESIS_PREV_HASH}, got ${row.prevHash}`);
      if (brokenIndex === null) {
        brokenIndex = i;
        tamperedId = row.id;
      }
    } else if (i > 0 && row.prevHash !== prevExpectedHash) {
      discrepancies.push(
        `Chain break at seq ${row.sequenceNumber}: prev_hash ${row.prevHash} != expected ${prevExpectedHash}`
      );
      if (brokenIndex === null) {
        brokenIndex = i;
        tamperedId = row.id;
      }
    }

    // Recompute content_hash
    const expectedContentDigest = [
      row.prevHash,
      String(row.sequenceNumber),
      row.periodKey,
      row.eventType,
      row.actorId,
      String(row.amountCents),
      row.payloadCanonicalJson,
    ].join(':');

    const recomputedContentHash = await sha256Hex(expectedContentDigest);
    if (recomputedContentHash !== row.contentHash) {
      discrepancies.push(
        `Content hash tamper detected at seq ${row.sequenceNumber}: stored ${row.contentHash} != computed ${recomputedContentHash}`
      );
      if (brokenIndex === null) {
        brokenIndex = i;
        tamperedId = row.id;
      }
    }

    // Recompute leaf hash
    const recomputedLeaf = await sha256Hex(row.contentHash);
    if (recomputedLeaf !== row.merkleLeafHash) {
      discrepancies.push(
        `Leaf hash mismatch at seq ${row.sequenceNumber}: stored ${row.merkleLeafHash} != computed ${recomputedLeaf}`
      );
      if (brokenIndex === null) {
        brokenIndex = i;
        tamperedId = row.id;
      }
    }

    // Recompute HMAC signature
    const recomputedSig = await hmacSha256Hex(row.contentHash, secret);
    if (recomputedSig !== row.digitalSignature) {
      discrepancies.push(`Signature invalid at seq ${row.sequenceNumber}`);
      if (brokenIndex === null) {
        brokenIndex = i;
        tamperedId = row.id;
      }
    }

    prevExpectedHash = row.contentHash;
  }

  const { rootHash: computedMerkleRoot } = await buildMerkleTree(leafHashes);

  let anchoredMerkleRoot: string | null = null;
  if (periodKey) {
    const periodRow = await db
      .prepare(`SELECT merkle_root_hash FROM financial_close_periods WHERE period_key = ?1 LIMIT 1`)
      .bind(periodKey)
      .first<{ merkle_root_hash: string | null }>();
    if (periodRow) {
      anchoredMerkleRoot = periodRow.merkle_root_hash;
      if (anchoredMerkleRoot && anchoredMerkleRoot !== computedMerkleRoot) {
        discrepancies.push(
          `Anchored Merkle root mismatch for period ${periodKey}: anchored ${anchoredMerkleRoot} != computed ${computedMerkleRoot}`
        );
      }
    }
  }

  return {
    isValid: discrepancies.length === 0,
    totalRecordsChecked: rows.length,
    genesisHashValid: genesisValid,
    brokenSequenceIndex: brokenIndex,
    tamperedRecordId: tamperedId,
    computedMerkleRoot,
    anchoredMerkleRoot,
    discrepancies,
  };
}
