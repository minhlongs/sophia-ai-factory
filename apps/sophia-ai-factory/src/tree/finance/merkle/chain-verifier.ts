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
import { buildMerkleTree } from './tree-builder';
import { mapRowToAuditRecord } from './ledger-appender';
import { verifySingleAuditRow } from './row-verifier';

/**
 * Verify complete hash-chain cryptographic integrity of the audit ledger
 */
export async function verifyAuditLedgerChain(
  db: D1Database,
  periodKey?: string,
  secret: string = DEFAULT_AUDIT_SECRET
): Promise<LedgerIntegrityResult> {
  const query = periodKey
    ? `SELECT * FROM ipo_audit_ledger WHERE period_key = ?1 ORDER BY sequence_number ASC`
    : `SELECT * FROM ipo_audit_ledger ORDER BY sequence_number ASC`;
  const params: unknown[] = periodKey ? [periodKey] : [];

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

    const { genesisFailed, issues } = await verifySingleAuditRow(
      row,
      i,
      prevExpectedHash,
      periodKey,
      secret,
    );
    if (genesisFailed) genesisValid = false;
    if (issues.length > 0) {
      discrepancies.push(...issues);
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
    anchoredMerkleRoot = periodRow?.merkle_root_hash ?? null;
    if (anchoredMerkleRoot && anchoredMerkleRoot !== computedMerkleRoot) {
      discrepancies.push(
        `Anchored Merkle root mismatch for period ${periodKey}: anchored ${anchoredMerkleRoot} != computed ${computedMerkleRoot}`,
      );
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
